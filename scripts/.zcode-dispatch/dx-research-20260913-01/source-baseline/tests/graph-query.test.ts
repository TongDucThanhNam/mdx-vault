import { describe, expect, test } from 'bun:test'

import { GraphQueryService } from '../src/main/services/graph-query-service'
import { DEFAULT_GRAPH_VIEW_SETTINGS, type GraphSnapshotRequest } from '../src/shared/graph'
import {
  createGraphNoteId,
  type GraphSourceLink,
  type GraphSourceNote
} from '../src/shared/graph-model'
import { normalizeLinkKey } from '../src/shared/wikilinks'

const notes: GraphSourceNote[] = [
  { relativePath: 'notes/Alpha.mdx', title: 'Alpha', aliases: ['Shared'] },
  { relativePath: 'notes/Beta.mdx', title: 'Beta', aliases: ['Shared'] },
  { relativePath: 'notes/Gamma.mdx', title: 'Gamma', aliases: [] }
]
const links: GraphSourceLink[] = [
  graphLink('notes/Alpha.mdx', 'Beta'),
  graphLink('notes/Alpha.mdx', 'Missing'),
  graphLink('notes/Beta.mdx', 'Gamma')
]
const matches = new Map([
  ['tag:graph', ['notes/Alpha.mdx', 'notes/Gamma.mdx']],
  ['tag:primary', ['notes/Alpha.mdx']]
])
const service = new GraphQueryService(
  {
    getGraphSourceData: () => ({
      notes,
      links,
      totals: { notes: notes.length, links: links.length },
      sourceTruncated: false
    }),
    matchGraphNotePaths: (query) => matches.get(query) ?? []
  },
  () => 'index:42'
)

describe('GOAL-24 bounded graph query', () => {
  test('builds one global snapshot with search filters and ordered groups', () => {
    const snapshot = service.getSnapshot(
      request({
        scope: { kind: 'global' },
        query: 'tag:graph',
        groups: [
          { id: 'primary', label: 'Primary', query: 'tag:primary', visualToken: 'gold' },
          { id: 'all-graph', label: 'All graph', query: 'tag:graph', visualToken: 'blue' }
        ]
      })
    )

    expect(snapshot.revision).toBe('index:42')
    expect(snapshot.nodes.map((node) => node.relativePath)).toEqual([
      'notes/Alpha.mdx',
      'notes/Gamma.mdx',
      null
    ])
    expect(snapshot.edges).toHaveLength(1)
    expect(
      snapshot.nodes.find((node) => node.relativePath === 'notes/Alpha.mdx')?.groupIds
    ).toEqual(['primary', 'all-graph'])
    expect(
      snapshot.nodes.find((node) => node.relativePath === 'notes/Gamma.mdx')?.groupIds
    ).toEqual(['all-graph'])
    expect(snapshot.nodes.find((node) => node.status === 'unresolved')?.title).toBe('Missing')
  })

  test('traverses local incoming and outgoing topology before filtering and retains the root', () => {
    const snapshot = service.getSnapshot(
      request({
        scope: { kind: 'local', rootRelativePath: 'notes/Beta.mdx', depth: 1 },
        query: 'tag:primary'
      })
    )

    expect(snapshot.nodes.map((node) => node.relativePath)).toEqual([
      'notes/Beta.mdx',
      'notes/Alpha.mdx'
    ])
    expect(snapshot.edges).toHaveLength(1)
    expect(snapshot.edges[0]).toMatchObject({
      sourceId: createGraphNoteId('notes/Alpha.mdx'),
      targetId: createGraphNoteId('notes/Beta.mdx')
    })
  })

  test('marks source-cap truncation explicitly instead of silently returning a partial graph', () => {
    const bounded = new GraphQueryService(
      {
        getGraphSourceData: () => ({
          notes: [{ relativePath: 'notes/Alpha.mdx', title: 'Alpha', aliases: [] }],
          links: [],
          totals: { notes: 2_501, links: 10_001 },
          sourceTruncated: true
        }),
        matchGraphNotePaths: () => []
      },
      () => 'index:99'
    )
    const snapshot = bounded.getSnapshot(request({ scope: { kind: 'global' } }))

    expect(snapshot.truncated).toBe(true)
    expect(snapshot.truncationReason).toContain('2501 indexed notes')
    expect(snapshot.truncationReason).toContain('10001 authored links')
  })
})

function request({
  scope,
  query = '',
  groups = []
}: {
  scope: GraphSnapshotRequest['scope']
  query?: string
  groups?: GraphSnapshotRequest['groups']
}): GraphSnapshotRequest {
  return {
    scope,
    settings: {
      ...DEFAULT_GRAPH_VIEW_SETTINGS,
      query
    },
    groups
  }
}

function graphLink(sourceRelativePath: string, target: string): GraphSourceLink {
  return {
    sourceRelativePath,
    target,
    targetNormalized: normalizeLinkKey(target)
  }
}
