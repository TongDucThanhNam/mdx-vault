export const GRAPH_ACTION_IDS = [
  'graph.open-global',
  'graph.fit-view',
  'graph.toggle-settings',
  'panel.showLocalGraph'
] as const

export type GraphActionId = (typeof GRAPH_ACTION_IDS)[number]

export interface GraphActionHandlersInput {
  openGlobalGraph: () => unknown
  fitView: () => unknown
  toggleSettings: () => unknown
  showLocalGraph: () => unknown
}

export function createGraphActionHandlers(
  input: GraphActionHandlersInput
): Readonly<Record<GraphActionId, () => unknown>> {
  return {
    'graph.open-global': input.openGlobalGraph,
    'graph.fit-view': input.fitView,
    'graph.toggle-settings': input.toggleSettings,
    'panel.showLocalGraph': input.showLocalGraph
  }
}

export function getGraphActionEnabledState(options: {
  hasVault: boolean
  hasNote: boolean
  graphSurfaceActive: boolean
}): Readonly<Record<GraphActionId, boolean>> {
  return {
    'graph.open-global': options.hasVault,
    'graph.fit-view': options.graphSurfaceActive,
    'graph.toggle-settings': options.graphSurfaceActive,
    'panel.showLocalGraph': options.hasNote
  }
}
