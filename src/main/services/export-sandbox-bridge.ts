import { readFile, realpath } from 'fs/promises'
import { extname, isAbsolute, posix as pathPosix, relative, resolve } from 'path'

import type { SandboxManifest } from '../../shared/sandbox'
import { safeJoin } from './safe-path'
import type { SandboxService } from './sandbox-service'

export interface SandboxExportOptions {
  kind: 'html' | 'interactive'
  src: string
  noteRelativePath: string | null
  instanceId: string
  props: Record<string, unknown>
}

export interface SandboxExportDocument {
  srcdoc: string
  manifestName: string
  manifest: SandboxManifest
  resolvedPath: string
  contentHash: string
}

const fallbackMimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
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
    instanceId,
    props
  }: SandboxExportOptions): Promise<SandboxExportDocument> {
    const descriptor = await this.describe(kind, src, noteRelativePath)

    if (descriptor.permissionStatus !== 'allowed') {
      throw new Error(
        `Sandbox is not approved for this content hash (status=${descriptor.permissionStatus}).`
      )
    }
    if (descriptor.manifest.permissions.network) {
      throw new Error('Sandbox requests network access and cannot run in an offline export.')
    }

    const document =
      kind === 'html'
        ? await this.sandboxService.loadHtml(
            src,
            noteRelativePath,
            descriptor.contentHash,
            instanceId
          )
        : await this.sandboxService.loadInteractive(
            src,
            noteRelativePath,
            descriptor.contentHash,
            instanceId,
            props
          )

    return {
      srcdoc: document.srcDoc,
      manifestName: descriptor.manifest.name,
      manifest: descriptor.manifest,
      resolvedPath: descriptor.resolvedPath,
      contentHash: descriptor.contentHash
    }
  }

  async resolveFallbackDataUri({
    fallback,
    resolvedPath,
    kind
  }: {
    fallback: string
    resolvedPath: string
    kind: 'html' | 'interactive'
  }): Promise<string | null> {
    const normalized = normalizeFallbackReference(fallback)
    if (!normalized) return null

    const islandRoot = kind === 'html' ? pathPosix.dirname(resolvedPath) : resolvedPath
    const fallbackRelativePath = pathPosix.normalize(`${islandRoot}/${normalized}`)
    if (fallbackRelativePath === islandRoot || !fallbackRelativePath.startsWith(`${islandRoot}/`)) {
      return null
    }

    const mimeType = fallbackMimeTypes[extname(fallbackRelativePath).toLowerCase()]
    if (!mimeType) return null

    const absoluteRoot = safeJoin(this.vaultRootPath, islandRoot)
    const absoluteFallback = safeJoin(this.vaultRootPath, fallbackRelativePath)

    try {
      const [realRoot, realFallback] = await Promise.all([
        realpath(absoluteRoot),
        realpath(absoluteFallback)
      ])
      const fromRoot = relative(resolve(realRoot), resolve(realFallback))
      if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) return null
      const buffer = await readFile(realFallback)
      return `data:${mimeType};base64,${buffer.toString('base64')}`
    } catch {
      return null
    }
  }
}

function normalizeFallbackReference(source: string): string | null {
  const trimmed = source.trim().replaceAll('\\', '/')
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('/')) {
    return null
  }
  const clean = pathPosix.normalize(trimmed).replace(/^\.\//, '')
  if (clean === '..' || clean.startsWith('../')) return null
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
