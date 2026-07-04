/**
 * `AiSelectionActionPalette` — the floating popup that appears when the
 * user selects prose in the editor.
 *
 * Mirrors `ComponentInsertPalette` styling (absolute, no backdrop), but
 * offers AI actions instead of registry templates. The selection coordinates
 * come from CodeMirror via `MdxEditor.onSelectionChange`.
 */

import { Sparkles } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { SELECTED_ACTIONS, findSelectedAction } from '../selected-actions'

export interface SelectionActionPalettePosition {
  top: number
  left: number
}

export interface SelectionActionPaletteAction {
  id: string
  label: string
  description: string
}

interface AiSelectionActionPaletteProps {
  open: boolean
  position: SelectionActionPalettePosition | null
  selectedText: string
  hasSelection: boolean
  onClose: () => void
  onPickAction: (actionId: string, label: string) => void
}

const TEMPLATE_PALETTE_DEFAULT_PROMPT = (label: string): string =>
  `Apply: ${label}. Make sure the result preserves any existing interactive components nearby.`

export function AiSelectionActionPalette({
  open,
  position,
  selectedText,
  hasSelection,
  onClose,
  onPickAction
}: AiSelectionActionPaletteProps): React.JSX.Element | null {
  const ref = useRef<HTMLDivElement | null>(null)
  const [activeIndexRaw, setActiveIndex] = useState(0)

  const visibleActions = useMemo<SelectionActionPaletteAction[]>(() => {
    return SELECTED_ACTIONS.filter((action) => {
      // Template-mode actions (rewrite, summarise, create quiz, insert
      // counter) require a selection; chat-mode actions don't.
      if (action.mode === 'template') return hasSelection
      return true
    }).map((action) => ({
      id: action.id,
      label: action.label,
      description: describeAction(action.id)
    }))
  }, [hasSelection])

  // Clamp the active index to the visible list on render — no effect needed.
  const activeIndex =
    visibleActions.length === 0 ? 0 : Math.min(activeIndexRaw, visibleActions.length - 1)

  const pick = useCallback(
    (actionId: string) => {
      const action = findSelectedAction(actionId)
      const label = action?.label ?? actionId
      const prompt = action?.mode === 'template' ? TEMPLATE_PALETTE_DEFAULT_PROMPT(label) : ''
      onPickAction(actionId, prompt)
      onClose()
    },
    [onClose, onPickAction]
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((current) => Math.min(current + 1, visibleActions.length - 1))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((current) => Math.max(current - 1, 0))
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const action = visibleActions[activeIndex]
        if (action) pick(action.id)
      }
    },
    [activeIndex, onClose, pick, visibleActions]
  )

  if (!open || !position) {
    return null
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn(
        'absolute z-30 w-72 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/40'
      )}
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Ask the assistant
        {hasSelection ? (
          <span className="ml-auto truncate font-mono text-[10px]">
            {truncate(selectedText, 32)}
          </span>
        ) : null}
      </div>

      <div className="max-h-72 overflow-auto">
        {visibleActions.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Select some prose to enable template actions.
          </div>
        ) : (
          visibleActions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              className={cn(
                'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left text-sm outline-none',
                index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
              )}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(action.id)}
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border bg-background">
                <Sparkles className="size-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{action.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {action.description}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function describeAction(actionId: string): string {
  switch (actionId) {
    case 'rewrite-selection':
      return 'Improve clarity and flow while preserving meaning.'
    case 'summarise-selection':
      return 'Reduce the selection to a concise summary.'
    case 'create-quiz-on-selection':
      return 'Insert a <QuizBlock /> interactive based on the selection.'
    case 'insert-counter-on-selection':
      return 'Insert a <Counter /> interactive at the selection.'
    case 'expand-selection':
      return 'Add depth, examples, or counterpoints.'
    case 'find-related-notes':
      return 'Search the vault index for relevant notes.'
    case 'make-interactive':
      return 'Generate a new vault component (sandboxed, not trusted).'
    case 'open-chat':
      return 'Ask anything about this note.'
    default:
      return ''
  }
}

function truncate(value: string, length: number): string {
  const collapsed = value.replace(/\s+/g, ' ').trim()
  return collapsed.length > length ? `${collapsed.slice(0, length)}…` : collapsed
}
