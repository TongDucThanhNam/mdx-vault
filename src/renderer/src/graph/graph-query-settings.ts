import type {
  GraphGroup,
  GraphScope,
  GraphViewSettings,
  LocalGraphViewSettings
} from '../../../shared/graph'

export function toGraphQuerySettings(
  settings: GraphViewSettings | LocalGraphViewSettings
): GraphViewSettings {
  return {
    query: settings.query,
    existingOnly: settings.existingOnly,
    showOrphans: settings.showOrphans,
    arrows: settings.arrows,
    labelFadeThreshold: settings.labelFadeThreshold,
    nodeSize: settings.nodeSize,
    linkThickness: settings.linkThickness,
    centerForce: settings.centerForce,
    repelForce: settings.repelForce,
    linkForce: settings.linkForce,
    linkDistance: settings.linkDistance
  }
}

export function createGraphTopologyRequestKey(
  scope: GraphScope | null,
  settings: GraphViewSettings | LocalGraphViewSettings,
  groups: GraphGroup[]
): string {
  return JSON.stringify({
    scope,
    query: settings.query,
    existingOnly: settings.existingOnly,
    showOrphans: settings.showOrphans,
    groups
  })
}
