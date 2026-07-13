import { FileText, Search } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { getScoredNotes, type ScoredNote } from '@/lib/fuzzy-match'
import { cn } from '@/lib/utils'
import type { IndexedNoteSummary } from '@/vault/types'

interface QuickSwitcherProps {
  open: boolean
  notes: IndexedNoteSummary[]
  recentNotePaths: string[]
  onOpenChange: (open: boolean) => void
  onSelectNote: (relativePath: string) => void
  onCreateNote: (query: string) => Promise<void>
}

export function QuickSwitcher({
  open,
  notes,
  recentNotePaths,
  onOpenChange,
  onSelectNote,
  onCreateNote
}: QuickSwitcherProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const results = useMemo(
    () => getSwitcherResults(notes, query, recentNotePaths),
    [notes, query, recentNotePaths]
  )
  const trimmedQuery = query.trim()
  const canCreate = trimmedQuery.length > 0 && !hasExactNoteMatch(notes, trimmedQuery)
  const itemCount = results.length + (canCreate ? 1 : 0)
  const activeIndex = Math.min(selectedIndex, Math.max(0, itemCount - 1))

  useEffect(() => {
    if (!open) {
      return
    }

    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  if (!open) {
    return null
  }

  const selectNote = (relativePath: string): void => {
    onSelectNote(relativePath)
    onOpenChange(false)
  }

  const createNote = async (): Promise<void> => {
    if (!canCreate || isCreating) {
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      await onCreateNote(trimmedQuery)
      onOpenChange(false)
      setQuery('')
    } catch (createError) {
      setError(formatError(createError))
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((current) => Math.min(current + 1, Math.max(0, itemCount - 1)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((current) => Math.max(0, current - 1))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const result = results[activeIndex]

      if (result) {
        selectNote(result.note.relativePath)
        return
      }

      if (canCreate) {
        void createNote()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 px-4 pt-[12vh] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Open note"
        className="w-full max-w-xl overflow-hidden border-2 border-foreground bg-popover shadow-[6px_6px_0_0_var(--foreground)]"
      >
        <div className="flex h-11 items-center gap-2 border-b-2 border-foreground px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Open note"
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="max-h-[56vh] overflow-auto p-1.5">
          {results.length === 0 && !canCreate ? (
            <div className="px-3 py-8 text-center font-mono text-[12px] uppercase tracking-wider text-muted-foreground">
              No notes found.
            </div>
          ) : (
            <>
              {results.map(({ note, matchedAlias }, index) => (
                <button
                  key={note.relativePath}
                  type="button"
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                    index === activeIndex && 'bg-foreground text-background'
                  )}
                  title={note.relativePath}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => selectNote(note.relativePath)}
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{note.title}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {matchedAlias
                        ? `Alias: ${matchedAlias}`
                        : !trimmedQuery && recentNotePaths.includes(note.relativePath)
                          ? 'Recently opened'
                          : note.relativePath}
                    </span>
                  </span>
                </button>
              ))}
              {canCreate ? (
                <button
                  type="button"
                  disabled={isCreating}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 border-t border-[var(--line)] px-3 py-2 text-left transition-colors hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                    activeIndex === results.length && 'bg-foreground text-background'
                  )}
                  onMouseEnter={() => setSelectedIndex(results.length)}
                  onClick={() => void createNote()}
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {isCreating ? 'Creating note' : `Create "${trimmedQuery}"`}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      New MDX note
                    </span>
                  </span>
                </button>
              ) : null}
              {error ? (
                <div className="px-3 py-2 font-mono text-xs text-destructive" role="alert">
                  {error}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function getSwitcherResults(
  notes: IndexedNoteSummary[],
  query: string,
  recentNotePaths: string[]
): ScoredNote[] {
  const trimmedQuery = query.trim()

  if (trimmedQuery) {
    return getScoredNotes(notes, trimmedQuery)
  }

  const notesByPath = new Map(notes.map((note) => [note.relativePath, note]))
  const recentNotes = recentNotePaths
    .map((path) => notesByPath.get(path))
    .filter((note): note is IndexedNoteSummary => Boolean(note))
  const recentPathSet = new Set(recentNotes.map((note) => note.relativePath))
  const remainingNotes = notes
    .filter((note) => !recentPathSet.has(note.relativePath))
    .sort((left, right) => left.title.localeCompare(right.title))

  return [...recentNotes, ...remainingNotes].slice(0, 30).map((note) => ({
    note,
    score: 1
  }))
}

function hasExactNoteMatch(notes: IndexedNoteSummary[], query: string): boolean {
  const normalizedQuery = query.toLocaleLowerCase()

  return notes.some((note) => {
    return (
      note.title.toLocaleLowerCase() === normalizedQuery ||
      note.aliases.some((alias) => alias.toLocaleLowerCase() === normalizedQuery) ||
      note.relativePath.toLocaleLowerCase() === normalizedQuery ||
      note.relativePath.replace(/\.(md|mdx)$/i, '').toLocaleLowerCase() === normalizedQuery
    )
  })
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
