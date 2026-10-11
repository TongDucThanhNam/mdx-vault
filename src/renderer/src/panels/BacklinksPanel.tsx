import { ArrowDownUp, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { BacklinkResult } from '@/vault/types'

type BacklinkSortMode = 'title' | 'path' | 'modified'

interface BacklinksPanelProps {
  backlinks: BacklinkResult[]
  selectedPath: string | null
  onSelectNote: (relativePath: string) => void
}

export function BacklinksPanel({
  backlinks,
  selectedPath,
  onSelectNote
}: BacklinksPanelProps): React.JSX.Element {
  const [filter, setFilter] = useState('')
  const [sortMode, setSortMode] = useState<BacklinkSortMode>('title')
  const visibleBacklinks = useMemo(
    () => filterAndSortBacklinks(backlinks, filter, sortMode),
    [backlinks, filter, sortMode]
  )
  const linkedBacklinks = visibleBacklinks.filter((backlink) => backlink.kind === 'linked')
  const unlinkedBacklinks = visibleBacklinks.filter((backlink) => backlink.kind === 'unlinked')

  return (
    <div role="region" aria-label="Backlinks" className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-7 shrink-0 items-center justify-end border-b border-border px-4">
        <div className="font-sans text-xs tabular-nums text-muted-foreground">
          {linkedBacklinks.length}/{unlinkedBacklinks.length}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {!selectedPath ? (
          <div className="px-2 py-6 text-center font-sans text-xs text-muted-foreground">
            Select a note.
          </div>
        ) : backlinks.length === 0 ? (
          <div className="px-2 py-6 text-center font-sans text-xs text-muted-foreground">
            No backlinks.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
              <label className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2">
                <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  value={filter}
                  className="min-w-0 flex-1 bg-transparent font-sans text-[12px] outline-none placeholder:text-muted-foreground"
                  placeholder="Filter"
                  onChange={(event) => setFilter(event.currentTarget.value)}
                />
              </label>
              <label className="flex h-8 items-center gap-1 rounded-md border border-input bg-background px-1">
                <ArrowDownUp
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <select
                  value={sortMode}
                  className="min-w-0 flex-1 bg-transparent font-sans text-xs outline-none"
                  aria-label="Sort backlinks"
                  onChange={(event) => setSortMode(event.currentTarget.value as BacklinkSortMode)}
                >
                  <option value="title">Title</option>
                  <option value="path">Path</option>
                  <option value="modified">Modified</option>
                </select>
              </label>
            </div>

            <BacklinkSection
              label="Linked mentions"
              backlinks={linkedBacklinks}
              onSelectNote={onSelectNote}
            />
            <BacklinkSection
              label="Unlinked mentions"
              backlinks={unlinkedBacklinks}
              onSelectNote={onSelectNote}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function BacklinkSection({
  label,
  backlinks,
  onSelectNote
}: {
  label: string
  backlinks: BacklinkResult[]
  onSelectNote: (relativePath: string) => void
}): React.JSX.Element {
  return (
    <section>
      <div className="flex items-center justify-between border-b border-[var(--line)] px-1 py-1 font-sans text-xs font-semibold text-muted-foreground">
        <span>{label}</span>
        <span>{backlinks.length}</span>
      </div>
      {backlinks.length === 0 ? (
        <div className="px-2 py-3 font-sans text-xs text-muted-foreground">No matches.</div>
      ) : (
        <div className="space-y-1 pt-1">
          {backlinks.map((backlink, index) => (
            <button
              key={`${backlink.kind}-${backlink.source.relativePath}-${backlink.target}-${index}`}
              type="button"
              data-page-preview-path={backlink.source.relativePath}
              className="w-full border-l border-l-transparent px-2 py-2 text-left transition-colors hover:border-l-[var(--editorial-red)] hover:bg-instrument-blue/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              title={backlink.source.relativePath}
              onClick={() => onSelectNote(backlink.source.relativePath)}
            >
              <div className="truncate font-sans text-sm font-semibold">
                {backlink.source.title}
              </div>
              <div className="mt-0.5 truncate font-sans text-xs text-muted-foreground">
                {backlink.source.relativePath}
              </div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {backlink.snippet || backlink.display}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function filterAndSortBacklinks(
  backlinks: BacklinkResult[],
  filter: string,
  sortMode: BacklinkSortMode
): BacklinkResult[] {
  const normalizedFilter = filter.trim().toLocaleLowerCase()
  const filteredBacklinks = normalizedFilter
    ? backlinks.filter((backlink) => {
        const searchableText =
          `${backlink.source.title} ${backlink.source.relativePath} ${backlink.display} ${backlink.snippet}`.toLocaleLowerCase()
        return searchableText.includes(normalizedFilter)
      })
    : backlinks

  return [...filteredBacklinks].sort((left, right) => {
    if (sortMode === 'modified') {
      return right.source.mtimeMs - left.source.mtimeMs
    }

    if (sortMode === 'path') {
      return left.source.relativePath.localeCompare(right.source.relativePath)
    }

    return left.source.title.localeCompare(right.source.title)
  })
}
