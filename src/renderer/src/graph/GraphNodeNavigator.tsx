import { Bookmark, Copy, ExternalLink, FolderOpen, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GraphNode } from '../../../shared/graph'

export interface GraphNodeActionPorts {
  onOpenNote: (relativePath: string) => unknown
  onBookmarkNote: (relativePath: string, title: string) => unknown
  onCopyRelativePath: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
}

interface GraphNodeNavigatorProps extends GraphNodeActionPorts {
  nodes: GraphNode[]
  selectedNodeId: string | null
  compact: boolean
  onSelectNode: (nodeId: string) => void
}

export function GraphNodeNavigator({
  nodes,
  selectedNodeId,
  compact,
  onSelectNode,
  ...actions
}: GraphNodeNavigatorProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleNodes = useMemo(
    () =>
      nodes
        .filter((node) => {
          if (!normalizedQuery) return true
          return [node.title, node.relativePath, ...node.candidatePaths]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
        })
        .sort(
          (left, right) =>
            left.title.localeCompare(right.title, 'en', { sensitivity: 'base' }) ||
            left.id.localeCompare(right.id)
        ),
    [nodes, normalizedQuery]
  )
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null

  return (
    <aside
      aria-label="Graph node navigator"
      className={cn(
        'grid min-h-0 border-foreground bg-chrome',
        compact
          ? 'max-h-64 grid-rows-[auto_minmax(5rem,1fr)_auto] border-t-2'
          : 'grid-rows-[auto_minmax(8rem,1fr)_auto] border-l-2'
      )}
    >
      <label className="relative m-2 block">
        <Search
          className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="sr-only">Find graph node</span>
        <input
          value={query}
          placeholder="Find node…"
          className="h-8 w-full border-2 border-foreground bg-background pr-2 pl-7 font-mono text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      <div
        tabIndex={0}
        role="listbox"
        aria-label="Returned graph nodes"
        aria-activedescendant={selectedNodeId ? graphOptionId(selectedNodeId) : undefined}
        className="min-h-0 overflow-y-auto border-y border-foreground/30"
        onKeyDown={(event) => {
          const currentIndex = visibleNodes.findIndex((node) => node.id === selectedNodeId)
          if (event.key === 'Enter' && currentIndex >= 0) {
            const node = visibleNodes[currentIndex]
            if (node?.status === 'resolved' && node.relativePath) {
              event.preventDefault()
              void actions.onOpenNote(node.relativePath)
            }
            return
          }
          const nextIndex =
            event.key === 'ArrowDown'
              ? Math.min(visibleNodes.length - 1, Math.max(0, currentIndex + 1))
              : event.key === 'ArrowUp'
                ? Math.max(0, currentIndex <= 0 ? 0 : currentIndex - 1)
                : -1
          if (nextIndex >= 0) {
            event.preventDefault()
            const node = visibleNodes[nextIndex]
            if (node) onSelectNode(node.id)
          }
        }}
      >
        {visibleNodes.length === 0 ? (
          <p className="p-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            No returned node matches.
          </p>
        ) : (
          visibleNodes.map((node) => (
            <button
              key={node.id}
              id={graphOptionId(node.id)}
              type="button"
              role="option"
              aria-selected={node.id === selectedNodeId}
              className={cn(
                'grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-foreground/20 px-3 py-2 text-left outline-none last:border-b-0 hover:bg-background focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50',
                node.id === selectedNodeId && 'bg-foreground text-background'
              )}
              onClick={() => onSelectNode(node.id)}
              onDoubleClick={() => {
                if (node.status === 'resolved' && node.relativePath) {
                  void actions.onOpenNote(node.relativePath)
                }
              }}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{node.title}</span>
                <span className="block truncate font-mono text-xs uppercase tracking-wider opacity-70">
                  {node.status}
                  {node.orphan ? ' · orphan' : ''}
                </span>
              </span>
              <span className="font-mono text-xs tabular-nums opacity-70">{node.degree}</span>
            </button>
          ))
        )}
      </div>

      <div className="min-h-[7rem] p-3">
        {selectedNode ? (
          <GraphNodeDetails node={selectedNode} {...actions} />
        ) : (
          <p className="font-mono text-xs leading-relaxed uppercase tracking-wider text-muted-foreground">
            Select a node to inspect its path, degree, groups, and available actions.
          </p>
        )}
      </div>
    </aside>
  )
}

export function GraphNodeDetails({
  node,
  onOpenNote,
  onBookmarkNote,
  onCopyRelativePath,
  onRevealInExplorer
}: { node: GraphNode } & GraphNodeActionPorts): React.JSX.Element {
  return (
    <div role="group" className="space-y-2" aria-label={`Selected node: ${node.title}`}>
      <div>
        <h3 className="truncate text-sm font-bold">{node.title}</h3>
        <p className="break-all font-mono text-xs text-muted-foreground">
          {node.relativePath ?? `${node.status} target`}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2 font-mono text-xs uppercase tracking-wider">
        <div>
          <dt className="text-muted-foreground">In</dt>
          <dd className="font-bold">{node.incomingCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Out</dt>
          <dd className="font-bold">{node.outgoingCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Degree</dt>
          <dd className="font-bold">{node.degree}</dd>
        </div>
      </dl>

      {node.groupIds.length > 0 ? (
        <p className="font-mono text-xs uppercase tracking-wider">
          Groups: {node.groupIds.join(', ')}
        </p>
      ) : null}
      {node.status === 'ambiguous' ? (
        <div className="space-y-1">
          <p className="font-mono text-xs font-bold uppercase tracking-wider">Choose a candidate</p>
          {node.candidatePaths.map((path) => (
            <Button
              key={path}
              type="button"
              variant="ghost"
              size="xs"
              className="h-auto w-full justify-start whitespace-normal"
              onClick={() => void onOpenNote(path)}
            >
              {path}
            </Button>
          ))}
        </div>
      ) : null}

      {node.status === 'resolved' && node.relativePath ? (
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="xs" onClick={() => void onOpenNote(node.relativePath!)}>
            <ExternalLink aria-hidden="true" />
            Open
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label={`Bookmark ${node.title}`}
            onClick={() => void onBookmarkNote(node.relativePath!, node.title)}
          >
            <Bookmark aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Copy relative path for ${node.title}`}
            onClick={() => onCopyRelativePath(node.relativePath!)}
          >
            <Copy aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Reveal ${node.title} in File Explorer`}
            onClick={() => onRevealInExplorer(node.relativePath!)}
          >
            <FolderOpen aria-hidden="true" />
          </Button>
        </div>
      ) : node.status === 'unresolved' ? (
        <p className="font-mono text-xs leading-relaxed uppercase tracking-wider text-muted-foreground">
          Display-only unresolved target. No file action is available.
        </p>
      ) : null}
    </div>
  )
}

function graphOptionId(nodeId: string): string {
  return `graph-node-${encodeURIComponent(nodeId)}`
}
