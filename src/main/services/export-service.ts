import { writeFile } from 'fs/promises'
import matter from 'gray-matter'
import { basename, dirname, extname, posix as pathPosix } from 'path'

import {
  EXPORT_HARD_LIMIT_BYTES,
  EXPORT_SIZE_WARNING_THRESHOLD_BYTES,
  type ExportProgressEvent,
  type ExportRunPayload,
  type ExportRunResult,
  type ExportScanResult
} from '../../shared/export'
import { AssetCollector } from './export-asset-collector'
import { RegistryBundler } from './export-bundler'
import { scanForLeaks } from './export-leak-check'
import { parseNoteForExport } from './export-renderer'
import { SandboxExportBridge } from './export-sandbox-bridge'
import { StaticSnapshotRenderer } from './export-static-snapshot'
import { HYDRATION_SCRIPT, renderExportTemplate } from './export-template'
import { safeJoin } from './safe-path'
import type { VaultService } from './vault-service'

export type ExportProgressListener = (event: ExportProgressEvent) => void

interface ResolvedSandbox {
  src: string
  resolvedPath: string
  kind: 'html' | 'interactive'
  manifestName: string
  permissionStatus: 'allowed' | 'denied' | 'prompt'
  fallback?: string
}

interface InternalScanResult extends ExportScanResult {
  frontmatter: Record<string, unknown>
  bodyHtml: string
}

const DEFAULT_PROPS_BY_COMPONENT: Record<string, () => string> = {
  Counter: () => JSON.stringify({ initial: 0 }),
  QuizBlock: () =>
    JSON.stringify({
      question: 'Which invariant makes binary search valid?',
      options: ['The input is sorted', 'The input is random', 'The array has no duplicates'],
      answerIndex: 0,
      explanation: 'Binary search can discard half of the search space only when ordering is known.'
    }),
  EquationSlider: () =>
    JSON.stringify({
      formula: 'y = m * x + b',
      compute: 'm * x + b',
      variables: {
        x: { min: -10, max: 10, default: 2, step: 0.5 },
        m: { min: -5, max: 5, default: 1.5, step: 0.1 },
        b: { min: -10, max: 10, default: 1, step: 0.5 }
      }
    }),
  DataChart: () =>
    JSON.stringify({
      type: 'line',
      data: [
        { x: 1, y: 3 },
        { x: 2, y: 5 },
        { x: 3, y: 2 },
        { x: 4, y: 8 },
        { x: 5, y: 6 }
      ],
      x: 'x',
      y: 'y',
      title: 'Sample dataset'
    }),
  AlgorithmVisualizer: () =>
    JSON.stringify({
      algorithm: 'binary-search',
      data: [1, 3, 4, 8, 12, 15, 20],
      target: 12,
      speed: 700
    })
}

export class ExportService {
  private readonly vault: VaultService

  private readonly assetCollector: AssetCollector

  private readonly registryBundler: RegistryBundler

  private readonly staticSnapshotRenderer: StaticSnapshotRenderer

  private readonly sandboxBridge: SandboxExportBridge

  constructor(vault: VaultService, sandboxBridge: SandboxExportBridge) {
    this.vault = vault
    this.assetCollector = new AssetCollector(vault)
    this.registryBundler = new RegistryBundler()
    this.staticSnapshotRenderer = new StaticSnapshotRenderer()
    this.sandboxBridge = sandboxBridge
  }

  async scan(noteRelativePath: string): Promise<ExportScanResult> {
    const result = await this.runScan(noteRelativePath, false)
    return result
  }

  async run(payload: ExportRunPayload, emit: ExportProgressListener): Promise<ExportRunResult> {
    const scan = await this.runScan(payload.noteRelativePath, true, emit)

    if (payload.mode === 'static') {
      return this.runStatic(scan, payload, emit)
    }

    return this.runInteractive(scan, payload, emit)
  }

  private async runScan(
    noteRelativePath: string,
    emitEvents: boolean,
    emit?: ExportProgressListener
  ): Promise<InternalScanResult> {
    if (emitEvents) {
      emit?.({ phase: 'scan', message: `Reading ${noteRelativePath}` })
    }

    const source = await this.vault.readFile(noteRelativePath)
    const frontmatter = readFrontmatter(source)
    const parsed = parseNoteForExport(
      source,
      noteRelativePath,
      deriveTitle(frontmatter, noteRelativePath)
    )

    const sandboxResolver = new SandboxResolver(this.sandboxBridge)
    const sandboxIslands = await sandboxResolver.resolveAll(
      parsed.meta.sandboxIslands,
      noteRelativePath
    )

    const meta: ExportScanResult = {
      ...parsed.meta,
      sandboxIslands
    }

    return {
      ...meta,
      frontmatter,
      bodyHtml: parsed.bodyHtml
    }
  }

  private async runStatic(
    scan: InternalScanResult,
    payload: ExportRunPayload,
    emit: ExportProgressListener
  ): Promise<ExportRunResult> {
    emit({ phase: 'render', message: 'Rendering static snapshots' })

    const placeholders = collectPlaceholders(scan.bodyHtml)
    const componentNameMap = namePlaceholders(
      placeholders,
      scan.usedComponents,
      scan.sandboxIslands
    )

    let bodyHtml = scan.bodyHtml
    for (const placeholder of placeholders) {
      const componentName = componentNameMap.get(placeholder.id)
      const replacement = this.renderStaticReplacement({
        componentName,
        sandbox: placeholder.kind === 'sandbox' ? placeholder.sandbox : undefined
      })
      bodyHtml = replacePlaceholder(bodyHtml, placeholder.id, replacement)
    }

    emit({ phase: 'inline', message: 'Inlining assets' })

    const assets = await this.assetCollector.collect({
      imageSources: scan.imageAssets,
      datasetSources: scan.datasetAssets,
      noteRelativePath: payload.noteRelativePath
    })
    bodyHtml = inlineImages(bodyHtml, assets.images)

    if (!payload.confirmedOversized && assets.totalBytes > EXPORT_SIZE_WARNING_THRESHOLD_BYTES) {
      emit({
        phase: 'size-warning',
        totalBytes: assets.totalBytes,
        thresholdBytes: -EXPORT_SIZE_WARNING_THRESHOLD_BYTES
      })
    }

    if (assets.totalBytes > EXPORT_HARD_LIMIT_BYTES) {
      throw new ExportError('EXPORT_TOO_LARGE', 'Inlined assets exceed the export hard limit')
    }

    const html = renderExportTemplate({
      title: scan.noteTitle,
      bodyHtml,
      frontmatter: scan.frontmatter
    })

    emit({ phase: 'leak-check' })
    const leaks = scanForLeaks({ vault: this.vault, content: html })
    if (leaks.length > 0) {
      throw new ExportError(
        'EXPORT_LEAK_DETECTED',
        `Leak scan blocked the export (rules: ${[...new Set(leaks.map((entry) => entry.rule))].join(', ')})`
      )
    }

    emit({ phase: 'write' })
    await writeFile(payload.target.absolutePath, html, 'utf8')

    const stats = await import('node:fs/promises').then((module) =>
      module.stat(payload.target.absolutePath)
    )
    emit({ phase: 'done', size: stats.size })

    return {
      size: stats.size,
      warnings: [
        ...assets.warnings,
        ...(assets.totalBytes > EXPORT_SIZE_WARNING_THRESHOLD_BYTES
          ? [
              `Inlined assets total ${formatBytes(assets.totalBytes)} — consider external hosting for large datasets.`
            ]
          : [])
      ],
      sandboxSkipped: scan.sandboxIslands
        .filter((entry) => entry.permissionStatus !== 'allowed')
        .map((entry) => ({
          resolvedPath: entry.resolvedPath || entry.src,
          reason: `permission_status:${entry.permissionStatus}`
        }))
    }
  }

  private async runInteractive(
    scan: InternalScanResult,
    payload: ExportRunPayload,
    emit: ExportProgressListener
  ): Promise<ExportRunResult> {
    emit({ phase: 'render', message: 'Rendering placeholder prose' })

    let bodyHtml = scan.bodyHtml

    emit({ phase: 'bundle', message: 'Bundling registry islands' })

    const bundleResult = await this.registryBundler.bundle({
      usedComponents: scan.usedComponents
    })

    const placeholders = collectPlaceholders(bodyHtml)
    const componentNameMap = namePlaceholders(
      placeholders,
      scan.usedComponents,
      scan.sandboxIslands
    )

    for (const placeholder of placeholders) {
      const componentName = componentNameMap.get(placeholder.id)

      if (placeholder.kind === 'registry' && componentName) {
        const propsJson = DEFAULT_PROPS_BY_COMPONENT[componentName]?.() ?? '{}'
        const replacement = `<mdx-vault-component data-component="${escapeAttribute(componentName)}" data-props="${escapeAttribute(propsJson)}" data-mdx-component-id="${placeholder.id}"></mdx-vault-component>`
        bodyHtml = replacePlaceholder(bodyHtml, placeholder.id, replacement)
        continue
      }

      if (placeholder.kind === 'sandbox' && placeholder.sandbox) {
        try {
          const propsJson = placeholder.rawAttrs['data-props']
          const propsFromMdx: Record<string, unknown> = propsJson
            ? JSON.parse(decodeHtmlEntities(propsJson))
            : {}
          const document = await this.sandboxBridge.buildDocument({
            kind: placeholder.sandbox.kind,
            src: placeholder.sandbox.src,
            noteRelativePath: payload.noteRelativePath,
            props:
              placeholder.sandbox.kind === 'interactive'
                ? {
                    ...JSON.parse(
                      DEFAULT_PROPS_BY_COMPONENT[placeholder.sandbox.manifestName]?.() ?? '{}'
                    ),
                    ...propsFromMdx
                  }
                : {}
          })
          const escaped = escapeSrcDoc(document.srcdoc)
          const replacement = `<div class="mdx-vault-sandbox"><iframe class="mdx-vault-sandbox-frame" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${escaped}" title="${escapeAttribute(document.manifestName)}"></iframe></div>`
          bodyHtml = replacePlaceholder(bodyHtml, placeholder.id, replacement)
        } catch (error) {
          const reason = formatError(error)
          const fallbackUri = await this.sandboxBridge.resolveFallbackDataUri(
            placeholder.sandbox.fallback ?? '',
            payload.noteRelativePath
          )
          const fallbackReplacement = renderSandboxFallback(
            placeholder.sandbox,
            fallbackUri,
            reason
          )
          bodyHtml = replacePlaceholder(bodyHtml, placeholder.id, fallbackReplacement)
        }
        continue
      }

      // Unknown component / unknown sandbox — emit placeholder.
      const replacement = renderUnknownPlaceholder(componentName ?? 'Unknown')
      bodyHtml = replacePlaceholder(bodyHtml, placeholder.id, replacement)
    }

    emit({ phase: 'inline', message: 'Inlining assets' })

    const assets = await this.assetCollector.collect({
      imageSources: scan.imageAssets,
      datasetSources: scan.datasetAssets,
      noteRelativePath: payload.noteRelativePath
    })
    bodyHtml = inlineImages(bodyHtml, assets.images)

    if (!payload.confirmedOversized && assets.totalBytes > EXPORT_SIZE_WARNING_THRESHOLD_BYTES) {
      emit({
        phase: 'size-warning',
        totalBytes: assets.totalBytes,
        thresholdBytes: -EXPORT_SIZE_WARNING_THRESHOLD_BYTES
      })
    }

    if (assets.totalBytes > EXPORT_HARD_LIMIT_BYTES) {
      throw new ExportError('EXPORT_TOO_LARGE', 'Inlined assets exceed the export hard limit')
    }

    const html = renderExportTemplate({
      title: scan.noteTitle,
      bodyHtml,
      frontmatter: scan.frontmatter,
      hydrationScript: HYDRATION_SCRIPT,
      registryBundle: bundleResult.script
    })

    emit({ phase: 'leak-check' })
    const leaks = scanForLeaks({ vault: this.vault, content: html })
    if (leaks.length > 0) {
      throw new ExportError(
        'EXPORT_LEAK_DETECTED',
        `Leak scan blocked the export (rules: ${[...new Set(leaks.map((entry) => entry.rule))].join(', ')})`
      )
    }

    emit({ phase: 'write' })
    await writeFile(payload.target.absolutePath, html, 'utf8')

    const stats = await import('node:fs/promises').then((module) =>
      module.stat(payload.target.absolutePath)
    )
    emit({ phase: 'done', size: stats.size })

    return {
      size: stats.size,
      warnings: [
        ...assets.warnings,
        ...bundleResult.unknownComponents.map(
          (name) => `Unknown registry component: ${name} — rendered as placeholder.`
        ),
        ...(assets.totalBytes > EXPORT_SIZE_WARNING_THRESHOLD_BYTES
          ? [
              `Inlined assets total ${formatBytes(assets.totalBytes)} — consider external hosting for large datasets.`
            ]
          : [])
      ],
      sandboxSkipped: scan.sandboxIslands
        .filter((entry) => entry.permissionStatus !== 'allowed')
        .map((entry) => ({
          resolvedPath: entry.resolvedPath || entry.src,
          reason: `permission_status:${entry.permissionStatus}`
        }))
    }
  }

  private renderStaticReplacement({
    componentName,
    sandbox
  }: {
    componentName: string | undefined
    sandbox: ResolvedSandbox | undefined
  }): string {
    if (sandbox) {
      return `<div class="mdx-vault-snapshot-placeholder"><div class="mdx-vault-snapshot-placeholder-title">${escapeHtml(sandbox.manifestName || sandbox.src)}</div><div class="mdx-vault-snapshot-placeholder-body">Interactive sandbox content — open in mdx-vault for the full experience.</div></div>`
    }

    if (!componentName) {
      return `<div class="mdx-vault-snapshot-placeholder"><div class="mdx-vault-snapshot-placeholder-title">Unknown component</div></div>`
    }

    const result = this.staticSnapshotRenderer.render({ componentName, props: undefined })

    if (result.mode === 'snapshot') {
      return result.html
    }

    return result.html
  }
}

export class ExportError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ExportError'
    this.code = code
  }
}

class SandboxResolver {
  constructor(private readonly bridge: SandboxExportBridge) {}

  async resolveAll(
    rawIslands: ExportScanResult['sandboxIslands'],
    noteRelativePath: string
  ): Promise<ExportScanResult['sandboxIslands']> {
    const resolved: ExportScanResult['sandboxIslands'] = []

    for (const island of rawIslands) {
      try {
        const descriptor = await this.bridge.describe(island.kind, island.src, noteRelativePath)
        resolved.push({
          ...island,
          resolvedPath: descriptor.resolvedPath,
          manifestName: descriptor.manifest.name,
          permissionStatus: descriptor.permissionStatus,
          fallback: descriptor.manifest.fallback
        })
      } catch {
        resolved.push({
          ...island,
          resolvedPath: island.src,
          manifestName: '',
          permissionStatus: 'denied'
        })
      }
    }

    return resolved
  }
}

interface PlaceholderRef {
  id: string
  componentName: string | null
  kind: 'registry' | 'sandbox' | 'unknown'
  sandbox?: ResolvedSandbox
  /** Raw JSON attribute map extracted from the placeholder component tag. */
  rawAttrs: Record<string, string>
}

function collectPlaceholders(bodyHtml: string): PlaceholderRef[] {
  const placeholders: PlaceholderRef[] = []
  const regex = /<mdx-vault-component\b([^>]*)>/g

  let match: RegExpExecArray | null
  while ((match = regex.exec(bodyHtml)) !== null) {
    const rawAttrs = parseAttributes(match[1] ?? '')
    const id = rawAttrs[COMPONENT_PLACEHOLDER_ATTR]
    if (!id) {
      continue
    }
    const componentName = rawAttrs['data-component-name'] ?? null
    placeholders.push({ id, componentName, kind: 'unknown', rawAttrs })
  }
  return placeholders
}

function parseAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const regex = /([a-zA-Z_][a-zA-Z0-9_-]*)\s*=\s*"([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    attributes[match[1]] = match[2]
  }
  return attributes
}

function namePlaceholders(
  placeholders: PlaceholderRef[],
  _usedComponents: string[],
  sandboxIslands: ExportScanResult['sandboxIslands']
): Map<string, string> {
  const map = new Map<string, string>()
  let sandboxIndex = 0

  for (const placeholder of placeholders) {
    if (
      placeholder.componentName === 'SandboxedHTML' ||
      placeholder.componentName === 'Interactive'
    ) {
      if (sandboxIndex < sandboxIslands.length) {
        const sandbox = sandboxIslands[sandboxIndex]
        placeholder.kind = 'sandbox'
        placeholder.sandbox = {
          src: sandbox.src,
          resolvedPath: sandbox.resolvedPath,
          kind: sandbox.kind,
          manifestName: sandbox.manifestName,
          permissionStatus: sandbox.permissionStatus,
          fallback: sandbox.fallback
        }
        sandboxIndex += 1
        continue
      }
    }

    if (placeholder.componentName && componentNameRegex.test(placeholder.componentName)) {
      placeholder.kind = 'registry'
      map.set(placeholder.id, placeholder.componentName)
      continue
    }

    placeholder.kind = 'unknown'
  }

  return map
}

const componentNameRegex = /^[A-Z][A-Za-z0-9_]*$/

const COMPONENT_PLACEHOLDER_ATTR = 'data-mdx-component-id'

function replacePlaceholder(bodyHtml: string, id: string, replacement: string): string {
  const escapedId = escapeRegExp(id)
  const regex = new RegExp(
    `<mdx-vault-component[^>]*data-mdx-component-id="${escapedId}"[^>]*>([\\s\\S]*?)</mdx-vault-component>`,
    'g'
  )
  return bodyHtml.replace(regex, () => replacement)
}

function inlineImages(bodyHtml: string, images: Map<string, { dataUri: string }>): string {
  if (images.size === 0) {
    return bodyHtml
  }
  return bodyHtml.replace(/<img([^>]*?)src="([^"]+)"([^>]*)>/g, (full, before, src, after) => {
    const inlined = images.get(src)
    if (!inlined) {
      return full
    }
    return `<img${before}src="${escapeAttribute(inlined.dataUri)}"${after}>`
  })
}

function renderUnknownPlaceholder(componentName: string): string {
  return `<div class="mdx-vault-snapshot-placeholder"><div class="mdx-vault-snapshot-placeholder-title">${escapeHtml(componentName)}</div><div class="mdx-vault-snapshot-placeholder-body">Unknown component — rendered as placeholder.</div></div>`
}

function renderSandboxFallback(
  sandbox: ResolvedSandbox,
  fallbackDataUri: string | null,
  reason: string
): string {
  const title = escapeHtml(sandbox.manifestName || sandbox.src)
  const reasonEscaped = escapeHtml(reason)
  const caption = escapeHtml(
    `Interactive sandbox "${sandbox.manifestName || sandbox.src}" was not included: ${reason}`
  )
  if (fallbackDataUri) {
    return `<figure class="mdx-vault-sandbox-fallback"><img alt="${title}" src="${escapeAttribute(fallbackDataUri)}"><figcaption>${caption}</figcaption></figure>`
  }
  return `<div class="mdx-vault-snapshot-placeholder"><div class="mdx-vault-snapshot-placeholder-title">${title}</div><div class="mdx-vault-snapshot-placeholder-body">${caption} — reason: ${reasonEscaped}</div></div>`
}

function readFrontmatter(source: string): Record<string, unknown> {
  try {
    return matter(source).data
  } catch {
    return {}
  }
}

function deriveTitle(frontmatter: Record<string, unknown>, noteRelativePath: string): string {
  if (typeof frontmatter.title === 'string' && frontmatter.title.trim()) {
    return frontmatter.title.trim()
  }
  const stem = basename(noteRelativePath, extname(noteRelativePath))
  return stem
}

function decodeHtmlEntities(encoded: string): string {
  return encoded
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x22;/g, '"')
    .replace(/&#x27;/g, "'")
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

/**
 * Escape a string for use inside an `srcdoc` attribute value.
 * Unlike `escapeAttribute`, this preserves angle brackets so that the
 * embedded HTML document stays valid. Only `&` and `"` are escaped.
 */
function escapeSrcDoc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export const __internalTesting = {
  SandboxResolver,
  namePlaceholders,
  collectPlaceholders,
  replacePlaceholder,
  inlineImages,
  dirname,
  pathPosix,
  safeJoin
}

export function buildExportService(
  vault: VaultService,
  sandboxService: import('./sandbox-service').SandboxService
): ExportService {
  return new ExportService(vault, new SandboxExportBridge(sandboxService))
}
