import { FileWarning } from 'lucide-react'
import { useId, useLayoutEffect, useMemo, useRef } from 'react'
import { deriveNoteTitle } from '@/lib/note-title'
import { cn } from '@/lib/utils'
import { containDialogTabKey } from '@/workbench/dialog-focus'
import type { MruSwitchState, WorkbenchItem } from '@/workbench/types'

export interface MruTabSwitcherProps {
  state: MruSwitchState | null
  items: WorkbenchItem[]
  onCommit: (id: string) => void
  onCancel: () => void
  onHighlight?: (id: string) => void
}

/**
 * The visual surface for an MRU gesture. Candidate cycling and modifier-release
 * detection belong to the workbench controller; this component only exposes
 * the transient state and its explicit commit/cancel affordances.
 */
export function MruTabSwitcher({
  state,
  items,
  onCommit,
  onCancel,
  onHighlight
}: MruTabSwitcherProps): React.JSX.Element | null {
  const headingId = useId()
  const hintId = useId()
  const listboxRef = useRef<HTMLDivElement>(null)
  const isOpen = state !== null
  const candidates = useMemo(() => {
    if (!state) {
      return []
    }

    const itemsById = new Map(items.map((item) => [item.id, item]))
    return state.candidateIds.flatMap((candidateId) => {
      const item = itemsById.get(candidateId)
      return item ? [item] : []
    })
  }, [items, state])

  const highlightedIndex = state
    ? candidates.findIndex((item) => item.id === state.highlightedId)
    : -1
  const highlightedOptionId =
    highlightedIndex >= 0 ? `${headingId}-option-${highlightedIndex}` : undefined

  useLayoutEffect(() => {
    if (isOpen) {
      listboxRef.current?.focus({ preventScroll: true })
    }
  }, [isOpen])

  if (!state) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[80]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={hintId}
        tabIndex={-1}
        className="absolute top-16 left-1/2 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 border-2 border-foreground bg-background shadow-[4px_4px_0_0_var(--foreground)]"
        onKeyDown={(event) => {
          if (!event.nativeEvent.isComposing && !event.repeat) {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.stopPropagation()
              onCommit(state.highlightedId)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              onCancel()
            }
          }
          containDialogTabKey(event, event.currentTarget)
        }}
      >
        <header className="flex items-baseline justify-between gap-4 border-b-2 border-foreground bg-masthead px-3 py-2">
          <h2
            id={headingId}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          >
            Recent tabs
          </h2>
          <p
            id={hintId}
            className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
          >
            Enter to open · Esc to cancel
          </p>
        </header>

        <div
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          aria-label="Most recently used tabs"
          aria-activedescendant={highlightedOptionId}
          className="max-h-[min(23rem,55vh)] overflow-y-auto p-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
        >
          {candidates.map((item, index) => {
            const isHighlighted = item.id === state.highlightedId
            const { directory, label } = getItemPresentation(item)

            return (
              <button
                key={item.id}
                id={`${headingId}-option-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={isHighlighted}
                aria-label={getAccessibleLabel(item, label, directory)}
                title={item.kind === 'graph' ? 'Global Graph' : item.relativePath}
                className={cn(
                  'group relative grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-3 py-2 text-left outline-none transition-colors motion-reduce:transition-none',
                  isHighlighted
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-chrome focus-visible:bg-chrome'
                )}
                onPointerEnter={() => onHighlight?.(item.id)}
                onClick={() => onCommit(item.id)}
              >
                {isHighlighted ? (
                  <span
                    className="absolute inset-y-1 left-0 w-0.5 bg-[var(--editorial-red)]"
                    aria-hidden="true"
                  />
                ) : null}

                <span className="flex min-w-0 items-center gap-2">
                  {item.missing ? (
                    <FileWarning
                      className="size-3.5 shrink-0 text-[var(--editorial-red)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className={cn(
                        'size-1.5 shrink-0 border border-current',
                        item.dirty && 'border-[var(--editorial-red)] bg-[var(--editorial-red)]'
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate font-mono text-[11px] font-bold">{label}</span>
                  {item.dirty ? (
                    <span
                      className={cn(
                        'font-mono text-[8px] font-bold uppercase tracking-widest',
                        isHighlighted ? 'text-background/70' : 'text-[var(--editorial-red)]'
                      )}
                      aria-hidden="true"
                    >
                      modified
                    </span>
                  ) : null}
                </span>

                <span
                  className={cn(
                    'max-w-44 truncate text-right font-mono text-[9px] uppercase tracking-wider',
                    isHighlighted ? 'text-background/65' : 'text-muted-foreground'
                  )}
                  aria-hidden="true"
                >
                  {item.kind} · {directory}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getItemPresentation(item: WorkbenchItem): { label: string; directory: string } {
  if (item.kind === 'graph') {
    return {
      label: 'Graph',
      directory: 'Global'
    }
  }

  const normalizedPath = item.relativePath.replaceAll('\\', '/')
  const segments = normalizedPath.split('/')

  return {
    label: deriveNoteTitle(normalizedPath),
    directory: segments.slice(0, -1).join('/') || 'vault root'
  }
}

function getAccessibleLabel(item: WorkbenchItem, label: string, directory: string): string {
  return [
    label,
    directory,
    item.kind,
    item.dirty ? 'unsaved changes' : null,
    item.missing ? 'missing from vault' : null
  ]
    .filter(Boolean)
    .join(', ')
}
