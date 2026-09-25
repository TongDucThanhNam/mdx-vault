import { Command as CommandIcon, CornerDownLeft, Pin, Search } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isSubsequence } from '@/lib/fuzzy-match'
import { cn } from '@/lib/utils'
import { containDialogTabKey } from '@/workbench/dialog-focus'
import { canonicalizeActionId } from '../../../shared/workspace-actions'
import type { CommandAction } from './actions'

interface CommandPaletteProps {
  open: boolean
  actions: CommandAction[]
  onOpenChange: (open: boolean) => void
  onComplete: () => void
  onError: (message: string) => void
}

interface ScoredCommandAction {
  action: CommandAction
  score: number
  pinned: boolean
  recent: boolean
}

export function CommandPalette({
  open,
  actions,
  onOpenChange,
  onComplete,
  onError
}: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pinnedActionIds, setPinnedActionIds] = useState<string[]>(() => loadPinnedActionIds())
  const [recentActionIds, setRecentActionIds] = useState<string[]>(() => loadRecentActionIds())
  const [runningActionId, setRunningActionId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const runningActionRef = useRef<string | null>(null)
  const closeGenerationRef = useRef(0)
  const results = useMemo(
    () => getScoredActions(actions, query, pinnedActionIds, recentActionIds),
    [actions, pinnedActionIds, query, recentActionIds]
  )
  const activeIndex = getEnabledIndex(results, selectedIndex)
  const activeOptionId = activeIndex >= 0 ? getOptionId(activeIndex) : undefined

  useEffect(() => {
    if (!open) {
      closeGenerationRef.current += 1
      setQuery('')
      setSelectedIndex(0)
      return
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    saveCommandPaletteState(pinnedActionIds, recentActionIds)
  }, [pinnedActionIds, recentActionIds])

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return
    }

    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  if (!open) {
    return null
  }

  const closePalette = (): void => {
    closeGenerationRef.current += 1
    setQuery('')
    setSelectedIndex(0)
    onOpenChange(false)
  }

  const completePalette = (): void => {
    closeGenerationRef.current += 1
    setQuery('')
    setSelectedIndex(0)
    onComplete()
  }

  const runAction = async (action: CommandAction): Promise<void> => {
    if (action.disabled || runningActionRef.current !== null) {
      return
    }

    runningActionRef.current = action.id
    setRunningActionId(action.id)
    const closeGeneration = closeGenerationRef.current

    try {
      const didRun = await action.run()
      if (didRun === false) {
        return
      }

      setRecentActionIds((current) => recordRecentActionId(current, action.id))
      if (closeGeneration === closeGenerationRef.current) {
        completePalette()
      }
    } catch (runError) {
      onError(formatError(runError))
    } finally {
      runningActionRef.current = null
      setRunningActionId(null)
    }
  }

  const togglePin = (actionId: string): void => {
    const canonicalId = canonicalizeActionId(actionId)
    setPinnedActionIds((current) =>
      current.includes(canonicalId)
        ? current.filter((candidate) => candidate !== canonicalId)
        : [canonicalId, ...current].slice(0, 20)
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closePalette()
      return
    }

    if (event.target !== inputRef.current || event.nativeEvent.isComposing) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex(findAdjacentEnabledIndex(results, activeIndex, 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex(findAdjacentEnabledIndex(results, activeIndex, -1))
      return
    }

    if (event.key === 'Enter' && !event.repeat) {
      event.preventDefault()
      const action = results[activeIndex]?.action

      if (action) {
        void runAction(action)
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overscroll-contain bg-background/75 px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePalette()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        aria-busy={runningActionId !== null}
        tabIndex={-1}
        className="w-full max-w-xl overflow-hidden border-2 border-foreground bg-card shadow-[4px_4px_0_0_var(--foreground)]"
        onKeyDown={(event) => {
          handleKeyDown(event)
          containDialogTabKey(event, event.currentTarget)
        }}
      >
        <div className="flex h-11 items-center gap-2 border-b-2 border-foreground px-3 focus-within:ring-[3px] focus-within:ring-inset focus-within:ring-ring/50">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            name="command-query"
            autoComplete="off"
            spellCheck={false}
            value={query}
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Run command…"
            aria-label="Run command"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={COMMAND_PALETTE_LISTBOX_ID}
            aria-expanded={true}
            aria-activedescendant={activeOptionId}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
          />
        </div>

        <div
          id={COMMAND_PALETTE_LISTBOX_ID}
          role="listbox"
          aria-label="Available commands"
          className="max-h-[56vh] overflow-auto p-1.5"
        >
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center font-mono text-[12px] uppercase tracking-wider text-muted-foreground">
              No commands found.
            </div>
          ) : (
            results.map(({ action, pinned, recent }, index) => {
              const isActive = index === activeIndex
              return (
                <div
                  key={action.id}
                  role="presentation"
                  className={cn(
                    'flex min-h-14 w-full items-center transition-colors motion-reduce:transition-none',
                    action.disabled
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:bg-foreground hover:text-background',
                    isActive &&
                      !action.disabled &&
                      'bg-foreground text-background shadow-[inset_3px_0_0_0_var(--primary)]'
                  )}
                  onMouseEnter={() => {
                    if (!action.disabled) {
                      setSelectedIndex(index)
                    }
                  }}
                >
                  <button
                    id={getOptionId(index)}
                    ref={(element) => {
                      optionRefs.current[index] = element
                    }}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={Boolean(action.disabled)}
                    disabled={action.disabled}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onClick={() => void runAction(action)}
                  >
                    <CommandIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{action.title}</span>
                        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {action.category}
                        </span>
                        {pinned ? (
                          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Pinned
                          </span>
                        ) : recent ? (
                          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Recent
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                    {action.hotkeys && action.hotkeys.length > 0 ? (
                      <span className="hidden shrink-0 gap-1 sm:flex">
                        {action.hotkeys.map((hotkey) => (
                          <span
                            key={hotkey}
                            className="border border-current px-1 py-0.5 font-mono text-[10px] leading-none"
                          >
                            {hotkey}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    {runningActionId === action.id ? (
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider">
                        Running
                      </span>
                    ) : isActive && !action.disabled ? (
                      <CornerDownLeft className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={action.disabled}
                    title={pinned ? 'Unpin command' : 'Pin command'}
                    aria-label={pinned ? 'Unpin command' : 'Pin command'}
                    className={cn(
                      'mr-2 flex size-8 shrink-0 items-center justify-center border border-current outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none',
                      pinned ? 'opacity-100' : 'opacity-45'
                    )}
                    onClick={() => togglePin(action.id)}
                  >
                    <Pin className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function getScoredActions(
  actions: CommandAction[],
  query: string,
  pinnedActionIds: string[],
  recentActionIds: string[]
): ScoredCommandAction[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const pinnedRanks = new Map(pinnedActionIds.map((id, index) => [id, index]))
  const recentRanks = new Map(recentActionIds.map((id, index) => [id, index]))

  return actions
    .map((action, index) => ({
      action,
      index,
      pinnedRank: pinnedRanks.get(canonicalizeActionId(action.id)) ?? Number.POSITIVE_INFINITY,
      recentRank: recentRanks.get(canonicalizeActionId(action.id)) ?? Number.POSITIVE_INFINITY,
      score: normalizedQuery ? scoreAction(action, normalizedQuery) : 1
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      const disabledSort = Number(left.action.disabled) - Number(right.action.disabled)

      if (disabledSort !== 0) {
        return disabledSort
      }

      if (!normalizedQuery) {
        return (
          left.pinnedRank - right.pinnedRank ||
          left.recentRank - right.recentRank ||
          left.index - right.index
        )
      }

      return right.score - left.score || left.index - right.index
    })
    .map((candidate) => ({
      action: candidate.action,
      score: candidate.score,
      pinned: Number.isFinite(candidate.pinnedRank),
      recent: Number.isFinite(candidate.recentRank)
    }))
    .slice(0, 30)
}

function scoreAction(action: CommandAction, query: string): number {
  const keys = [action.title, action.description, action.category, ...(action.keywords ?? [])].map(
    (value) => value.toLocaleLowerCase()
  )
  let bestScore = 0

  for (const key of keys) {
    if (key === query) {
      bestScore = Math.max(bestScore, 100)
    } else if (key.startsWith(query)) {
      bestScore = Math.max(bestScore, 80)
    } else if (key.includes(query)) {
      bestScore = Math.max(bestScore, 55)
    } else if (isSubsequence(query, key)) {
      bestScore = Math.max(bestScore, 25)
    }
  }

  return bestScore
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function loadPinnedActionIds(): string[] {
  return loadCommandPaletteState().pinnedActionIds
}

function loadRecentActionIds(): string[] {
  return loadCommandPaletteState().recentActionIds
}

function loadCommandPaletteState(): {
  pinnedActionIds: string[]
  recentActionIds: string[]
} {
  try {
    const value = window.localStorage.getItem(COMMAND_PALETTE_STORAGE_KEY)
    const parsed = value ? (JSON.parse(value) as unknown) : null

    if (!parsed || typeof parsed !== 'object') {
      return { pinnedActionIds: [], recentActionIds: [] }
    }

    const record = parsed as { pinnedActionIds?: unknown; recentActionIds?: unknown }

    return {
      pinnedActionIds: canonicalizeActionIds(readStringArray(record.pinnedActionIds)),
      recentActionIds: canonicalizeActionIds(readStringArray(record.recentActionIds))
    }
  } catch {
    return { pinnedActionIds: [], recentActionIds: [] }
  }
}

function saveCommandPaletteState(pinnedActionIds: string[], recentActionIds: string[]): void {
  try {
    window.localStorage.setItem(
      COMMAND_PALETTE_STORAGE_KEY,
      JSON.stringify({
        pinnedActionIds: canonicalizeActionIds(pinnedActionIds),
        recentActionIds: canonicalizeActionIds(recentActionIds)
      })
    )
  } catch {
    // Palette ordering is a convenience, not required for command execution.
  }
}

function recordRecentActionId(currentIds: string[], actionId: string): string[] {
  const canonicalId = canonicalizeActionId(actionId)
  return [canonicalId, ...currentIds.filter((candidate) => candidate !== canonicalId)].slice(0, 20)
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function canonicalizeActionIds(actionIds: string[]): string[] {
  return [...new Set(actionIds.map(canonicalizeActionId))].slice(0, 20)
}

function getEnabledIndex(results: ScoredCommandAction[], requestedIndex: number): number {
  const requestedResult = results[requestedIndex]
  if (requestedResult && !requestedResult.action.disabled) {
    return requestedIndex
  }

  return results.findIndex(({ action }) => !action.disabled)
}

function findAdjacentEnabledIndex(
  results: ScoredCommandAction[],
  currentIndex: number,
  direction: 1 | -1
): number {
  let nextIndex =
    currentIndex < 0 ? (direction === 1 ? 0 : results.length - 1) : currentIndex + direction

  while (nextIndex >= 0 && nextIndex < results.length) {
    if (!results[nextIndex].action.disabled) {
      return nextIndex
    }
    nextIndex += direction
  }

  return currentIndex
}

function getOptionId(index: number): string {
  return `command-palette-option-${index}`
}

const COMMAND_PALETTE_STORAGE_KEY = 'mdx-vault.command-palette.v1'
const COMMAND_PALETTE_LISTBOX_ID = 'command-palette-listbox'
