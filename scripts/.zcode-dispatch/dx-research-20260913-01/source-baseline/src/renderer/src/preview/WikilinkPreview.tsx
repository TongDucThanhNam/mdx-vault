import { ArrowUpRight, FileText, LoaderCircle, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import { KNOWLEDGE_PREVIEW_CACHE_SIZE } from '../../../shared/knowledge'
import { formatWikilinkSubpath, type WikilinkSubpath } from '../../../shared/wikilinks'
import { SafeHoverPreviewDocument } from './hover-preview-document'
import type { ActiveWikilinkPreview } from './useWikilinkPreview'
import { resolveWikilinkPreviewPosition } from './wikilink-preview-position'

interface HoverPreviewLoadState {
  path: string
  status: 'loading' | 'ready' | 'error'
  source?: string
  message?: string
}

interface CachedPreviewSource {
  contentHash: string
  source: string
}

export function WikilinkPreviewLayer({
  preview,
  onNavigate,
  onRetain,
  onDismiss,
  onScheduleDismiss
}: {
  preview: ActiveWikilinkPreview | null
  onNavigate: (relativePath: string, subpath?: WikilinkSubpath | null) => void
  onRetain: () => void
  onDismiss: () => void
  onScheduleDismiss: (relatedTarget?: EventTarget | null) => void
}): React.JSX.Element | null {
  const sourceCacheRef = useRef(new Map<string, CachedPreviewSource>())
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [loadState, setLoadState] = useState<HoverPreviewLoadState | null>(null)
  const path = preview?.note.relativePath ?? null
  const contentHash = preview?.note.contentHash ?? null
  const subpath = preview?.subpath ?? null

  useEffect(() => {
    if (!path || !contentHash) {
      setLoadState(null)
      return
    }

    const cached = sourceCacheRef.current.get(path)
    if (cached?.contentHash === contentHash) {
      setLoadState({ path, status: 'ready', source: cached.source })
      return
    }

    let active = true
    setLoadState({ path, status: 'loading' })

    void window.vaultApi
      .readFile(path)
      .then((source) => {
        if (!active) {
          return
        }

        rememberPreviewSource(sourceCacheRef.current, path, { contentHash, source })
        setLoadState({ path, status: 'ready', source })
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadState({ path, status: 'error', message: formatPreviewError(error) })
        }
      })

    return () => {
      active = false
    }
  }, [path, contentHash])

  useEffect(() => {
    if (!preview) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onDismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [preview, onDismiss])

  useEffect(() => {
    if (!path || loadState?.status !== 'ready') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const scrollArea = scrollAreaRef.current
      const target = subpath
        ? scrollArea?.querySelector<HTMLElement>('[data-hover-preview-target="true"]')
        : null

      if (scrollArea) {
        scrollArea.scrollTo({
          top: target ? Math.max(0, target.offsetTop - 16) : 0
        })
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [subpath, loadState?.status, path])

  const position = useMemo(
    () =>
      preview
        ? resolveWikilinkPreviewPosition(preview.anchorRect, {
            width: window.innerWidth,
            height: window.innerHeight
          })
        : null,
    [preview]
  )

  if (!preview || !position) {
    return null
  }

  const currentState =
    loadState?.path === preview.note.relativePath
      ? loadState
      : { path: preview.note.relativePath, status: 'loading' as const }

  return createPortal(
    <aside
      data-wikilink-preview-layer="true"
      role="dialog"
      aria-label={`Page preview: ${preview.note.title}`}
      className="fixed z-[80] flex max-h-[min(480px,calc(100vh-24px))] flex-col overflow-hidden border-2 border-foreground bg-popover text-popover-foreground shadow-[var(--shadow-hard)]"
      style={{ left: position.left, top: position.top, width: position.width }}
      onPointerEnter={onRetain}
      onPointerLeave={(event) => onScheduleDismiss(event.relatedTarget)}
      onFocusCapture={onRetain}
      onBlurCapture={(event) => onScheduleDismiss(event.relatedTarget)}
    >
      <header className="flex shrink-0 items-start gap-3 border-b-2 border-foreground bg-[var(--paper-dark)] px-4 py-3">
        <span
          className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center border-2 border-foreground bg-background shadow-[2px_2px_0_var(--foreground)]"
          aria-hidden="true"
        >
          <FileText className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--editorial-red)]">
            Page preview
          </div>
          <h2 className="truncate font-display text-[17px] font-bold leading-tight">
            {preview.note.title}
          </h2>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {preview.note.relativePath}
          </p>
          {preview.subpath ? (
            <p className="truncate font-mono text-[10px] font-bold text-[var(--editorial-red)]">
              {formatWikilinkSubpath(preview.subpath)}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          title={`Open ${preview.note.title}`}
          aria-label={`Open ${preview.note.title}`}
          onClick={() => {
            onDismiss()
            onNavigate(preview.note.relativePath, preview.subpath)
          }}
        >
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          title="Close page preview"
          aria-label="Close page preview"
          onClick={onDismiss}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </header>
      <div ref={scrollAreaRef} className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
        {currentState.status === 'loading' ? (
          <div
            role="status"
            className="flex min-h-36 items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading note
          </div>
        ) : currentState.status === 'error' ? (
          <div role="alert" className="border-l-4 border-destructive pl-3">
            <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-destructive">
              Preview unavailable
            </div>
            <p className="mt-1 font-serif text-sm text-muted-foreground">{currentState.message}</p>
          </div>
        ) : (
          <HoverPreviewContent source={currentState.source ?? ''} subpath={preview.subpath} />
        )}
      </div>
      <footer className="shrink-0 border-t border-border bg-[var(--paper-dark)] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
        Static preview · Interactive content is paused
      </footer>
    </aside>,
    document.body
  )
}

function HoverPreviewContent({
  source,
  subpath
}: {
  source: string
  subpath: WikilinkSubpath | null
}): React.JSX.Element {
  try {
    return (
      <div className="mdx-preview mdx-hover-preview theme-editorial-note">
        <SafeHoverPreviewDocument source={source} subpath={subpath} />
      </div>
    )
  } catch (error) {
    return (
      <div role="alert" className="border-l-4 border-destructive pl-3">
        <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-destructive">
          Preview unavailable
        </div>
        <p className="mt-1 font-serif text-sm text-muted-foreground">{formatPreviewError(error)}</p>
      </div>
    )
  }
}

function rememberPreviewSource(
  cache: Map<string, CachedPreviewSource>,
  path: string,
  value: CachedPreviewSource
): void {
  cache.delete(path)
  cache.set(path, value)

  while (cache.size > KNOWLEDGE_PREVIEW_CACHE_SIZE) {
    const oldestPath = cache.keys().next().value
    if (typeof oldestPath !== 'string') {
      break
    }
    cache.delete(oldestPath)
  }
}

function formatPreviewError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
