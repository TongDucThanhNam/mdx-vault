import { describe, expect, test } from 'bun:test'
import {
  filterTemplateGraphSnapshot,
  isTemplateGraphNode
} from '../src/renderer/src/graph/template-filter'
import type { GraphNode, GraphSnapshot } from '../src/shared/graph'

function node(id: string, relativePath: string | null, title: string): GraphNode {
  return {
    id,
    status: relativePath ? 'resolved' : 'unresolved',
    relativePath,
    title,
    candidatePaths: [],
    incomingCount: 0,
    outgoingCount: 0,
    degree: 0,
    orphan: true,
    groupIds: []
  }
}

describe('GOAL-34 graph template filtering', () => {
  test('recognizes the existing templates folder and both title-token forms', () => {
    expect(isTemplateGraphNode(node('a', 'templates/daily.mdx', 'Daily note'))).toBe(true)
    expect(isTemplateGraphNode(node('b', 'notes/{date}.mdx', '{date}'))).toBe(true)
    expect(isTemplateGraphNode(node('c', null, '{{title}}'))).toBe(true)
    expect(isTemplateGraphNode(node('d', 'notes/daily.mdx', 'Daily note'))).toBe(false)
    expect(isTemplateGraphNode(node('e', 'notes/templates/daily.mdx', 'Daily note'))).toBe(false)
  })

  test('hides template nodes and incident edges without mutating the source topology', () => {
    const snapshot: GraphSnapshot = {
      revision: 'r1',
      state: 'ready',
      scope: { kind: 'global' },
      nodes: [
        node('note', 'notes/real.mdx', 'Real'),
        node('template', 'templates/daily.mdx', 'Daily')
      ],
      edges: [{ id: 'link', sourceId: 'note', targetId: 'template', occurrenceCount: 1 }],
      totals: { nodes: 2, edges: 1 },
      truncated: false,
      truncationReason: null
    }

    const filtered = filterTemplateGraphSnapshot(snapshot, false)
    expect(filtered?.nodes.map((entry) => entry.id)).toEqual(['note'])
    expect(filtered?.edges).toEqual([])
    expect(filtered?.totals).toEqual({ nodes: 2, edges: 1 })
    expect(snapshot.nodes).toHaveLength(2)
    expect(filterTemplateGraphSnapshot(snapshot, true)).toBe(snapshot)
    expect(filterTemplateGraphSnapshot(null, false)).toBeNull()
  })
})
