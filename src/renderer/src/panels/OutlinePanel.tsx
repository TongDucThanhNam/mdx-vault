import { ListTree } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { NoteHeadingResult } from '@/vault/types'

interface OutlinePanelProps {
  headings: NoteHeadingResult[]
  selectedPath: string | null
  onSelectHeading: (heading: NoteHeadingResult) => void
}

export function OutlinePanel({
  headings,
  selectedPath,
  onSelectHeading
}: OutlinePanelProps): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b-2 border-foreground px-4">
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          <ListTree className="size-3.5" aria-hidden="true" />
          Outline
        </div>
        <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {headings.length}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {!selectedPath ? (
          <div className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Select a note.
          </div>
        ) : headings.length === 0 ? (
          <div className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            No headings.
          </div>
        ) : (
          <div className="space-y-1">
            {headings.map((heading) => (
              <button
                key={`${heading.position}-${heading.slug}`}
                type="button"
                className={cn(
                  'grid h-8 w-full grid-cols-[2rem_minmax(0,1fr)] items-center border-l-2 border-l-transparent text-left transition-colors hover:border-l-[var(--editorial-red)] hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  heading.depth > 1 && 'text-muted-foreground'
                )}
                style={{ paddingLeft: `${Math.max(0, heading.depth - 1) * 10}px` }}
                title={heading.text}
                onClick={() => onSelectHeading(heading)}
              >
                <span className="font-mono text-[10px] font-bold tabular-nums opacity-70">
                  H{heading.depth}
                </span>
                <span className="truncate text-sm font-medium">{heading.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
