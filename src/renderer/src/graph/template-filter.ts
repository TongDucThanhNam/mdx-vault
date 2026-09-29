import type { GraphNode, GraphSnapshot } from '../../../shared/graph'

const TITLE_PLACEHOLDER = /\{\{[^{}]+\}\}|\{[^{}]+\}/u

/** Match the existing vault template convention and unresolved title tokens. */
export function isTemplateGraphNode(node: GraphNode): boolean {
  const path = node.relativePath?.replaceAll('\\', '/')
  return Boolean(path?.startsWith('templates/')) || TITLE_PLACEHOLDER.test(node.title)
}

export function filterTemplateGraphSnapshot(
  snapshot: GraphSnapshot | null,
  showTemplates: boolean
): GraphSnapshot | null {
  if (!snapshot || showTemplates) return snapshot

  const nodes = snapshot.nodes.filter((node) => !isTemplateGraphNode(node))
  if (nodes.length === snapshot.nodes.length) return snapshot

  const visibleIds = new Set(nodes.map((node) => node.id))
  return {
    ...snapshot,
    nodes,
    edges: snapshot.edges.filter(
      (edge) => visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId)
    )
  }
}
