import type { ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { sourceOffsetToLine } from '../preview-anchor'

export function RegistryIslandBoundary({
  name,
  source,
  onRevealLine,
  children
}: {
  name: string
  source: string
  onRevealLine?: (line: number) => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <div
          role="alert"
          className="my-4 border-2 border-foreground bg-background p-3 font-mono text-xs shadow-[3px_3px_0_0_var(--foreground)]"
        >
          <strong className="block text-destructive">{name} runtime error</strong>
          <p className="mt-2 break-words">
            {error instanceof Error ? error.message : String(error)}
          </p>
          {onRevealLine ? (
            <button
              type="button"
              className="mt-3 inline-flex items-center px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-ring"
              onClick={(event) => {
                const wrapper = event.currentTarget.closest<HTMLElement>(
                  '[data-preview-block-start]'
                )
                const offset = Number(wrapper?.dataset.previewBlockStart)
                if (wrapper && Number.isInteger(offset) && offset >= 0) {
                  onRevealLine(sourceOffsetToLine(source, offset))
                }
              }}
            >
              Reveal source
            </button>
          ) : null}
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
