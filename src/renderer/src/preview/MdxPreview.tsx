import { evaluate } from '@mdx-js/mdx'
import { Highlighter } from 'lucide-react'
import type { MDXContent } from 'mdx/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { ErrorBoundary } from 'react-error-boundary'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { Button } from '@/components/ui/button'
import type { ReadingZoomWheelInput } from '@/hooks/useReadingZoom'
import { shouldHandleReadingWheelZoom } from '@/input/physical-modifier'
import { cn } from '@/lib/utils'
import type { IndexedNoteSummary } from '@/vault/types'
import { remarkCallouts } from '../../../shared/remark-callouts'
import { remarkMarks } from '../../../shared/remark-mark'
import { remarkWikilink } from '../../../shared/remark-wikilink'
import { createMdxComponents } from './mdx-components'
import { applyPreviewHighlight, type PreviewHighlightSelection } from './preview-highlight'
import { PreviewImageCache } from './preview-image'
import { isInteractiveNoteTheme, readPreviewMetadata } from './preview-metadata'
import { normalizeReadingWheelDelta } from './reading-zoom'
import { rehypePreviewSourceMap } from './rehype-preview-source-map'
import { PreviewRuntimeContext } from './runtime'
import { rehypeSafeHtml } from './safe-html'
import './interactive-note-theme.css'

interface MdxPreviewProps {
  source: string
  selectedPath: string | null
  readingZoomFactor: number
  notes: IndexedNoteSummary[]
  revealHeadingRequest?: {
    position: number
    requestId: number
  } | null
  onNavigate: (relativePath: string) => void
  onRevealLine: (line: number) => void
  isDarwin: boolean
  isPhysicalZoomModifierDown: () => boolean
  onReadingZoomWheel: (input: ReadingZoomWheelInput) => void
  onSourceChange: (source: string) => void
}

interface PreviewDiagnostic {
  message: string
  line?: number
  column?: number
  source?: string
  ruleId?: string
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
  onSourceChange
}: MdxPreviewProps): React.JSX.Element {
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const previewContentRef = useRef<HTMLDivElement | null>(null)
  const readingZoomLiveLayerRef = useRef<HTMLDivElement | null>(null)
  const [Content, setContent] = useState<MDXContent | null>(null)
  const [compileError, setCompileError] = useState<PreviewDiagnostic | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const [previewSelection, setPreviewSelection] = useState<PreviewTextSelection | null>(null)
  const imageCache = useMemo(() => new PreviewImageCache(), [selectedPath])
  const components = useMemo(
    () => createMdxComponents({ notes, onNavigate, selectedPath, imageCache }),
    [notes, onNavigate, selectedPath, imageCache]
  )
  const previewMetadata = useMemo(() => readPreviewMetadata(source), [source])
  const runtimeValue = useMemo(() => ({ selectedPath }), [selectedPath])
  const activeSelection = previewSelection?.source === source ? previewSelection : null

  useEffect(() => () => imageCache.dispose(), [imageCache])

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
    let isCancelled = false

    const timer = window.setTimeout(() => {
      setIsCompiling(true)

      void compileMdx(source)
        .then((content) => {
          if (isCancelled) {
            return
          }

          setContent(() => content)
          setCompileError(null)
        })
        .catch((error: unknown) => {
          if (isCancelled) {
            return
          }

          setContent(null)
          setCompileError(createDiagnostic(error))
        })
        .finally(() => {
          if (!isCancelled) {
            setIsCompiling(false)
          }
        })
    }, 300)

    return () => {
      isCancelled = true
      window.clearTimeout(timer)
    }
  }, [source])

  useEffect(() => {
    if (!revealHeadingRequest) {
      return
    }

    const scrollRoot = scrollRootRef.current
    const headings = scrollRoot?.querySelectorAll<HTMLElement>(
      '.mdx-preview h1, .mdx-preview h2, .mdx-preview h3, .mdx-preview h4, .mdx-preview h5, .mdx-preview h6'
    )
    const target = headings?.[revealHeadingRequest.position]

    if (target) {
      target.scrollIntoView({ block: 'start' })
    }
  }, [Content, revealHeadingRequest])

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
      className="h-full min-h-0 overflow-x-hidden overflow-y-auto bg-background"
      role="region"
      aria-label="Reading preview"
    >
      <span className="sr-only" aria-live="polite">
        {isCompiling ? 'Compiling preview' : 'Preview ready'}
      </span>
      <div className="mx-auto w-full max-w-[820px]">
        <div
          ref={previewContentRef}
          data-reading-zoom={readingZoomFactor}
          className={cn(
            'mdx-preview px-5 py-10 sm:px-8',
            isInteractiveNoteTheme(previewMetadata.frontmatter) && 'theme-interactive-note'
          )}
          style={{ zoom: readingZoomFactor, width: `${100 / readingZoomFactor}%` }}
          onMouseUp={capturePreviewSelection}
        >
          <div ref={readingZoomLiveLayerRef} data-reading-zoom-live-layer="true">
            <PreviewWarnings warnings={previewMetadata.warnings} />
            <FrontmatterPropertiesBlock properties={previewMetadata.frontmatter} />
            {compileError ? (
              <ErrorPanel
                title="MDX compile error"
                diagnostic={compileError}
                onRevealLine={onRevealLine}
              />
            ) : Content ? (
              <ErrorBoundary
                resetKeys={[source]}
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
      {activeSelection ? (
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
              activeSelection.markStart === undefined ? 'Highlight selection' : 'Remove highlight'
            }
            aria-label={
              activeSelection.markStart === undefined ? 'Highlight selection' : 'Remove highlight'
            }
            onMouseDown={(event) => event.preventDefault()}
            onClick={togglePreviewHighlight}
          >
            <Highlighter className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

async function compileMdx(source: string): Promise<MDXContent> {
  if (!source.trim()) {
    return function EmptyMdxContent() {
      return <div className="text-sm text-muted-foreground">Empty note.</div>
    }
  }

  // GOAL-01 trust boundary: evaluate() runs only for content from a user-opened vault.
  // GOAL-03/05 must replace this with a stricter registry/sandbox model for untrusted code.
  const mdxModule = await evaluate(source, {
    Fragment,
    jsx,
    jsxs,
    baseUrl: import.meta.url,
    remarkPlugins: [
      remarkGfm,
      remarkMath,
      remarkFrontmatter,
      remarkWikilink,
      remarkMarks,
      remarkCallouts
    ],
    rehypePlugins: [
      [rehypePreviewSourceMap, { source }],
      rehypeSafeHtml,
      rehypeKatex,
      [rehypeHighlight, { plainText: ['mermaid'] }]
    ]
  })

  return mdxModule.default
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
    <div className="mb-4 border-2 border-destructive bg-destructive/10 p-3 text-sm">
      <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-destructive">
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
      <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        Properties
      </div>
      <dl className="grid gap-x-4 gap-y-2 font-mono text-[12px] sm:grid-cols-[7rem_minmax(0,1fr)]">
        {entries.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="font-bold text-[var(--editorial-red)]">{key}</dt>
            <dd className="min-w-0 break-words text-[var(--editorial-blue)]">
              {formatPropertyValue(value)}
            </dd>
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
    <div className="border-2 border-destructive bg-destructive/5 p-4 text-sm shadow-[3px_3px_0_0_var(--destructive)]">
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
          <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {location}
          </div>
        ) : null}
      </div>
      {diagnostic.source || diagnostic.ruleId ? (
        <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
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
