import { randomUUID } from 'node:crypto'
import { rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'
import matter from 'gray-matter'

import { parseChartDataSource } from '../../renderer/src/preview/islands/chart-data'
import {
  EXPORT_HARD_LIMIT_BYTES,
  EXPORT_SIZE_WARNING_THRESHOLD_BYTES,
  type ExportDiagnostic,
  type ExportProgressEvent,
  type ExportRunPayload,
  type ExportRunResult,
  type ExportScanResult
} from '../../shared/export'
import { type AssetCollectionResult, AssetCollector } from './export-asset-collector'
import { RegistryBundler } from './export-bundler'
import type { ExportIrDocument, ExportIrNode, ExportIrSandboxNode } from './export-ir'
import { scanForLeaks } from './export-leak-check'
import { parseNoteForExport } from './export-renderer'
import { SandboxExportBridge } from './export-sandbox-bridge'
import { StaticSnapshotRenderer } from './export-static-snapshot'
import { renderExportTemplate } from './export-template'
import type { VaultService } from './vault-service'

export type ExportProgressListener = (event: ExportProgressEvent) => void

interface ResolvedSandboxDetail {
  nodeId: string
  src: string
  resolvedPath: string
  kind: 'html' | 'interactive'
  manifestName: string
  permissionStatus: 'allowed' | 'denied' | 'prompt'
  fallback?: string
  fallbackDataUri: string | null
  networkRequested: boolean
  dataPaths: string[]
}

interface InternalScanResult {
  scan: ExportScanResult
  frontmatter: Record<string, unknown>
  ir: ExportIrDocument
  assets: AssetCollectionResult
  approvedDatasets: Awaited<ReturnType<AssetCollector['collectApprovedDatasets']>>
  sandboxDetails: Map<string, ResolvedSandboxDetail>
}

interface SandboxRuntimePayload {
  nodeId: string
  instanceId: string
  title: string
  available: boolean
  srcdoc: string
  props: Record<string, unknown>
  datasets: Record<string, string>
  fallbackHtml: string
}

interface PreparedSandboxes {
  payloads: SandboxRuntimePayload[]
  fallbacks: Map<string, string>
  fallbacksUsed: string[]
}

export class ExportService {
  private readonly assetCollector: AssetCollector
  private readonly registryBundler = new RegistryBundler()
  private readonly staticSnapshotRenderer = new StaticSnapshotRenderer()

  constructor(
    private readonly vault: VaultService,
    private readonly sandboxBridge: SandboxExportBridge
  ) {
    this.assetCollector = new AssetCollector(vault)
  }

  async scan(noteRelativePath: string): Promise<ExportScanResult> {
    return (await this.runScan(noteRelativePath, false)).scan
  }

  async run(payload: ExportRunPayload, emit: ExportProgressListener): Promise<ExportRunResult> {
    const internal = await this.runScan(payload.noteRelativePath, true, emit)
    const blocking = internal.scan.diagnostics.filter((entry) => entry.severity === 'blocking')
    if (blocking.length > 0) {
      throw new ExportError('EXPORT_BLOCKED', formatBlockingDiagnostics(blocking))
    }

    emit({ phase: 'render', message: 'Rendering the authored component tree' })
    const ir = prepareIrAssets(internal.ir, internal.assets)
    const sandboxes = await this.prepareSandboxes(internal, payload.mode)
    const rendered = this.staticSnapshotRenderer.renderDocument({
      ir,
      mode: payload.mode,
      sandboxFallbacks: sandboxes.fallbacks
    })

    let registryBundle: string | undefined
    if (payload.mode === 'interactive') {
      emit({ phase: 'bundle', message: 'Bundling only the trusted components used by this note' })
      const bundle = await this.registryBundler.bundle({
        usedComponents: internal.scan.usedComponents
      })
      if (bundle.unknownComponents.length > 0) {
        throw new ExportError(
          'REGISTRY_POLICY_MISSING',
          `Export policy is missing for: ${bundle.unknownComponents.join(', ')}`
        )
      }
      registryBundle = bundle.script
    }

    emit({ phase: 'inline', message: 'Inlining local assets and offline runtime data' })
    const html = renderExportTemplate({
      title: internal.scan.noteTitle,
      bodyHtml: rendered.bodyHtml,
      registryBundle,
      interactiveNoteTheme: internal.frontmatter.theme === 'interactive-note',
      exportData:
        payload.mode === 'interactive'
          ? { roots: rendered.hydrationRoots, sandboxes: sandboxes.payloads }
          : undefined
    })

    const unresolved = findUnresolvedRuntimeDependencies(html)
    if (unresolved.length > 0) {
      throw new ExportError(
        'EXPORT_NOT_OFFLINE',
        `The generated file still contains ${unresolved.length} unresolved runtime subresource${unresolved.length === 1 ? '' : 's'}.`
      )
    }

    emit({ phase: 'leak-check' })
    const leaks = scanForLeaks({ vault: this.vault, content: html })
    if (leaks.length > 0) {
      throw new ExportError(
        'EXPORT_LEAK_DETECTED',
        `Leak scan blocked the export (rules: ${[...new Set(leaks.map((entry) => entry.rule))].join(', ')})`
      )
    }

    const finalSize = Buffer.byteLength(html, 'utf8')
    if (finalSize > EXPORT_HARD_LIMIT_BYTES) {
      throw new ExportError(
        'EXPORT_TOO_LARGE',
        `Final encoded export is ${formatBytes(finalSize)}, above the 25 MiB hard limit.`
      )
    }
    if (!payload.confirmedOversized && finalSize > EXPORT_SIZE_WARNING_THRESHOLD_BYTES) {
      emit({
        phase: 'size-warning',
        totalBytes: finalSize,
        thresholdBytes: EXPORT_SIZE_WARNING_THRESHOLD_BYTES
      })
      throw new ExportError(
        'EXPORT_SIZE_CONFIRMATION_REQUIRED',
        `Final encoded export is ${formatBytes(finalSize)}. Confirm the size warning to continue.`
      )
    }

    emit({ phase: 'write' })
    await writeAtomically(payload.target.absolutePath, html)
    emit({ phase: 'done', size: finalSize })

    const diagnosticWarnings = internal.scan.diagnostics
      .filter((entry) => entry.severity === 'warning')
      .map(formatDiagnostic)
    const sizeWarnings =
      finalSize > EXPORT_SIZE_WARNING_THRESHOLD_BYTES
        ? [`Final encoded file is ${formatBytes(finalSize)} (above the 5 MiB warning threshold).`]
        : []

    return {
      size: finalSize,
      warnings: [...diagnosticWarnings, ...sizeWarnings],
      fallbacksUsed: sandboxes.fallbacksUsed,
      sandboxSkipped: internal.scan.sandboxIslands
        .filter((entry) => entry.permissionStatus !== 'allowed' || entry.networkRequested)
        .map((entry) => ({
          resolvedPath: entry.resolvedPath || entry.src,
          reason: entry.networkRequested
            ? 'offline_network_policy'
            : `permission_status:${entry.permissionStatus}`
        }))
    }
  }

  private async runScan(
    noteRelativePath: string,
    emitEvents: boolean,
    emit?: ExportProgressListener
  ): Promise<InternalScanResult> {
    if (emitEvents) emit?.({ phase: 'scan', message: `Reading ${noteRelativePath}` })

    const source = await this.vault.readFile(noteRelativePath)
    const frontmatter = readFrontmatter(source)
    const parsed = parseNoteForExport(
      source,
      noteRelativePath,
      deriveTitle(frontmatter, noteRelativePath)
    )
    const diagnostics = [...parsed.meta.diagnostics]
    const { publicEntries, details } = await this.resolveSandboxes(
      parsed.meta.sandboxIslands,
      noteRelativePath,
      diagnostics
    )
    const assets = await this.assetCollector.collect({
      imageSources: parsed.meta.imageAssets,
      datasetSources: parsed.meta.datasetAssets,
      noteRelativePath
    })

    for (const skipped of assets.skipped) {
      const [, sourcePath = skipped] = skipped.split(':', 2)
      diagnostics.push({
        code: 'LOCAL_ASSET_UNAVAILABLE',
        severity: 'blocking',
        message: `Local export asset ${sourcePath} is missing, unsupported, oversized, or resolves outside the vault. Fix the path before exporting.`,
        modes: ['static', 'interactive']
      })
    }

    const approvedPaths = [...new Set([...details.values()].flatMap((entry) => entry.dataPaths))]
    const approvedDatasets = await this.assetCollector.collectApprovedDatasets(approvedPaths)
    for (const sourcePath of approvedDatasets.skipped) {
      diagnostics.push({
        code: 'SANDBOX_DATASET_UNAVAILABLE',
        severity: 'warning',
        message: `Approved sandbox dataset ${sourcePath} is unavailable; the island will use its explicit offline fallback.`,
        modes: ['static', 'interactive']
      })
    }

    return {
      scan: {
        ...parsed.meta,
        sandboxIslands: publicEntries,
        diagnostics: dedupeDiagnostics(diagnostics)
      },
      frontmatter,
      ir: parsed.ir,
      assets,
      approvedDatasets,
      sandboxDetails: details
    }
  }

  private async resolveSandboxes(
    rawIslands: ExportScanResult['sandboxIslands'],
    noteRelativePath: string,
    diagnostics: ExportDiagnostic[]
  ): Promise<{
    publicEntries: ExportScanResult['sandboxIslands']
    details: Map<string, ResolvedSandboxDetail>
  }> {
    const publicEntries: ExportScanResult['sandboxIslands'] = []
    const details = new Map<string, ResolvedSandboxDetail>()

    for (const island of rawIslands) {
      try {
        const descriptor = await this.sandboxBridge.describe(
          island.kind,
          island.src,
          noteRelativePath
        )
        const fallbackDataUri = descriptor.manifest.fallback
          ? await this.sandboxBridge.resolveFallbackDataUri({
              fallback: descriptor.manifest.fallback,
              resolvedPath: descriptor.resolvedPath,
              kind: island.kind
            })
          : null
        const detail: ResolvedSandboxDetail = {
          nodeId: island.nodeId,
          src: island.src,
          resolvedPath: descriptor.resolvedPath,
          kind: island.kind,
          manifestName: descriptor.manifest.name,
          permissionStatus: descriptor.permissionStatus,
          fallback: descriptor.manifest.fallback,
          fallbackDataUri,
          networkRequested: descriptor.manifest.permissions.network,
          dataPaths: descriptor.manifest.permissions.filesystem
            ? descriptor.manifest.permissions.dataPaths
            : []
        }
        details.set(island.nodeId, detail)
        publicEntries.push({
          ...island,
          resolvedPath: detail.resolvedPath,
          manifestName: detail.manifestName,
          permissionStatus: detail.permissionStatus,
          fallback: detail.fallback,
          fallbackAvailable: Boolean(fallbackDataUri),
          networkRequested: detail.networkRequested,
          dataPaths: detail.dataPaths
        })

        if (detail.permissionStatus !== 'allowed') {
          diagnostics.push({
            code: 'SANDBOX_NOT_APPROVED',
            severity: 'warning',
            message: `${detail.manifestName} is ${detail.permissionStatus}; export will show an explicit fallback until this content hash is approved in the app.`,
            line: island.line,
            nodeId: island.nodeId,
            componentName: island.kind === 'html' ? 'SandboxedHTML' : 'Interactive',
            modes: ['static', 'interactive']
          })
        }
        if (detail.networkRequested) {
          diagnostics.push({
            code: 'SANDBOX_NETWORK_OFFLINE',
            severity: 'warning',
            message: `${detail.manifestName} requests network access and will use an offline fallback instead of executing.`,
            line: island.line,
            nodeId: island.nodeId,
            modes: ['static', 'interactive']
          })
        }
        if (!fallbackDataUri) {
          diagnostics.push({
            code: 'SANDBOX_FALLBACK_CARD',
            severity: 'warning',
            message: `${detail.manifestName} has no valid local image fallback; static or unavailable modes will show a descriptive card.`,
            line: island.line,
            nodeId: island.nodeId,
            modes: ['static', 'interactive']
          })
        }
      } catch {
        const detail: ResolvedSandboxDetail = {
          nodeId: island.nodeId,
          src: island.src,
          resolvedPath: island.src,
          kind: island.kind,
          manifestName: 'Unavailable island',
          permissionStatus: 'denied',
          fallbackDataUri: null,
          networkRequested: false,
          dataPaths: []
        }
        details.set(island.nodeId, detail)
        publicEntries.push({
          ...island,
          resolvedPath: island.src,
          manifestName: detail.manifestName,
          permissionStatus: 'denied',
          fallbackAvailable: false,
          networkRequested: false,
          dataPaths: []
        })
        diagnostics.push({
          code: 'SANDBOX_UNAVAILABLE',
          severity: 'warning',
          message: `The island at line ${island.line ?? '?'} could not be resolved safely and will show a descriptive fallback card.`,
          line: island.line,
          nodeId: island.nodeId,
          modes: ['static', 'interactive']
        })
      }
    }

    return { publicEntries, details }
  }

  private async prepareSandboxes(
    internal: InternalScanResult,
    mode: 'static' | 'interactive'
  ): Promise<PreparedSandboxes> {
    const payloads: SandboxRuntimePayload[] = []
    const fallbacks = new Map<string, string>()
    const fallbacksUsed: string[] = []
    const sandboxNodes = collectSandboxNodes(internal.ir)

    for (const node of sandboxNodes) {
      const detail = internal.sandboxDetails.get(node.id)
      if (!detail) continue
      const staticReason = 'Interactive behavior is unavailable in a no-JavaScript export.'
      const fallbackHtml = renderSandboxFallback(detail, staticReason)

      if (mode === 'static') {
        fallbacks.set(node.id, fallbackHtml)
        fallbacksUsed.push(`${detail.manifestName}: static offline fallback`)
        continue
      }

      const missingDataset = detail.dataPaths.some(
        (path) => !internal.approvedDatasets.datasets.has(path)
      )
      const canRun =
        detail.permissionStatus === 'allowed' && !detail.networkRequested && !missingDataset
      const instanceId = randomUUID()
      const datasets = Object.fromEntries(
        detail.dataPaths.flatMap((path) => {
          const text = internal.approvedDatasets.datasets.get(path)?.text
          return text === undefined ? [] : [[path, text]]
        })
      )

      if (canRun) {
        try {
          const document = await this.sandboxBridge.buildDocument({
            kind: node.kind,
            src: node.src,
            noteRelativePath: internal.scan.noteRelativePath,
            instanceId,
            props: node.props
          })
          if (findSandboxRemoteRuntimeDependencies(document.srcdoc).length > 0) {
            throw new Error('Sandbox document contains a remote runtime dependency')
          }
          payloads.push({
            nodeId: node.id,
            instanceId,
            title: document.manifestName,
            available: true,
            srcdoc: document.srcdoc,
            props: node.props,
            datasets,
            fallbackHtml: ''
          })
          continue
        } catch {
          // A safe fallback is emitted below; raw sandbox errors never cross to the renderer/file.
        }
      }

      const unavailableReason = detail.networkRequested
        ? 'This island requires network access, which offline export does not grant.'
        : missingDataset
          ? 'A manifest-approved dataset is unavailable.'
          : detail.permissionStatus !== 'allowed'
            ? `This content hash is ${detail.permissionStatus}.`
            : 'The island could not be prepared safely.'
      const unavailableFallback = renderSandboxFallback(detail, unavailableReason)
      fallbacks.set(node.id, unavailableFallback)
      fallbacksUsed.push(`${detail.manifestName}: ${unavailableReason}`)
      payloads.push({
        nodeId: node.id,
        instanceId,
        title: detail.manifestName,
        available: false,
        srcdoc: '',
        props: node.props,
        datasets: {},
        fallbackHtml: unavailableFallback
      })
    }

    return { payloads, fallbacks, fallbacksUsed }
  }
}

export class ExportError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ExportError'
  }
}

function prepareIrAssets(ir: ExportIrDocument, assets: AssetCollectionResult): ExportIrDocument {
  const cloned = structuredClone(ir)

  walkIr(cloned.children, (node) => {
    if (
      node.type === 'element' &&
      node.tagName === 'img' &&
      typeof node.properties.src === 'string'
    ) {
      const image = assets.images.get(node.properties.src)
      if (image) node.properties.src = image.dataUri
    }

    if (
      node.type === 'component' &&
      node.name === 'DataChart' &&
      typeof node.props.src === 'string'
    ) {
      const source = node.props.src
      const dataset = assets.datasets.get(source)
      if (!dataset?.text) {
        throw new ExportError('DATASET_UNAVAILABLE', 'A DataChart dataset could not be embedded.')
      }
      try {
        node.props.data = parseChartDataSource(dataset.text, source)
        delete node.props.src
      } catch {
        throw new ExportError(
          'DATASET_INVALID',
          'A DataChart dataset is not valid CSV or JSON for the authored chart.'
        )
      }
    }
  })

  return cloned
}

function collectSandboxNodes(ir: ExportIrDocument): ExportIrSandboxNode[] {
  const nodes: ExportIrSandboxNode[] = []
  walkIr(ir.children, (node) => {
    if (node.type === 'sandbox') nodes.push(node)
  })
  return nodes
}

function walkIr(nodes: ExportIrNode[], visitNode: (node: ExportIrNode) => void): void {
  for (const node of nodes) {
    visitNode(node)
    if (node.type === 'element' || node.type === 'component') {
      walkIr(node.children, visitNode)
    }
  }
}

function renderSandboxFallback(detail: ResolvedSandboxDetail, reason: string): string {
  const title = escapeHtml(detail.manifestName)
  const caption = escapeHtml(`${detail.manifestName}: ${reason}`)
  if (detail.fallbackDataUri) {
    return `<figure class="mdx-vault-sandbox-fallback"><img alt="${title}" src="${escapeAttribute(detail.fallbackDataUri)}"><figcaption>${caption}</figcaption></figure>`
  }
  return `<div class="mdx-vault-snapshot-placeholder" role="note"><div class="mdx-vault-snapshot-placeholder-title">${title}</div><div class="mdx-vault-snapshot-placeholder-body">${escapeHtml(reason)}</div></div>`
}

async function writeAtomically(targetPath: string, content: string): Promise<void> {
  const tempPath = `${targetPath}.tmp-${process.pid}-${randomUUID()}`
  try {
    await writeFile(tempPath, content, 'utf8')
    await rename(tempPath, targetPath)
  } finally {
    await rm(tempPath, { force: true })
  }
}

function findUnresolvedRuntimeDependencies(html: string): string[] {
  const findings: string[] = []
  const tagPattern =
    /<(?:img|script|link|iframe|source|video|audio)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(html)) !== null) {
    const value = match[1] ?? ''
    if (!value.startsWith('data:') && !value.startsWith('blob:') && value !== 'about:blank') {
      findings.push(value)
    }
  }
  const cssPattern = /url\(\s*["']?(https?:|\/\/|file:|[A-Za-z]:[\\/])/gi
  if (cssPattern.test(html)) findings.push('stylesheet-url')
  return findings
}

function findSandboxRemoteRuntimeDependencies(srcdoc: string): string[] {
  const patterns = [
    /<(?:img|script|link|iframe|source|video|audio|form)\b[^>]*\b(?:src|href|action)\s*=\s*["'](?:https?:|\/\/)/gi,
    /url\(\s*["']?(?:https?:|\/\/)/gi,
    /\b(?:fetch|WebSocket|EventSource)\s*\(\s*["'](?:https?:|\/\/)/g
  ]
  return patterns.flatMap((pattern) => srcdoc.match(pattern) ?? [])
}

function dedupeDiagnostics(diagnostics: ExportDiagnostic[]): ExportDiagnostic[] {
  const seen = new Set<string>()
  return diagnostics.filter((entry) => {
    const key = `${entry.code}:${entry.line ?? ''}:${entry.nodeId ?? ''}:${entry.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatBlockingDiagnostics(diagnostics: ExportDiagnostic[]): string {
  const first = diagnostics[0]
  const location = first.line ? ` at line ${first.line}` : ''
  const remaining =
    diagnostics.length > 1 ? ` (${diagnostics.length - 1} more blocking issues)` : ''
  return `${first.message}${location}${remaining}`
}

function formatDiagnostic(diagnostic: ExportDiagnostic): string {
  return diagnostic.line ? `Line ${diagnostic.line}: ${diagnostic.message}` : diagnostic.message
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
  return basename(noteRelativePath, extname(noteRelativePath))
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const __internalTesting = {
  prepareIrAssets,
  collectSandboxNodes,
  findUnresolvedRuntimeDependencies,
  findSandboxRemoteRuntimeDependencies,
  writeAtomically,
  dirname
}

export function buildExportService(
  vault: VaultService,
  sandboxService: import('./sandbox-service').SandboxService
): ExportService {
  return new ExportService(vault, new SandboxExportBridge(sandboxService))
}
