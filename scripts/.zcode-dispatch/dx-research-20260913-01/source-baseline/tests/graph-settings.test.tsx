import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { GraphNodeNavigator } from '../src/renderer/src/graph/GraphNodeNavigator'
import {
  createDefaultGraphViewManifest,
  graphViewManifestSchema,
  MAX_GRAPH_GROUPS
} from '../src/shared/graph'

describe('GOAL-24 graph settings and semantic node actions', () => {
  test('keeps defaults independent and rejects out-of-range forces and more than eight groups', () => {
    const first = createDefaultGraphViewManifest()
    first.global.query = 'changed'
    expect(createDefaultGraphViewManifest().global.query).toBe('')

    expect(
      graphViewManifestSchema.safeParse({
        ...createDefaultGraphViewManifest(),
        global: { ...createDefaultGraphViewManifest().global, nodeSize: 41 }
      }).success
    ).toBe(false)
    expect(
      graphViewManifestSchema.safeParse({
        ...createDefaultGraphViewManifest(),
        groups: Array.from({ length: MAX_GRAPH_GROUPS + 1 }, (_, index) => ({
          id: `group-${index}`,
          label: `Group ${index}`,
          query: '',
          visualToken: 'blue'
        }))
      }).success
    ).toBe(false)
  })

  test('never exposes fake file actions for unresolved nodes', () => {
    const html = renderNavigator({
      id: 'ghost:unresolved:missing',
      status: 'unresolved',
      relativePath: null,
      title: 'Missing',
      candidatePaths: [],
      incomingCount: 1,
      outgoingCount: 0,
      degree: 1,
      orphan: false,
      groupIds: []
    })

    expect(html).toContain('Display-only unresolved target')
    expect(html).not.toContain('>Open<')
    expect(html).not.toContain('Reveal Missing')
    expect(html).not.toContain('Copy relative path')
  })

  test('mirrors resolved-node path, degree, and keyboard-equivalent actions in semantic DOM', () => {
    const html = renderNavigator({
      id: 'note:Alpha',
      status: 'resolved',
      relativePath: 'notes/Alpha.mdx',
      title: 'Alpha',
      candidatePaths: [],
      incomingCount: 2,
      outgoingCount: 3,
      degree: 5,
      orphan: false,
      groupIds: ['primary', 'research']
    })

    expect(html).toContain('notes/Alpha.mdx')
    expect(html).toContain('Groups: primary, research')
    expect(html).toContain('>Open<')
    expect(html).toContain('Bookmark Alpha')
    expect(html).toContain('Copy relative path for Alpha')
    expect(html).toContain('Reveal Alpha in File Explorer')
  })
})

function renderNavigator(node: Parameters<typeof GraphNodeNavigator>[0]['nodes'][number]): string {
  return renderToStaticMarkup(
    createElement(GraphNodeNavigator, {
      nodes: [node],
      selectedNodeId: node.id,
      compact: false,
      onSelectNode: () => undefined,
      onOpenNote: () => undefined,
      onBookmarkNote: () => undefined,
      onCopyRelativePath: () => undefined,
      onRevealInExplorer: () => undefined
    })
  )
}
