import type { GraphSnapshot } from '../../../shared/graph'
import type { LocalGraphUnavailableReason } from './local-graph-state'

export type GraphSurfaceStateId =
  | 'no-vault'
  | 'no-active-note'
  | 'unsupported-item'
  | 'missing-note'
  | 'loading'
  | 'config-error'
  | 'query-error'
  | 'renderer-error'
  | 'missing-root'
  | 'filter-empty'
  | 'empty-vault'
  | 'no-links'

export function getGraphSurfaceState(options: {
  hasVault: boolean
  mode: 'global' | 'local'
  rootRelativePath: string | null
  localUnavailableReason: LocalGraphUnavailableReason | null
  configStatus: 'loading' | 'ready' | 'error'
  configError: string | null
  graphStatus: 'idle' | 'loading' | 'ready' | 'error'
  graphError: string | null
  rendererError: string | null
  snapshot: GraphSnapshot | null
  query: string
}): GraphSurfaceStateId | null {
  if (!options.hasVault) return 'no-vault'
  if (options.mode === 'local' && !options.rootRelativePath) {
    return options.localUnavailableReason ?? 'no-active-note'
  }
  if (options.configStatus === 'error') return 'config-error'
  if (options.configStatus === 'loading' || options.graphStatus === 'loading') return 'loading'
  if (options.graphStatus === 'error' || options.graphError) return 'query-error'
  if (options.rendererError) return 'renderer-error'
  if (options.snapshot?.state === 'missing-root') return 'missing-root'
  if (options.snapshot && options.snapshot.nodes.length === 0) {
    if (options.query.trim()) return 'filter-empty'
    return options.snapshot.totals.nodes === 0 ? 'empty-vault' : 'no-links'
  }
  return null
}

export function formatGraphSummary(snapshot: GraphSnapshot | null): string {
  if (!snapshot) return 'Waiting for topology'
  return `${snapshot.nodes.length}/${snapshot.totals.nodes} nodes · ${snapshot.edges.length}/${snapshot.totals.edges} edges`
}
