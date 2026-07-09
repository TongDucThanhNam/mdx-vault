import { FileText, Hash } from 'lucide-react'

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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b-2 border-foreground px-4">
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          <Hash className="size-3.5" aria-hidden="true" />
          Tags
        </div>
        <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {tags.length}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(120px,0.8fr)_minmax(0,1fr)]">
        <div className="min-h-0 overflow-auto border-r-2 border-foreground p-2">
          {tags.length === 0 ? (
            <div className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
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
                      'flex h-8 w-full items-center justify-between gap-2 px-2 text-left font-mono text-[12px] transition-colors hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      isActive && 'bg-foreground text-background'
                    )}
                    title={`#${tag.tag}`}
                    onClick={() => onSelectTag(tag.tag)}
                  >
                    <span className="min-w-0 truncate">#{tag.tag}</span>
                    <span className="shrink-0 tabular-nums opacity-70">{tag.count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-auto p-2">
          {!selectedTag ? (
            <div className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Choose a tag.
            </div>
          ) : isLoading ? (
            <div className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Loading notes.
            </div>
          ) : taggedNotes.length === 0 ? (
            <div className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              No notes.
            </div>
          ) : (
            <div className="space-y-1">
              {taggedNotes.map((note) => (
                <button
                  key={note.relativePath}
                  type="button"
                  className="flex h-11 w-full items-center gap-2 border-l-2 border-l-transparent px-2 text-left transition-colors hover:border-l-[var(--editorial-red)] hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  title={note.relativePath}
                  onClick={() => onSelectNote(note.relativePath)}
                >
                  <FileText
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{note.title}</span>
                    <span className="block truncate font-mono text-[11px] opacity-70">
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
