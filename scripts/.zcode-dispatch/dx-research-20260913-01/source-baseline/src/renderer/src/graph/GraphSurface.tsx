import {
  Focus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Waypoints,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { GraphScope } from '../../../shared/graph'
import {
  type CytoscapeGraphAdapter,
  createCytoscapeGraphAdapter,
  type GraphContextRequest
} from './cytoscape-adapter'
import {
  type GraphNodeActionPorts,
  GraphNodeDetails,
  GraphNodeNavigator
} from './GraphNodeNavigator'
import { GraphSettingsDialog } from './GraphSettingsDialog'
import { subscribeGraphSurfaceCommands } from './graph-commands'
import {
  formatGraphSummary,
  type GraphSurfaceStateId,
  getGraphSurfaceState
} from './graph-surface-state'
import type { LocalGraphUnavailableReason } from './local-graph-state'
import { useGraphConfigController, useGraphSnapshotController } from './use-graph-controller'

interface GraphSurfaceProps extends GraphNodeActionPorts {
  mode: 'global' | 'local'
  vaultSessionId: number
  hasVault: boolean
  rootRelativePath?: string | null
  localUnavailableReason?: LocalGraphUnavailableReason | null
  activeRelativePath?: string | null
  compact?: boolean
  className?: string
}

export function GraphSurface({
  mode,
  vaultSessionId,
  hasVault,
  rootRelativePath = null,
  localUnavailableReason = null,
  activeRelativePath = null,
  compact = false,
  className,
  ...nodeActions
}: GraphSurfaceProps): React.JSX.Element {
  const config = useGraphConfigController(mode, vaultSessionId)
  const localDepth = 'depth' in config.settings ? config.settings.depth : 1
  const scope = useMemo<GraphScope | null>(() => {
    if (!hasVault) return null
    if (mode === 'global') return { kind: 'global' }
    return rootRelativePath ? { kind: 'local', rootRelativePath, depth: localDepth } : null
  }, [hasVault, localDepth, mode, rootRelativePath])
  const graph = useGraphSnapshotController({
    active: config.status === 'ready' && scope !== null,
    scope,
    settings: config.settings,
    groups: config.groups
  })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [contextRequest, setContextRequest] = useState<GraphContextRequest | null>(null)
  const [rendererError, setRendererError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLButtonElement>(null)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const adapterRef = useRef<CytoscapeGraphAdapter | null>(null)
  const settingsRef = useRef(config.settings)
  const adapterGenerationRef = useRef(0)
  const selectedNodeIdRef = useRef<string | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const surfaceKey = `${vaultSessionId}:${mode}:${rootRelativePath ?? 'global'}`
  const selectedNode = graph.snapshot?.nodes.find((node) => node.id === selectedNodeId) ?? null
  settingsRef.current = config.settings
  selectedNodeIdRef.current = selectedNodeId

  const openNodeById = useCallback(
    (nodeId: string): void => {
      const node = graph.snapshot?.nodes.find((candidate) => candidate.id === nodeId)
      if (node?.status === 'resolved' && node.relativePath) {
        void nodeActions.onOpenNote(node.relativePath)
      }
    },
    [graph.snapshot, nodeActions.onOpenNote]
  )

  useEffect(() => {
    adapterGenerationRef.current += 1
    adapterRef.current?.destroy()
    adapterRef.current = null
    setRendererError(null)
    setSelectedNodeId(null)
    setContextRequest(null)
    return () => {
      adapterGenerationRef.current += 1
      adapterRef.current?.destroy()
      adapterRef.current = null
    }
  }, [surfaceKey])

  useEffect(() => {
    const snapshot = graph.snapshot
    const container = canvasRef.current
    if (!snapshot || snapshot.nodes.length === 0 || !container) {
      adapterGenerationRef.current += 1
      adapterRef.current?.destroy()
      adapterRef.current = null
      return
    }

    if (adapterRef.current) {
      adapterRef.current.setSnapshot(snapshot, settingsRef.current, config.groups)
      setRendererError(null)
      return
    }

    const generation = adapterGenerationRef.current + 1
    adapterGenerationRef.current = generation
    let disposed = false
    void createCytoscapeGraphAdapter({
      container,
      snapshot,
      settings: settingsRef.current,
      groups: config.groups,
      activeRelativePath,
      reducedMotion,
      onSelectNode: (nodeId) => {
        setSelectedNodeId(nodeId)
        if (!nodeId) setContextRequest(null)
      },
      onOpenNode: openNodeById,
      onContextNode: (request) => {
        setContextRequest(request)
        window.setTimeout(() => contextMenuRef.current?.focus(), 0)
      }
    })
      .then((adapter) => {
        if (disposed || adapterGenerationRef.current !== generation) {
          adapter.destroy()
          return
        }
        adapterRef.current = adapter
        adapter.setSelection(selectedNodeIdRef.current)
        setRendererError(null)
      })
      .catch((error: unknown) => {
        if (disposed || adapterGenerationRef.current !== generation) return
        setRendererError(
          error instanceof Error ? error.message : 'The graph renderer could not be loaded.'
        )
      })

    return () => {
      disposed = true
    }
  }, [activeRelativePath, config.groups, graph.snapshot, openNodeById, reducedMotion])

  useEffect(() => {
    adapterRef.current?.updateSettings(config.settings)
  }, [config.settings])

  useEffect(() => {
    adapterRef.current?.setSelection(selectedNodeId)
  }, [selectedNodeId])

  useEffect(
    () =>
      subscribeGraphSurfaceCommands((command) => {
        if (command === 'fit-view') {
          adapterRef.current?.fit()
        } else {
          settingsButtonRef.current?.focus()
          setSettingsOpen((current) => !current)
        }
      }),
    []
  )

  useEffect(() => {
    if (selectedNodeId && !graph.snapshot?.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null)
      setContextRequest(null)
    }
  }, [graph.snapshot, selectedNodeId])

  const closeContextMenu = useCallback((): void => {
    setContextRequest(null)
    canvasRef.current?.focus()
  }, [])

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const pan = event.shiftKey ? 96 : 32
    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault()
        adapterRef.current?.zoomBy(1.15)
        break
      case '-':
      case '_':
        event.preventDefault()
        adapterRef.current?.zoomBy(1 / 1.15)
        break
      case 'ArrowLeft':
        event.preventDefault()
        adapterRef.current?.panBy(pan, 0)
        break
      case 'ArrowRight':
        event.preventDefault()
        adapterRef.current?.panBy(-pan, 0)
        break
      case 'ArrowUp':
        event.preventDefault()
        adapterRef.current?.panBy(0, pan)
        break
      case 'ArrowDown':
        event.preventDefault()
        adapterRef.current?.panBy(0, -pan)
        break
      case 'Enter':
        if (selectedNodeId) {
          event.preventDefault()
          openNodeById(selectedNodeId)
        }
        break
      case 'Escape':
        if (contextRequest) {
          event.preventDefault()
          closeContextMenu()
        } else if (selectedNodeId) {
          event.preventDefault()
          setSelectedNodeId(null)
        }
        break
      default:
        break
    }
  }

  const state = getGraphSurfaceState({
    hasVault,
    mode,
    rootRelativePath,
    localUnavailableReason,
    configStatus: config.status,
    configError: config.error,
    graphStatus: graph.status,
    graphError: graph.error,
    rendererError,
    snapshot: graph.snapshot,
    query: config.settings.query
  })
  const canRender = state === null && Boolean(graph.snapshot?.nodes.length)

  return (
    <section
      ref={containerRef}
      aria-label={mode === 'global' ? 'Global Graph view' : 'Local Graph view'}
      data-graph-surface={mode}
      data-document-surface={mode === 'global' ? 'active' : undefined}
      className={cn(
        'relative grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background',
        className
      )}
    >
      <header className="flex min-h-11 flex-wrap items-center gap-2 border-b-2 border-foreground bg-chrome px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Waypoints className="size-4 shrink-0 text-editorial-red" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="truncate font-display text-sm font-black">
              {mode === 'global' ? 'Global Graph' : 'Local Graph'}
            </h2>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {formatGraphSummary(graph.snapshot)}
            </p>
          </div>
        </div>

        <label
          className={cn('relative min-w-32 flex-1', compact ? 'order-3 basis-full' : 'ml-auto')}
        >
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Search files in graph</span>
          <input
            value={config.settings.query}
            maxLength={300}
            placeholder="Search files…"
            className="h-8 w-full border-2 border-foreground bg-background pr-2 pl-7 font-mono text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onChange={(event) => config.updateSettings({ query: event.currentTarget.value })}
          />
        </label>

        {mode === 'local' && 'depth' in config.settings ? (
          <label className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase">
            Depth
            <select
              value={config.settings.depth}
              className="h-8 border-2 border-foreground bg-background px-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onChange={(event) =>
                config.updateSettings({
                  depth: Number(event.currentTarget.value) as 1 | 2 | 3 | 4
                })
              }
            >
              {[1, 2, 3, 4].map((depth) => (
                <option key={depth} value={depth}>
                  {depth}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Fit graph view"
            title="Fit view"
            disabled={!canRender}
            onClick={() => adapterRef.current?.fit()}
          >
            <Focus aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Reset graph layout"
            title="Reset layout"
            disabled={!canRender}
            onClick={() => adapterRef.current?.resetLayout()}
          >
            <RotateCcw aria-hidden="true" />
          </Button>
          <Button
            ref={settingsButtonRef}
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Graph settings"
            aria-expanded={settingsOpen}
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 aria-hidden="true" />
          </Button>
        </div>
      </header>

      {config.recovery ? (
        <div className="absolute top-12 right-2 left-2 z-20 flex items-start gap-2 border-2 border-foreground bg-background p-2 shadow-[2px_2px_0_0_var(--foreground)]">
          <SlidersHorizontal className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p className="font-mono text-[9px] leading-relaxed uppercase tracking-wider">
            Defaults active. {config.recovery.relativePath} was preserved for recovery.
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          'grid min-h-0 min-w-0',
          compact
            ? 'grid-rows-[minmax(12rem,1fr)_auto]'
            : 'grid-cols-[minmax(0,1fr)_minmax(13rem,17rem)]'
        )}
      >
        <div className="relative min-h-0 min-w-0 overflow-hidden bg-background">
          <button
            ref={canvasRef}
            type="button"
            aria-label={`${mode === 'global' ? 'Global' : 'Local'} graph canvas`}
            aria-describedby={`${mode}-graph-instructions`}
            className="relative block h-full w-full cursor-default border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/70"
            onKeyDown={handleCanvasKeyDown}
          />
          <p id={`${mode}-graph-instructions`} className="sr-only">
            Use plus and minus to zoom, arrow keys to pan, Shift for faster panning, Enter to open
            the selected resolved note, and Escape to clear selection. Use the node navigator for a
            screen-reader-accessible list.
          </p>

          {state ? (
            <GraphSurfaceState
              state={state}
              onRetry={() => {
                setRendererError(null)
                graph.refresh()
                config.reload()
              }}
            />
          ) : null}

          {graph.snapshot?.truncated ? (
            <div
              role="status"
              className="absolute right-2 bottom-2 left-2 z-10 border-2 border-foreground bg-background p-2 font-mono text-[9px] leading-relaxed uppercase tracking-wider shadow-[2px_2px_0_0_var(--foreground)]"
            >
              {graph.snapshot.truncationReason}
            </div>
          ) : null}

          {contextRequest && selectedNode ? (
            <div
              ref={contextMenuRef}
              role="dialog"
              aria-label={`Node actions for ${selectedNode.title}`}
              tabIndex={-1}
              className="absolute z-30 w-64 max-w-[calc(100%-1rem)] border-2 border-foreground bg-background p-3 shadow-[3px_3px_0_0_var(--foreground)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              style={{
                left: Math.min(
                  contextRequest.x,
                  Math.max(8, (canvasRef.current?.clientWidth ?? 280) - 272)
                ),
                top: Math.min(
                  contextRequest.y,
                  Math.max(8, (canvasRef.current?.clientHeight ?? 240) - 220)
                )
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeContextMenu()
                }
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1 right-1"
                aria-label="Close node actions"
                onClick={closeContextMenu}
              >
                <X aria-hidden="true" />
              </Button>
              <GraphNodeDetails node={selectedNode} {...nodeActions} />
            </div>
          ) : null}
        </div>

        <GraphNodeNavigator
          nodes={graph.snapshot?.nodes ?? []}
          selectedNodeId={selectedNodeId}
          compact={compact}
          onSelectNode={(nodeId) => {
            setSelectedNodeId(nodeId)
            adapterRef.current?.focusNode(nodeId)
          }}
          {...nodeActions}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {selectedNode
          ? `Selected ${selectedNode.title}, ${selectedNode.status}, degree ${selectedNode.degree}.`
          : ''}
      </p>

      <GraphSettingsDialog
        open={settingsOpen}
        mode={mode}
        settings={config.settings}
        groups={config.groups}
        recovery={config.recovery}
        isSaving={config.isSaving}
        error={config.error}
        returnFocusRef={settingsButtonRef}
        onOpenChange={setSettingsOpen}
        onSettingsChange={config.updateSettings}
        onGroupsChange={config.updateGroups}
        onReset={config.resetSettings}
      />
    </section>
  )
}

export function GraphSurfaceState({
  state,
  onRetry
}: {
  state: GraphSurfaceStateId
  onRetry: () => void
}): React.JSX.Element {
  const copy: Record<GraphSurfaceStateId, { title: string; detail: string }> = {
    'no-vault': {
      title: 'No vault open',
      detail: 'Open a vault to build its local note graph.'
    },
    'no-active-note': {
      title: 'No active note',
      detail: 'Local Graph follows the active editable note tab.'
    },
    'unsupported-item': {
      title: 'Active item is not a note',
      detail: 'Local Graph clears for text, image, unsupported, and graph workbench items.'
    },
    'missing-note': {
      title: 'Active note is missing',
      detail: 'The session buffer is preserved, but stale local topology is not shown.'
    },
    loading: {
      title: 'Building graph',
      detail: 'Querying the local index and preparing bounded topology.'
    },
    'config-error': {
      title: 'Settings unavailable',
      detail: 'Graph configuration could not be read safely.'
    },
    'query-error': {
      title: 'Query could not run',
      detail: 'Review Search files or try the request again.'
    },
    'renderer-error': {
      title: 'Renderer unavailable',
      detail: 'The lazy graph renderer could not be initialized.'
    },
    'missing-root': {
      title: 'Note is no longer indexed',
      detail: 'The local root changed or was removed before this graph completed.'
    },
    'filter-empty': {
      title: 'No matching notes',
      detail: 'The current Search files filter removes every returned note.'
    },
    'no-links': {
      title: 'No visible links',
      detail: 'Show orphans, include unresolved targets, or open a connected note.'
    }
  }
  const message = copy[state]
  const retryable =
    state === 'config-error' || state === 'query-error' || state === 'renderer-error'

  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-background/94 p-6">
      <div className="max-w-sm border-2 border-foreground bg-background p-5 text-center shadow-[4px_4px_0_0_var(--foreground)]">
        <Waypoints className="mx-auto mb-3 size-6 text-editorial-red" aria-hidden="true" />
        <h3 className="font-display text-lg font-black">{message.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{message.detail}</p>
        {state === 'loading' ? (
          <RefreshCw
            className="mx-auto mt-4 size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        {retryable ? (
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  )

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    const update = (): void => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}
