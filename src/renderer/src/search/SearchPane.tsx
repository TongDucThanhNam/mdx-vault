import { FileSearch, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import type { SearchResult } from '@/vault/types'

interface SearchPaneProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectNote: (relativePath: string) => void
}

export function SearchPane({
  open,
  onOpenChange,
  onSelectNote
}: SearchPaneProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setIsSearching(true)
      setError(null)

      void window.indexApi
        .search(trimmedQuery, 50)
        .then((nextResults) => {
          if (!cancelled) {
            setResults(nextResults)
          }
        })
        .catch((searchError: unknown) => {
          if (!cancelled) {
            setResults([])
            setError(formatError(searchError))
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsSearching(false)
          }
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, query])

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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 px-4 pt-[10vh] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search notes"
        className="flex max-h-[78vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border bg-popover shadow-lg"
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search notes"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            title="Close"
            aria-label="Close search"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {!query.trim() ? (
            <EmptySearchState label="Type to search note body." />
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : isSearching ? (
            <EmptySearchState label="Searching." />
          ) : results.length === 0 ? (
            <EmptySearchState label="No matches." />
          ) : (
            <div className="space-y-1">
              {results.map((result) => (
                <button
                  key={`${result.note.relativePath}-${result.snippet}`}
                  type="button"
                  className="w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  title={result.note.relativePath}
                  onClick={() => selectNote(result.note.relativePath)}
                >
                  <div className="truncate text-sm font-medium">{result.note.title}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {result.note.relativePath}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {result.snippet || result.note.title}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptySearchState({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <FileSearch className="size-5" aria-hidden="true" />
      <div>{label}</div>
    </div>
  )
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
