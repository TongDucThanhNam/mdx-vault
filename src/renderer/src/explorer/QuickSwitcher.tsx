import { FileText, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { getNoteLinkKeys } from '../../../shared/wikilinks'
import { cn } from '@/lib/utils'
import type { IndexedNoteSummary } from '@/vault/types'

interface QuickSwitcherProps {
  open: boolean
  notes: IndexedNoteSummary[]
  onOpenChange: (open: boolean) => void
  onSelectNote: (relativePath: string) => void
}

interface ScoredNote {
  note: IndexedNoteSummary
  score: number
}

export function QuickSwitcher({
  open,
  notes,
  onOpenChange,
  onSelectNote
}: QuickSwitcherProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const results = useMemo(() => getScoredNotes(notes, query), [notes, query])

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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
      return
    }

    if (event.key === 'Enter' && results[0]) {
      event.preventDefault()
      selectNote(results[0].note.relativePath)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 px-4 pt-[12vh] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Open note"
        className="w-full max-w-xl overflow-hidden rounded-md border bg-popover shadow-lg"
      >
        <div className="flex h-11 items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Open note"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="max-h-[56vh] overflow-auto p-1.5">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notes found.
            </div>
          ) : (
            results.map(({ note }, index) => (
              <button
                key={note.relativePath}
                type="button"
                className={cn(
                  'flex h-12 w-full items-center gap-3 rounded-md px-3 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  index === 0 && 'bg-accent/70'
                )}
                title={note.relativePath}
                onClick={() => selectNote(note.relativePath)}
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{note.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {note.relativePath}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function getScoredNotes(notes: IndexedNoteSummary[], query: string): ScoredNote[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return notes
    .map((note) => ({
      note,
      score: normalizedQuery ? scoreNote(note, normalizedQuery) : 1
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) => right.score - left.score || left.note.title.localeCompare(right.note.title)
    )
    .slice(0, 30)
}

function scoreNote(note: IndexedNoteSummary, query: string): number {
  const keys = [note.title, note.relativePath, ...getNoteLinkKeys(note)].map((value) =>
    value.toLocaleLowerCase()
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

function isSubsequence(query: string, value: string): boolean {
  let queryIndex = 0

  for (const character of value) {
    if (character === query[queryIndex]) {
      queryIndex += 1
    }

    if (queryIndex === query.length) {
      return true
    }
  }

  return false
}
