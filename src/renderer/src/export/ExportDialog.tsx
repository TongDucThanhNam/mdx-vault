import { Download, Globe, Sparkles, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export type ExportMode = 'static' | 'interactive'

export interface ExportScanResult {
  noteRelativePath: string
  noteTitle: string
  usedComponents: string[]
  sandboxIslands: Array<{
    kind: 'html' | 'interactive'
    src: string
    resolvedPath: string
    manifestName: string
    permissionStatus: 'allowed' | 'denied' | 'prompt'
    fallback?: string
  }>
  imageAssets: string[]
  datasetAssets: string[]
  wikilinkTargets: string[]
}

export interface ExportRunResult {
  size: number
  warnings: string[]
  sandboxSkipped: Array<{ resolvedPath: string; reason: string }>
}

export type ExportProgressEvent =
  | { phase: 'scan'; message: string }
  | { phase: 'render'; message: string }
  | { phase: 'bundle'; message: string }
  | { phase: 'inline'; message: string }
  | { phase: 'leak-check' }
  | { phase: 'write' }
  | { phase: 'done'; size: number }
  | { phase: 'error'; code: string; message: string }
  | { phase: 'size-warning'; totalBytes: number; thresholdBytes: number }

export interface ExportApi {
  scan: (noteRelativePath: string) => Promise<ExportScanResult>
  pickTarget: (input: {
    noteRelativePath: string
    mode: ExportMode
    defaultFileName: string
  }) => Promise<{ absolutePath: string } | null>
  run: (input: {
    noteRelativePath: string
    mode: ExportMode
    target: { absolutePath: string }
    confirmedOversized?: boolean
  }) => Promise<ExportRunResult>
  onProgress: (callback: (event: ExportProgressEvent) => void) => () => void
}

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  noteRelativePath: string | null
  noteTitle: string
}

interface ResolvedTarget {
  absolutePath: string
}

type DialogState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'ready'; scan: ExportScanResult; target: ResolvedTarget | null }
  | { kind: 'running'; mode: ExportMode }
  | {
      kind: 'size-warning'
      mode: ExportMode
      totalBytes: number
      target: ResolvedTarget
      scan: ExportScanResult
    }
  | { kind: 'done'; result: ExportRunResult; target: ResolvedTarget }
  | { kind: 'error'; message: string }

export function ExportDialog({
  open,
  onOpenChange,
  noteRelativePath,
  noteTitle
}: ExportDialogProps): React.JSX.Element | null {
  const [mode, setMode] = useState<ExportMode>('interactive')
  const [state, setState] = useState<DialogState>({ kind: 'idle' })
  const [latestProgress, setLatestProgress] = useState<ExportProgressEvent | null>(null)

  const api = useMemo<ExportApi | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }
    return window.exportApi ?? null
  }, [])

  const defaultFileName = useMemo(() => {
    if (!noteRelativePath) {
      return `${noteTitle}.html`
    }
    return `${noteRelativePath.replace(/\.(md|mdx)$/i, '')}.html`
  }, [noteRelativePath, noteTitle])

  useEffect(() => {
    if (!open || !noteRelativePath || !api) {
      return
    }
    let cancelled = false
    // Kicked off by IPC; the result is handled in the promises below.
    setState({ kind: 'scanning' })
    setLatestProgress(null)
    void api
      .scan(noteRelativePath)
      .then((scan) => {
        if (cancelled) return
        setState({ kind: 'ready', scan, target: null })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({ kind: 'error', message: formatError(error) })
      })
    return () => {
      cancelled = true
    }
  }, [api, noteRelativePath, open])

  useEffect(() => {
    if (!api) {
      return
    }
    const dispose = api.onProgress((event) => {
      setLatestProgress(event)
      if (event.phase === 'error') {
        setState({ kind: 'error', message: event.message })
      }
    })
    return () => dispose()
  }, [api])

  const chooseTarget = useCallback(async () => {
    if (!api || !noteRelativePath) {
      return
    }
    try {
      const result = await api.pickTarget({
        noteRelativePath,
        mode,
        defaultFileName
      })
      if (!result) {
        return
      }
      setState((current) => {
        if (current.kind === 'ready') {
          return { ...current, target: { absolutePath: result.absolutePath } }
        }
        if (current.kind === 'done') {
          return { ...current, target: { absolutePath: result.absolutePath } }
        }
        if (current.kind === 'size-warning') {
          return { ...current, target: { absolutePath: result.absolutePath } }
        }
        return current
      })
    } catch (error) {
      setState({ kind: 'error', message: formatError(error) })
    }
  }, [api, defaultFileName, mode, noteRelativePath])

  const runExport = useCallback(
    async (target: ResolvedTarget, confirmedOversized = false) => {
      if (!api || !noteRelativePath) {
        return
      }
      setState({ kind: 'running', mode })
      setLatestProgress(null)
      try {
        const result = await api.run({
          noteRelativePath,
          mode,
          target,
          confirmedOversized
        })
        setState({ kind: 'done', result, target })
      } catch (error) {
        setState({ kind: 'error', message: formatError(error) })
      }
    },
    [api, mode, noteRelativePath]
  )

  const onRunClick = useCallback(() => {
    if (state.kind !== 'ready' || !noteRelativePath) {
      return
    }
    const target = state.target
    if (!target) {
      void chooseTarget()
      return
    }
    void runExport(target, false)
  }, [chooseTarget, noteRelativePath, runExport, state])

  const onConfirmOversized = useCallback(() => {
    if (state.kind !== 'size-warning') {
      return
    }
    void runExport(state.target, true)
  }, [runExport, state])

  if (!open) {
    return null
  }

  const ready = state.kind === 'ready' || state.kind === 'done'
  const scan = state.kind === 'ready' || state.kind === 'size-warning' ? state.scan : null
  const running = state.kind === 'running'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <Download className="mr-2 inline size-4" aria-hidden="true" />
            Export note
          </DialogTitle>
          <DialogDescription>{noteTitle}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              mode="static"
              current={mode}
              icon={<Globe className="size-4" aria-hidden="true" />}
              title="Static HTML"
              description="Prose + snapshots + sandbox fallbacks. No scripts for trusted islands."
              onSelect={setMode}
            />
            <ModeButton
              mode="interactive"
              current={mode}
              icon={<Sparkles className="size-4" aria-hidden="true" />}
              title="Interactive HTML"
              description="Single self-contained file. Trusted islands hydrate; sandbox stays in iframe."
              onSelect={setMode}
            />
          </div>

          {state.kind === 'scanning' ? (
            <div className="text-xs text-muted-foreground">Scanning note…</div>
          ) : null}

          {scan ? <ScanSummary scan={scan} /> : null}

          {state.kind === 'size-warning' ? (
            <SizeWarningBanner
              totalBytes={state.totalBytes}
              target={state.target.absolutePath}
              onConfirm={onConfirmOversized}
              onCancel={() =>
                setState({
                  kind: 'ready',
                  scan: state.scan,
                  target: state.target
                })
              }
            />
          ) : null}

          {state.kind === 'running' || state.kind === 'size-warning' ? (
            <ProgressLine event={latestProgress} />
          ) : null}

          {state.kind === 'done' ? <ResultPanel result={state.result} /> : null}

          {state.kind === 'error' ? <ErrorBanner message={state.message} /> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={!ready || running} onClick={onRunClick}>
            <Download className="size-4" aria-hidden="true" />
            {running
              ? 'Exporting…'
              : state.kind === 'done'
                ? 'Export again'
                : 'Choose file & export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeButton({
  mode,
  current,
  icon,
  title,
  description,
  onSelect
}: {
  mode: ExportMode
  current: ExportMode
  icon: React.ReactNode
  title: string
  description: string
  onSelect: (mode: ExportMode) => void
}): React.JSX.Element {
  const isSelected = current === mode
  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      className={`border-2 border-foreground p-3 text-left transition-colors ${
        isSelected
          ? 'bg-foreground text-background'
          : 'bg-background text-foreground hover:bg-foreground hover:text-background'
      }`}
      aria-pressed={isSelected}
    >
      <div className="flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-wider">
        {icon}
        {title}
      </div>
      <div className="mt-1 font-mono text-[11px] uppercase tracking-wider opacity-70">
        {description}
      </div>
    </button>
  )
}

function ScanSummary({ scan }: { scan: ExportScanResult }): React.JSX.Element {
  const totalIslands = scan.sandboxIslands.length
  const unapprovedIslands = scan.sandboxIslands.filter(
    (entry) => entry.permissionStatus !== 'allowed'
  )

  return (
    <div className="border-2 border-foreground bg-muted/30 p-3 text-sm">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        Note contents
      </div>
      <ul className="mt-2 space-y-1 font-mono text-[11px]">
        <li>
          <strong>{scan.usedComponents.length}</strong> registry component
          {scan.usedComponents.length === 1 ? '' : 's'}: {scan.usedComponents.join(', ') || 'none'}
        </li>
        <li>
          <strong>{totalIslands}</strong> sandbox island{totalIslands === 1 ? '' : 's'}
          {unapprovedIslands.length > 0 ? (
            <span className="ml-1 inline-flex items-center gap-1 font-bold uppercase text-destructive">
              <TriangleAlert className="size-3" aria-hidden="true" />
              {unapprovedIslands.length} not approved
            </span>
          ) : null}
        </li>
        <li>
          <strong>{scan.imageAssets.length}</strong> image asset
          {scan.imageAssets.length === 1 ? '' : 's'}; <strong>{scan.datasetAssets.length}</strong>{' '}
          dataset{scan.datasetAssets.length === 1 ? '' : 's'}
        </li>
        <li>
          <strong>{scan.wikilinkTargets.length}</strong> wikilink target
          {scan.wikilinkTargets.length === 1 ? '' : 's'} (resolved in note, not exported)
        </li>
      </ul>
    </div>
  )
}

function ProgressLine({ event }: { event: ExportProgressEvent | null }): React.JSX.Element | null {
  if (!event) {
    return null
  }
  let label: string = event.phase
  if ('message' in event && typeof event.message === 'string') {
    label = `${event.phase}: ${event.message}`
  } else if (event.phase === 'done') {
    label = `done · ${formatBytes(event.size)}`
  } else if (event.phase === 'size-warning') {
    label = `size-warning: ${formatBytes(event.totalBytes)}`
  }
  return (
    <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
  )
}

function ResultPanel({ result }: { result: ExportRunResult }): React.JSX.Element {
  return (
    <div className="border-2 border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)] p-3 text-sm">
      <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--success)]">
        Exported · {formatBytes(result.size)}
      </div>
      {result.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1 pl-5 font-mono text-[11px] text-foreground/80">
          {result.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {result.sandboxSkipped.length > 0 ? (
        <ul className="mt-2 space-y-1 pl-5 font-mono text-[11px] text-muted-foreground">
          {result.sandboxSkipped.map((entry, index) => (
            <li key={index}>
              Skipped {entry.resolvedPath} — {entry.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="border-2 border-destructive bg-destructive/10 p-3 font-mono text-[12px] uppercase tracking-wider text-destructive">
      {message}
    </div>
  )
}

function SizeWarningBanner({
  totalBytes,
  target,
  onConfirm,
  onCancel
}: {
  totalBytes: number
  target: string
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <div className="border-2 border-destructive bg-destructive/10 p-3 text-sm">
      <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-destructive">
        <TriangleAlert className="size-4" aria-hidden="true" />
        Inlined assets are large ({formatBytes(totalBytes)})
      </div>
      <p className="mt-1 font-mono text-[11px] text-foreground/80">
        The export will embed assets as base64 data URIs. Files over 25 MB are blocked entirely.
        Continue?
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={onConfirm}>
          Export anyway
        </Button>
      </div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{target}</div>
    </div>
  )
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
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}
