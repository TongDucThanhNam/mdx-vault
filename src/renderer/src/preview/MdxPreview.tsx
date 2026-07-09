import { evaluate } from '@mdx-js/mdx'
import { ErrorBoundary } from 'react-error-boundary'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import type { MDXContent } from 'mdx/types'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { remarkCallouts } from '../../../shared/remark-callouts'
import { remarkMarks } from '../../../shared/remark-mark'
import { remarkWikilink } from '../../../shared/remark-wikilink'
import { createMdxComponents } from './mdx-components'
import { readPreviewMetadata } from './preview-metadata'
import { PreviewRuntimeContext } from './runtime'
import { rehypeSafeHtml } from './safe-html'
import type { IndexedNoteSummary } from '@/vault/types'

interface MdxPreviewProps {
  source: string
  selectedPath: string | null
  notes: IndexedNoteSummary[]
  revealHeadingRequest?: {
    position: number
    requestId: number
  } | null
  onNavigate: (relativePath: string) => void
  onRevealLine: (line: number) => void
}

interface PreviewDiagnostic {
  message: string
  line?: number
  column?: number
  source?: string
  ruleId?: string
}

export function MdxPreview({
  source,
  selectedPath,
  notes,
  revealHeadingRequest,
  onNavigate,
  onRevealLine
}: MdxPreviewProps): React.JSX.Element {
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const [Content, setContent] = useState<MDXContent | null>(null)
  const [compileError, setCompileError] = useState<PreviewDiagnostic | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)
  const components = useMemo(() => createMdxComponents({ notes, onNavigate }), [notes, onNavigate])
  const previewMetadata = useMemo(() => readPreviewMetadata(source), [source])
  const runtimeValue = useMemo(() => ({ selectedPath }), [selectedPath])

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

  if (!selectedPath) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
        Select a note to preview.
      </div>
    )
  }

  return (
    <div ref={scrollRootRef} className="h-full min-h-0 overflow-y-auto">
      <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b-2 border-foreground bg-background/95 px-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground backdrop-blur">
        <span className="truncate">{selectedPath}</span>
        <span className={isCompiling ? 'text-muted-foreground' : 'text-[var(--editorial-red)]'}>
          {isCompiling ? 'Compiling' : '● Live'}
        </span>
      </div>
      <div className="mdx-preview mx-auto max-w-3xl px-6 py-8">
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
    rehypePlugins: [rehypeSafeHtml, rehypeKatex, [rehypeHighlight, { plainText: ['mermaid'] }]]
  })

  return mdxModule.default
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
    <section className="mb-6 border-2 border-foreground bg-paper-dark p-3 text-sm shadow-[3px_3px_0_0_var(--foreground)]">
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
