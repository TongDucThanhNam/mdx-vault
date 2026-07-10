import { Command as CommandIcon, CornerDownLeft, Pin, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import type { CommandAction } from './actions'
import { isSubsequence } from '@/lib/fuzzy-match'
import { cn } from '@/lib/utils'

interface CommandPaletteProps {
  open: boolean
  actions: CommandAction[]
  onOpenChange: (open: boolean) => void
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
  onError
}: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pinnedActionIds, setPinnedActionIds] = useState<string[]>(() => loadPinnedActionIds())
  const [recentActionIds, setRecentActionIds] = useState<string[]>(() => loadRecentActionIds())
  const inputRef = useRef<HTMLInputElement | null>(null)
  const results = useMemo(
    () => getScoredActions(actions, query, pinnedActionIds, recentActionIds),
    [actions, pinnedActionIds, query, recentActionIds]
  )
  const activeIndex = Math.min(selectedIndex, Math.max(0, results.length - 1))

  useEffect(() => {
    if (!open) {
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

  if (!open) {
    return null
  }

  const runAction = async (action: CommandAction): Promise<void> => {
    if (action.disabled) {
      return
    }

    try {
      await action.run()
      setRecentActionIds((current) => recordRecentActionId(current, action.id))
      onOpenChange(false)
    } catch (runError) {
      onError(formatError(runError))
    }
  }

  const togglePin = (actionId: string): void => {
    setPinnedActionIds((current) =>
      current.includes(actionId)
        ? current.filter((candidate) => candidate !== actionId)
        : [actionId, ...current].slice(0, 20)
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((current) => Math.max(0, current - 1))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const selectedAction = results[activeIndex]?.action
      const action =
        selectedAction && !selectedAction.disabled
          ? selectedAction
          : results.find((result) => !result.action.disabled)?.action

      if (action) {
        void runAction(action)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 px-4 pt-[12vh] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl overflow-hidden border-2 border-foreground bg-popover shadow-[6px_6px_0_0_var(--foreground)]"
      >
        <div className="flex h-11 items-center gap-2 border-b-2 border-foreground px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Run command"
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="max-h-[56vh] overflow-auto p-1.5">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center font-mono text-[12px] uppercase tracking-wider text-muted-foreground">
              No commands found.
            </div>
          ) : (
            results.map(({ action, pinned, recent }, index) => {
              const isActive = index === activeIndex
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={action.disabled}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                    action.disabled
                      ? 'cursor-not-allowed opacity-45'
                      : 'hover:bg-foreground hover:text-background',
                    isActive && !action.disabled && 'bg-foreground text-background'
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
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
                  <span
                    role="button"
                    tabIndex={-1}
                    title={pinned ? 'Unpin command' : 'Pin command'}
                    aria-label={pinned ? 'Unpin command' : 'Pin command'}
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center border border-current',
                      pinned ? 'opacity-100' : 'opacity-45'
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      togglePin(action.id)
                    }}
                  >
                    <Pin className="size-3.5" aria-hidden="true" />
                  </span>
                  {isActive && !action.disabled ? (
                    <CornerDownLeft className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
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
      pinnedRank: pinnedRanks.get(action.id) ?? Number.POSITIVE_INFINITY,
      recentRank: recentRanks.get(action.id) ?? Number.POSITIVE_INFINITY,
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
      pinnedActionIds: readStringArray(record.pinnedActionIds),
      recentActionIds: readStringArray(record.recentActionIds)
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
        pinnedActionIds: pinnedActionIds.slice(0, 20),
        recentActionIds: recentActionIds.slice(0, 20)
      })
    )
  } catch {
    // Palette ordering is a convenience, not required for command execution.
  }
}

function recordRecentActionId(currentIds: string[], actionId: string): string[] {
  return [actionId, ...currentIds.filter((candidate) => candidate !== actionId)].slice(0, 20)
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string').slice(0, 20)
}

const COMMAND_PALETTE_STORAGE_KEY = 'mdx-vault.command-palette.v1'
