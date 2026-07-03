import { evaluate } from '@mdx-js/mdx'
import { ErrorBoundary } from 'react-error-boundary'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import type { MDXContent } from 'mdx/types'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { useEffect, useState } from 'react'

import { mdxComponents } from './mdx-components'

interface MdxPreviewProps {
  source: string
  selectedPath: string | null
}

export function MdxPreview({ source, selectedPath }: MdxPreviewProps): React.JSX.Element {
  const [Content, setContent] = useState<MDXContent | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)

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
          setCompileError(formatError(error))
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

  if (!selectedPath) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">
        Select a note to preview.
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b bg-background/95 px-4 text-xs text-muted-foreground backdrop-blur">
        <span className="truncate">{selectedPath}</span>
        <span>{isCompiling ? 'Compiling' : 'Live'}</span>
      </div>
      <div className="mdx-preview mx-auto max-w-3xl px-6 py-6">
        {compileError ? (
          <ErrorPanel title="MDX compile error" message={compileError} />
        ) : Content ? (
          <ErrorBoundary
            resetKeys={[source]}
            fallbackRender={({ error }) => (
              <ErrorPanel title="MDX runtime error" message={formatError(error)} />
            )}
          >
            <Content />
          </ErrorBoundary>
        ) : (
          <div className="text-sm text-muted-foreground">Preparing preview.</div>
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
    remarkPlugins: [remarkGfm, remarkFrontmatter],
    useMDXComponents: () => mdxComponents
  })

  return mdxModule.default
}

function ErrorPanel({ title, message }: { title: string; message: string }): React.JSX.Element {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <div className="mb-2 font-medium text-destructive">{title}</div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-sm bg-background p-3 font-mono text-xs text-foreground">
        {message}
      </pre>
    </div>
  )
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
