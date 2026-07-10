import { Link2 } from 'lucide-react'

import type { BacklinkResult } from '@/vault/types'

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
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b-2 border-foreground px-4">
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          <Link2 className="size-3.5" aria-hidden="true" />
          Backlinks
        </div>
        <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {backlinks.length}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {!selectedPath ? (
          <div className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Select a note.
          </div>
        ) : backlinks.length === 0 ? (
          <div className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            No backlinks.
          </div>
        ) : (
          <div className="space-y-1">
            {backlinks.map((backlink, index) => (
              <button
                key={`${backlink.source.relativePath}-${backlink.target}-${index}`}
                type="button"
                className="w-full border-l-2 border-l-transparent px-2 py-2 text-left transition-colors hover:border-l-[var(--editorial-red)] hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                title={backlink.source.relativePath}
                onClick={() => onSelectNote(backlink.source.relativePath)}
              >
                <div className="truncate font-display text-sm font-bold">
                  {backlink.source.title}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] opacity-70">
                  {backlink.source.relativePath}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
