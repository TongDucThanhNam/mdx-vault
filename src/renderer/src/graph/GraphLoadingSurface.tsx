import { Search, Waypoints } from 'lucide-react'

/** Lightweight first frame while the graph implementation is loading. */
export function GraphLoadingSurface(): React.JSX.Element {
  return (
    <div
      data-graph-surface="global"
      data-document-surface="active"
      className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background"
    >
      <header className="flex min-h-11 items-center gap-2 border-b border-border bg-chrome px-2 py-1.5">
        <Waypoints className="size-4 shrink-0 text-editorial-red" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="truncate font-sans text-sm font-semibold">Global Graph</h2>
          <p className="font-sans text-xs text-muted-foreground">Loading graph…</p>
        </div>
        <label className="relative ml-auto min-w-32 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Search files in graph</span>
          <input
            disabled
            placeholder="Search files…"
            className="h-8 w-full rounded-md border border-input bg-background pr-2 pl-7 font-sans text-xs"
          />
        </label>
      </header>
      <div className="grid place-items-center font-sans text-xs text-muted-foreground">
        Loading graph renderer…
      </div>
    </div>
  )
}
