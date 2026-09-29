import { Highlighter } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ErrorBoundary } from 'react-error-boundary'

import { resolveActiveHeadingFromViewport } from '@/components/layout/living-outline'
import { Button } from '@/components/ui/button'
import type { ReadingZoomWheelInput } from '@/hooks/useReadingZoom'
import { shouldHandleReadingWheelZoom } from '@/input/physical-modifier'
import { cn } from '@/lib/utils'
import type { IndexedNoteSummary } from '@/vault/types'
import type { WikilinkSubpath } from '../../../shared/wikilinks'
import { createMdxComponents } from './mdx-components'
import { usePagePreviewSettings } from './page-preview-settings'
import { sourceOffsetToLine } from './preview-anchor'
import { applyPreviewHighlight, type PreviewHighlightSelection } from './preview-highlight'
import { PreviewImageCache } from './preview-image'
import { isInteractiveNoteTheme, readPreviewFrontmatter } from './preview-metadata'
import { useReadingPaper } from './ReadingPaperContext'
import { revealReadingSourceOffset, topReadingSourceLine } from './reading-navigation'
import { normalizeReadingWheelDelta } from './reading-zoom'
import { PreviewRuntimeContext } from './runtime'
import { type PreviewDiagnostic, useLastGoodRender } from './useLastGoodRender'
import { useWikilinkPreview } from './useWikilinkPreview'
import { WikilinkPreviewLayer } from './WikilinkPreview'
import './interactive-note-theme.css'

interface MdxPreviewProps {
  source: string
  selectedPath: string | null
  readingZoomFactor: number
  notes: IndexedNoteSummary[]
  revealHeadingRequest?: {
    id: string
    position: number
    requestId: number
  } | null
  onNavigate: (relativePath: string, subpath?: WikilinkSubpath | null) => void
  onRevealLine: (line: number) => void
  isDarwin: boolean
  isPhysicalZoomModifierDown: () => boolean
  onReadingZoomWheel: (input: ReadingZoomWheelInput) => void
  onSourceChange: (source: string) => void
  onActiveHeadingChange?: (headingId: string | null) => void
  initialSourceOffset?: number | null
  onLeaveReading?: (line: number) => void
  onCompileStateChange?: (status: 'pending' | 'error' | 'ready') => void
}

interface PreviewTextSelection extends PreviewHighlightSelection {
  source: string
  left: number
  top: number
}

export function MdxPreview({
  source,
  selectedPath,
  readingZoomFactor,
  notes,
  revealHeadingRequest,
  onNavigate,
  onRevealLine,
  isDarwin,
  isPhysicalZoomModifierDown,
  onReadingZoomWheel,
  onSourceChange,
  onActiveHeadingChange,
  initialSourceOffset,
  onLeaveReading,
  onCompileStateChange
}: MdxPreviewProps): React.JSX.Element {
  const readingPaper = useReadingPaper()
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const previewContentRef = useRef<HTMLDivElement | null>(null)
  const readingZoomLiveLayerRef = useRef<HTMLDivElement | null>(null)
  const onActiveHeadingChangeRef = useRef(onActiveHeadingChange)
  const render = useLastGoodRender(selectedPath ?? '', source)
  const [previewSelection, setPreviewSelection] = useState<PreviewTextSelection | null>(null)
  const leavingRef = useRef({ source: render.renderedSource, onLeaveReading })
  leavingRef.current = { source: render.renderedSource, onLeaveReading }
  const initialAnchorAppliedRef = useRef(false)
  const imageCache = useMemo(() => new PreviewImageCache(), [selectedPath])
  const pagePreviewSettings = usePagePreviewSettings()
  const wikilinkPreview = useWikilinkPreview(pagePreviewSettings)
  const componentInputsRef = useRef({
    onNavigate,
    onRevealLine,
    requestPreview: wikilinkPreview.requestPreview,
    scheduleDismiss: wikilinkPreview.scheduleDismiss,
    renderedSource: render.renderedSource
  })
  componentInputsRef.current = {
    onNavigate,
    onRevealLine,
    requestPreview: wikilinkPreview.requestPreview,
    scheduleDismiss: wikilinkPreview.scheduleDismiss,
    renderedSource: render.renderedSource
  }
  const navigateFromComponent = useCallback<MdxPreviewProps['onNavigate']>(
    (...args) => componentInputsRef.current.onNavigate(...args),
    []
  )
  const revealFromComponent = useCallback<MdxPreviewProps['onRevealLine']>(
    (line) => componentInputsRef.current.onRevealLine(line),
    []
  )
  const requestComponentPreview = useCallback<typeof wikilinkPreview.requestPreview>(
    (intent) => componentInputsRef.current.requestPreview(intent),
    []
  )
  const dismissComponentPreview = useCallback<typeof wikilinkPreview.scheduleDismiss>(
    (target) => componentInputsRef.current.scheduleDismiss(target),
    []
  )
  const renderedComponentSource = useCallback(() => componentInputsRef.current.renderedSource, [])
  const components = useMemo(
    () =>
      createMdxComponents({
        notes,
        onNavigate: navigateFromComponent,
        selectedPath,
        imageCache,
        source: renderedComponentSource,
        onRevealLine: revealFromComponent,
        onPreviewRequest: requestComponentPreview,
        onPreviewDismiss: dismissComponentPreview
      }),
    [
      notes,
      navigateFromComponent,
      selectedPath,
      imageCache,
      renderedComponentSource,
      revealFromComponent,
      requestComponentPreview,
      dismissComponentPreview
    ]
  )
  const previewFrontmatter = useMemo(
    () => readPreviewFrontmatter(render.renderedSource),
    [render.renderedSource]
  )
  const runtimeValue = useMemo(() => ({ selectedPath }), [selectedPath])
  const activeSelection = previewSelection?.source === source ? previewSelection : null
  const activePreview = render.result
  const Content = activePreview?.Content ?? null
  const compileError = render.failure

  useEffect(() => () => imageCache.dispose(), [imageCache])

  useEffect(() => {
    onActiveHeadingChangeRef.current = onActiveHeadingChange
  }, [onActiveHeadingChange])

  useEffect(() => {
    const scrollRoot = scrollRootRef.current
    if (!scrollRoot) {
      return
    }

    const handleWheel = (event: WheelEvent): void => {
      if (
        !shouldHandleReadingWheelZoom({
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          isDarwin,
          physicalModifierDown: isPhysicalZoomModifierDown()
        })
      ) {
        return
      }

      event.preventDefault()
      const pixelDeltaY = normalizeReadingWheelDelta(
        event.deltaY,
        event.deltaMode,
        scrollRoot.clientHeight
      )

      const liveLayer = readingZoomLiveLayerRef.current
      if (pixelDeltaY !== 0 && liveLayer) {
        onReadingZoomWheel({
          pixelDeltaY,
          clientX: event.clientX,
          clientY: event.clientY,
          scrollRoot,
          liveLayer
        })
      }
    }

    scrollRoot.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      scrollRoot.removeEventListener('wheel', handleWheel)
    }
  }, [isDarwin, isPhysicalZoomModifierDown, onReadingZoomWheel])

  useEffect(() => {
    onCompileStateChange?.(render.pending ? 'pending' : render.hasError ? 'error' : 'ready')
  }, [onCompileStateChange, render.hasError, render.pending])

  useLayoutEffect(() => {
    const root = scrollRootRef.current
    return () => {
      const { source: lastSource, onLeaveReading: notify } = leavingRef.current
      if (root && notify) {
        const line = topReadingSourceLine(root, lastSource)
        if (line !== null) notify(line)
      }
    }
  }, [])

  useLayoutEffect(() => {
    const root = scrollRootRef.current
    if (!root || !Content) return
    root.dataset.previewLayoutReady = 'true'
    const pendingTop = root.dataset.pendingRestoreTop
    if (pendingTop !== undefined) {
      root.scrollTop = Number(pendingTop)
      root.scrollLeft = Number(root.dataset.pendingRestoreLeft ?? 0)
      delete root.dataset.pendingRestoreTop
      delete root.dataset.pendingRestoreLeft
      initialAnchorAppliedRef.current = true
    } else if (
      !initialAnchorAppliedRef.current &&
      initialSourceOffset !== null &&
      initialSourceOffset !== undefined
    ) {
      revealReadingSourceOffset(root, initialSourceOffset)
      initialAnchorAppliedRef.current = true
    }
  }, [Content, initialSourceOffset])

  useEffect(() => {
    if (!revealHeadingRequest) {
      return
    }

    const scrollRoot = scrollRootRef.current
    const headings = scrollRoot?.querySelectorAll<HTMLElement>('[data-mdx-heading-id]')
    const target =
      [...(headings ?? [])].find(
        (heading) => heading.dataset.mdxHeadingId === revealHeadingRequest.id
      ) ?? headings?.[revealHeadingRequest.position]

    if (target) {
      target.scrollIntoView({ block: 'start' })
    }
  }, [Content, revealHeadingRequest])

  useEffect(() => {
    const scrollRoot = scrollRootRef.current
    const headingElements = [
      ...(scrollRoot?.querySelectorAll<HTMLElement>('[data-mdx-heading-id]') ?? [])
    ]

    if (!scrollRoot || headingElements.length === 0) {
      onActiveHeadingChangeRef.current?.(null)
      return
    }

    let frameId: number | null = null
    const updateActiveHeading = (): void => {
      frameId = null
      const rootRect = scrollRoot.getBoundingClientRect()
      const activationTop = rootRect.top + Math.min(72, rootRect.height * 0.12)
      const activeId = resolveActiveHeadingFromViewport(
        headingElements.flatMap((element) => {
          const id = element.dataset.mdxHeadingId
          return id ? [{ id, top: element.getBoundingClientRect().top }] : []
        }),
        activationTop,
        scrollRoot.scrollTop + scrollRoot.clientHeight >= scrollRoot.scrollHeight - 2
      )
      onActiveHeadingChangeRef.current?.(activeId)
    }
    const scheduleUpdate = (): void => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(updateActiveHeading)
    }
    const observer = new IntersectionObserver(scheduleUpdate, {
      root: scrollRoot,
      rootMargin: '-8% 0px -78% 0px',
      threshold: [0, 1]
    })
    const resizeObserver = new ResizeObserver(scheduleUpdate)

    headingElements.forEach((element) => {
      observer.observe(element)
    })
    resizeObserver.observe(scrollRoot)
    scrollRoot.addEventListener('scroll', scheduleUpdate, { passive: true })
    scheduleUpdate()

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      observer.disconnect()
      resizeObserver.disconnect()
      scrollRoot.removeEventListener('scroll', scheduleUpdate)
    }
  }, [Content])

  const capturePreviewSelection = (): void => {
    const previewRoot = previewContentRef.current
    setPreviewSelection(previewRoot ? readPreviewSelection(source, previewRoot) : null)
  }

  const togglePreviewHighlight = (): void => {
    if (!activeSelection) {
      return
    }

    const nextSource = applyPreviewHighlight(source, activeSelection)
    if (!nextSource) {
      setPreviewSelection(null)
      return
    }

    window.getSelection()?.removeAllRanges()
    setPreviewSelection(null)
    onSourceChange(nextSource)
  }

  if (!selectedPath) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
        Select a note to preview.
      </div>
    )
  }

  return (
    <div
      ref={scrollRootRef}
      data-testid="reading-preview-scroll"
      data-workbench-scroll-surface="true"
      data-preview-layout-surface="true"
      data-reading-paper={readingPaper}
      tabIndex={-1}
      className="note-editorial-surface h-full min-h-0 overflow-x-hidden overflow-y-auto transform-[translateZ(0)]"
      role="region"
      aria-label="Reading preview"
    >
      <span className="sr-only" aria-live="polite">
        {render.pending
          ? 'Compiling preview'
          : render.hasError
            ? 'Preview compile error'
            : 'Preview ready'}
      </span>
      <div className="mx-auto w-full max-w-[820px]">
        <div
          ref={previewContentRef}
          data-reading-zoom={readingZoomFactor}
          data-reading-paper={readingPaper}
          className={cn(
            'mdx-preview theme-editorial-note px-5 py-10 sm:px-8',
            isInteractiveNoteTheme(previewFrontmatter) && 'theme-interactive-note'
          )}
          style={{ zoom: readingZoomFactor, width: `${100 / readingZoomFactor}%` }}
          onMouseUp={capturePreviewSelection}
          onClick={(event) => {
            if (
              !event.altKey ||
              (event.target instanceof Element &&
                event.target.closest('a, button, input, textarea, select'))
            )
              return
            const target =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>('[data-preview-block-start]')
                : null
            const offset = Number(target?.dataset.previewBlockStart)
            if (target && Number.isInteger(offset) && offset >= 0) {
              event.preventDefault()
              onRevealLine(sourceOffsetToLine(render.renderedSource, offset))
            }
          }}
        >
          <div ref={readingZoomLiveLayerRef} data-reading-zoom-live-layer="true">
            {render.pending && Content ? (
              <div className="sticky top-2 z-10 h-0 text-right">
                <span
                  role="status"
                  className="inline-block border-l-2 border-[var(--note-accent)] bg-[var(--note-paper)] px-2 py-1 font-mono text-xs uppercase tracking-wider"
                >
                  Updating reading view
                </span>
              </div>
            ) : null}
            {compileError && Content ? (
              <div className="sticky top-0 z-20 mb-6">
                <div
                  role="alert"
                  className="mdx-compile-error-bar flex items-start gap-3 border-2 border-[var(--note-ink)] bg-[var(--note-paper-muted)] px-3 py-2 font-mono text-xs"
                >
                  <span className="min-w-0 flex-1 break-words">
                    Compile error · {compileError.message}
                  </span>
                  <div className="flex shrink-0 items-start gap-2">
                    {compileError.line ? (
                      <button
                        type="button"
                        className="mdx-compile-error-action"
                        onClick={() => onRevealLine(compileError.line ?? 1)}
                      >
                        Line {compileError.line}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="mdx-compile-error-action"
                      aria-label="Dismiss compile error"
                      onClick={render.dismissFailure}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <PreviewWarnings warnings={activePreview?.warnings ?? []} />
            <FrontmatterPropertiesBlock properties={previewFrontmatter} />
            {compileError && !Content ? (
              <ErrorPanel
                title="MDX compile error"
                diagnostic={compileError}
                onRevealLine={onRevealLine}
              />
            ) : Content ? (
              <ErrorBoundary
                resetKeys={[render.renderedSource]}
                fallbackRender={({ error }) => (
                  <ErrorPanel title="MDX runtime error" diagnostic={createDiagnostic(error)} />
                )}
              >
                <PreviewRuntimeContext.Provider value={runtimeValue}>
                  <Content components={components} />
                </PreviewRuntimeContext.Provider>
              </ErrorBoundary>
            ) : (
              <div className="font-mono text-[12px] uppercase tracking-wider text-muted-foreground">
                Preparing preview.
              </div>
            )}
          </div>
        </div>
      </div>
      {activeSelection
        ? createPortal(
            <div
              role="toolbar"
              aria-label="Preview text formatting"
              className="fixed z-[70] -translate-x-1/2 -translate-y-full border-2 border-foreground bg-background p-1 shadow-[3px_3px_0_0_var(--foreground)]"
              style={{ left: activeSelection.left, top: activeSelection.top }}
            >
              <Button
                type="button"
                size="icon-sm"
                variant="default"
                data-testid="preview-highlight-toggle"
                title={
                  activeSelection.markStart === undefined
                    ? 'Highlight selection'
                    : 'Remove highlight'
                }
                aria-label={
                  activeSelection.markStart === undefined
                    ? 'Highlight selection'
                    : 'Remove highlight'
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={togglePreviewHighlight}
              >
                <Highlighter className="size-4" aria-hidden="true" />
              </Button>
            </div>,
            document.body
          )
        : null}
      <WikilinkPreviewLayer
        preview={wikilinkPreview.activePreview}
        onNavigate={onNavigate}
        onRetain={wikilinkPreview.retainPreview}
        onDismiss={wikilinkPreview.dismissPreview}
        onScheduleDismiss={wikilinkPreview.scheduleDismiss}
      />
    </div>
  )
}

function readPreviewSelection(
  source: string,
  previewRoot: HTMLElement
): PreviewTextSelection | null {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) {
    return null
  }

  const range = selection.getRangeAt(0)
  if (
    !previewRoot.contains(range.commonAncestorContainer) ||
    range.startContainer !== range.endContainer ||
    range.startContainer.nodeType !== Node.TEXT_NODE
  ) {
    return null
  }

  const sourceSpan = findSourceSpan(range.startContainer)
  const sourceStart = readDataOffset(sourceSpan, 'previewSourceStart')
  const sourceEnd = readDataOffset(sourceSpan, 'previewSourceEnd')

  if (
    !sourceSpan ||
    sourceStart === null ||
    sourceEnd === null ||
    sourceEnd - sourceStart !== (range.startContainer.textContent?.length ?? -1)
  ) {
    return null
  }

  const start = sourceStart + range.startOffset
  const end = sourceStart + range.endOffset
  const selectedText = source.slice(start, end)

  if (
    start >= end ||
    selectedText !== selection.toString() ||
    selectedText.trim() !== selectedText ||
    selectedText.includes('\n')
  ) {
    return null
  }

  const mark = sourceSpan.closest<HTMLElement>(
    'mark[data-preview-mark-start][data-preview-mark-end]'
  )
  const markStart = readDataOffset(mark, 'previewMarkStart')
  const markEnd = readDataOffset(mark, 'previewMarkEnd')

  if (
    mark &&
    (markStart === null ||
      markEnd === null ||
      source.slice(markStart, markStart + 2) !== '==' ||
      source.slice(markEnd - 2, markEnd) !== '==')
  ) {
    return null
  }

  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return null
  }

  return {
    source,
    start,
    end,
    left: Math.min(Math.max(rect.left + rect.width / 2, 28), window.innerWidth - 28),
    top: Math.max(rect.top - 8, 48),
    ...(markStart !== null && markEnd !== null ? { markStart, markEnd } : {})
  }
}

function findSourceSpan(node: Node): HTMLElement | null {
  return (
    node.parentElement?.closest<HTMLElement>(
      'span[data-preview-source-start][data-preview-source-end]'
    ) ?? null
  )
}

function readDataOffset(element: HTMLElement | null, key: string): number | null {
  const value = element?.dataset[key]
  if (value === undefined) {
    return null
  }

  const offset = Number(value)
  return Number.isInteger(offset) && offset >= 0 ? offset : null
}

function PreviewWarnings({
  warnings
}: {
  warnings: Array<{ message: string; line?: number }>
}): React.JSX.Element | null {
  if (warnings.length === 0) {
    return null
  }

  return (
    <div className="mb-4 border-2 border-destructive bg-background p-3 text-sm">
      <div className="font-mono text-xs font-bold uppercase tracking-wider text-destructive">
        Note warning
      </div>
      <ul className="mt-2 space-y-1 pl-5 text-xs text-foreground/80">
        {warnings.map((warning, index) => (
          <li key={`${warning.line ?? 'note'}-${index}`}>
            {warning.line ? `Line ${warning.line}: ` : null}
            {warning.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FrontmatterPropertiesBlock({
  properties
}: {
  properties: Record<string, unknown>
}): React.JSX.Element | null {
  const entries = Object.entries(properties).filter(([, value]) => value !== undefined)

  if (entries.length === 0) {
    return null
  }

  return (
    <section className="mdx-frontmatter-properties mb-10 overflow-x-auto border-2 border-foreground bg-paper-dark px-5 py-4 text-sm">
      <div className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
        Properties
      </div>
      <dl className="grid gap-x-4 gap-y-2 font-mono text-[12px] sm:grid-cols-[7rem_minmax(0,1fr)]">
        {entries.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="font-bold text-[var(--editorial-red)]">{key}</dt>
            <dd className="min-w-0 break-words text-foreground">{formatPropertyValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ErrorPanel({
  title,
  diagnostic,
  onRevealLine
}: {
  title: string
  diagnostic: PreviewDiagnostic
  onRevealLine?: (line: number) => void
}): React.JSX.Element {
  const location =
    diagnostic.line !== undefined
      ? `Line ${diagnostic.line}${diagnostic.column !== undefined ? `:${diagnostic.column}` : ''}`
      : null

  return (
    <div className="border-2 border-destructive bg-background p-4 text-sm shadow-[3px_3px_0_0_var(--destructive)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[12px] font-bold uppercase tracking-wider text-destructive">
          {title}
        </div>
        {location && onRevealLine ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onRevealLine(diagnostic.line ?? 1)}
          >
            {location}
          </Button>
        ) : location ? (
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {location}
          </div>
        ) : null}
      </div>
      {diagnostic.source || diagnostic.ruleId ? (
        <div className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {[diagnostic.source, diagnostic.ruleId].filter(Boolean).join(' / ')}
        </div>
      ) : null}
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-2 border-foreground bg-background p-3 font-mono text-xs text-foreground">
        {diagnostic.message}
      </pre>
    </div>
  )
}

function createDiagnostic(error: unknown): PreviewDiagnostic {
  if (error instanceof Error) {
    return {
      message: error.message,
      line: readNumberProperty(error, 'line'),
      column: readNumberProperty(error, 'column'),
      source: readStringProperty(error, 'source'),
      ruleId: readStringProperty(error, 'ruleId')
    }
  }

  return {
    message: String(error)
  }
}

function readNumberProperty(error: Error, key: string): number | undefined {
  const value = (error as unknown as Record<string, unknown>)[key]

  return typeof value === 'number' ? value : undefined
}

function readStringProperty(error: Error, key: string): string | undefined {
  const value = (error as unknown as Record<string, unknown>)[key]

  return typeof value === 'string' && value.trim() ? value : undefined
}

function formatPropertyValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatPropertyValue(item)).join(', ')
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value)
  }

  if (value === null) {
    return 'null'
  }

  return String(value)
}
