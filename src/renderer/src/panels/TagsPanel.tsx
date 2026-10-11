import { FileText } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { IndexedNoteSummary, TagSummary } from '@/vault/types'

interface TagsPanelProps {
  tags: TagSummary[]
  selectedTag: string | null
  taggedNotes: IndexedNoteSummary[]
  isLoading: boolean
  onSelectTag: (tag: string) => void
  onSelectNote: (relativePath: string) => void
}

export function TagsPanel({
  tags,
  selectedTag,
  taggedNotes,
  isLoading,
  onSelectTag,
  onSelectNote
}: TagsPanelProps): React.JSX.Element {
  return (
    <div role="region" aria-label="Tags" className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-7 shrink-0 items-center justify-end border-b border-border px-4">
        <div className="font-sans text-xs tabular-nums text-muted-foreground">{tags.length}</div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(120px,0.8fr)_minmax(0,1fr)]">
        <div className="min-h-0 overflow-auto border-r border-border p-2">
          {tags.length === 0 ? (
            <div className="px-2 py-6 text-center font-sans text-xs text-muted-foreground">
              No tags.
            </div>
          ) : (
            <div className="space-y-1">
              {tags.map((tag) => {
                const isActive = tag.tag === selectedTag
                return (
                  <button
                    key={tag.tag}
                    type="button"
                    className={cn(
                      'flex h-8 w-full items-center justify-between gap-2 px-2 text-left font-sans text-[12px] transition-colors hover:bg-instrument-blue/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      isActive && 'bg-instrument-blue/10 text-foreground'
                    )}
                    title={`#${tag.tag}`}
                    onClick={() => onSelectTag(tag.tag)}
                  >
                    <span className="min-w-0 truncate">#{tag.tag}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{tag.count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-auto p-2">
          {!selectedTag ? (
            <div className="px-2 py-6 text-center font-sans text-xs text-muted-foreground">
              Choose a tag.
            </div>
          ) : isLoading ? (
            <div className="px-2 py-6 text-center font-sans text-xs text-muted-foreground">
              Loading notes.
            </div>
          ) : taggedNotes.length === 0 ? (
            <div className="px-2 py-6 text-center font-sans text-xs text-muted-foreground">
              No notes.
            </div>
          ) : (
            <div className="space-y-1">
              {taggedNotes.map((note) => (
                <button
                  key={note.relativePath}
                  type="button"
                  data-page-preview-path={note.relativePath}
                  className="flex h-11 w-full items-center gap-2 border-l border-l-transparent px-2 text-left transition-colors hover:border-l-[var(--editorial-red)] hover:bg-instrument-blue/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  title={note.relativePath}
                  onClick={() => onSelectNote(note.relativePath)}
                >
                  <FileText
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{note.title}</span>
                    <span className="block truncate font-sans text-xs text-muted-foreground">
                      {note.relativePath}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
