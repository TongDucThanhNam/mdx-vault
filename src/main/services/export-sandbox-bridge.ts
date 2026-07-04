import { readFile } from 'fs/promises'
import { extname, join, posix as pathPosix } from 'path'

import { safeJoin } from './safe-path'
import { SandboxService } from './sandbox-service'
import type { InlinedAsset } from './export-asset-collector'
import type { SandboxManifest } from '../../shared/sandbox'

const SANDBOX_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  "connect-src 'none'",
  "font-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

export interface SandboxExportOptions {
  /** Either `html` (`<SandboxedHTML src="...">`) or `interactive` (`<Interactive src="...">`) */
  kind: 'html' | 'interactive'
  src: string
  noteRelativePath: string | null
  props: Record<string, unknown>
  datasets?: Map<string, InlinedAsset>
  fallbackDataUri?: string
  fallbackCaption?: string
}

export interface SandboxExportDocument {
  srcdoc: string
  manifestName: string
  resolvedPath: string
  contentHash: string
}

export class SandboxExportBridge {
  constructor(private readonly sandboxService: SandboxService) {}

  get vaultRootPath(): string {
    return this.sandboxService['vault'].rootPath
  }

  async describe(
    kind: 'html' | 'interactive',
    src: string,
    noteRelativePath: string | null
  ): Promise<Awaited<ReturnType<SandboxService['describeHtml']>>> {
    return kind === 'html'
      ? this.sandboxService.describeHtml(src, noteRelativePath)
      : this.sandboxService.describeInteractive(src, noteRelativePath)
  }

  async buildDocument({
    kind,
    src,
    noteRelativePath,
    props,
    datasets = new Map(),
    fallbackDataUri,
    fallbackCaption
  }: SandboxExportOptions): Promise<SandboxExportDocument> {
    const descriptor = await (kind === 'html'
      ? this.sandboxService.describeHtml(src, noteRelativePath)
      : this.sandboxService.describeInteractive(src, noteRelativePath))

    if (descriptor.permissionStatus !== 'allowed') {
      throw new Error(
        `Sandbox ${descriptor.resolvedPath} is not approved (status=${descriptor.permissionStatus}); exports only include content the user has already allowed in the app.`
      )
    }

    const document =
      kind === 'html'
        ? await this.sandboxService.loadHtml(
            src,
            noteRelativePath,
            descriptor.contentHash,
            'export-instance'
          )
        : await this.sandboxService.loadInteractive(
            src,
            noteRelativePath,
            descriptor.contentHash,
            'export-instance',
            props
          )

    let srcdoc = document.srcDoc

    if (kind === 'interactive' && descriptor.manifest.permissions.filesystem) {
      srcdoc = inlineDatasetBridge({
        srcdoc,
        datasets,
        manifest: descriptor.manifest
      })
    }

    if (kind === 'html' && descriptor.manifest.fallback) {
      // For HTML sandboxes, append the fallback as a friendly placeholder if
      // the document failed to render. We don't auto-swap since the rendered
      // body is what the user expects.
      void fallbackDataUri
      void fallbackCaption
    }

    return {
      srcdoc,
      manifestName: descriptor.manifest.name,
      resolvedPath: descriptor.resolvedPath,
      contentHash: descriptor.contentHash
    }
  }

  async resolveFallbackDataUri(
    src: string,
    noteRelativePath: string | null
  ): Promise<string | null> {
    const normalized = normalizeReference(src, noteRelativePath)
    if (!normalized) {
      return null
    }

    const extension = extname(normalized).toLowerCase()
    if (extension !== '.png') {
      return null
    }

    const absolutePath = safeJoin(this.vaultRootPath, normalized)
    try {
      const buffer = await readFile(absolutePath)
      return `data:image/png;base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  }
}

function inlineDatasetBridge({
  srcdoc,
  datasets,
  manifest
}: {
  srcdoc: string
  datasets: Map<string, InlinedAsset>
  manifest: SandboxManifest
}): string {
  const allowed = new Set(manifest.permissions.dataPaths)
  const inlineEntries: Array<{ path: string; dataUri: string }> = []

  for (const [path, asset] of datasets.entries()) {
    if (!allowed.has(path)) {
      continue
    }
    inlineEntries.push({ path, dataUri: asset.dataUri })
  }

  if (inlineEntries.length === 0) {
    return srcdoc
  }

  // Patch the bootstrap script so that `mdxVault.requestData` resolves from
  // the inline dataset registry when no parent is reachable (which is always
  // the case in a standalone export file).
  const registryJson = JSON.stringify(inlineEntries).replaceAll('</', '<\\/')

  const registryScript = `
<script>
(function () {
  var registry = ${registryJson};
  var map = {};
  for (var i = 0; i < registry.length; i += 1) {
    map[registry[i].path] = registry[i].dataUri;
  }
  if (window.mdxVault && typeof window.mdxVault.requestData === 'function') {
    var originalRequestData = window.mdxVault.requestData;
    window.mdxVault = Object.freeze(Object.assign({}, window.mdxVault, {
      requestData: function (path) {
        if (Object.prototype.hasOwnProperty.call(map, path)) {
          return Promise.resolve(atob(map[path].split(',')[1]));
        }
        return originalRequestData(path);
      }
    }));
  }
})();
</script>`

  // Insert the registry script before the runtime script that uses
  // window.mdxVault.requestData.
  const anchor = '<script>\n'
  if (srcdoc.includes(anchor)) {
    return srcdoc.replace(anchor, `${registryScript}\n${anchor}`)
  }

  return srcdoc.replace('</body>', `${registryScript}\n</body>`)
}

function normalizeReference(source: string, noteRelativePath: string | null): string | null {
  const trimmed = source.trim().replaceAll('\\', '/')
  if (!trimmed) {
    return null
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('/')) {
    return null
  }

  const baseDirectory =
    trimmed.startsWith('.') && noteRelativePath
      ? pathPosix.dirname(noteRelativePath.replaceAll('\\', '/'))
      : ''
  const resolved = pathPosix.normalize(baseDirectory ? `${baseDirectory}/${trimmed}` : trimmed)
  const clean = resolved.replace(/^\.\//, '')
  if (clean === '..' || clean.startsWith('../')) {
    return null
  }
  return clean
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

// Re-export for use in the writer that emits the final `<iframe>`.
export { SANDBOX_CSP }

// Allow callers to resolve a vault path inside the export working dir without
// exposing sandbox-service internals.
export function joinVaultPath(vaultRoot: string, relativePath: string): string {
  return join(vaultRoot, relativePath.replaceAll('/', pathPosix.sep))
}
