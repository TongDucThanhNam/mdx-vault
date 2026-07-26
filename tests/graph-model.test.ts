import { describe, expect, test } from 'bun:test'

import type { GraphGroup } from '../src/shared/graph'
import {
  buildGraphSnapshot,
  createGraphGhostId,
  createGraphNoteId,
  type GraphSourceLink,
  type GraphSourceNote
} from '../src/shared/graph-model'
import { normalizeLinkKey } from '../src/shared/wikilinks'

const note = (
  name: string,
  options: { title?: string; aliases?: string[]; folder?: string } = {}
): GraphSourceNote => ({
  relativePath: `${options.folder ?? 'notes'}/${name}.mdx`,
  title: options.title ?? name,
  aliases: options.aliases ?? []
})

const link = (source: GraphSourceNote, target: string): GraphSourceLink => ({
  sourceRelativePath: source.relativePath,
  target,
  targetNormalized: normalizeLinkKey(target)
})

const group = (id: string): GraphGroup => ({
  id,
  label: id.toUpperCase(),
  query: `tag:${id}`,
  visualToken: 'blue'
})

describe('GOAL-24 graph topology model', () => {
  test('collapses duplicate links and preserves self, unresolved, and ambiguous topology', () => {
    const alpha = note('Alpha')
    const beta = note('Beta', { aliases: ['Shared'] })
    const gamma = note('Gamma', { aliases: ['Shared'] })
    const orphan = note('Orphan')
    const snapshot = buildGraphSnapshot({
      revision: 'rev-1',
      scope: { kind: 'global' },
      notes: [orphan, gamma, alpha, beta],
      links: [
        link(alpha, 'Beta'),
        link(alpha, 'Missing'),
        link(alpha, 'Alpha'),
        link(alpha, 'Shared'),
        link(alpha, 'Beta')
      ],
      existingOnly: false,
      showOrphans: true
    })

    const alphaId = createGraphNoteId(alpha.relativePath)
    const betaId = createGraphNoteId(beta.relativePath)
    const orphanId = createGraphNoteId(orphan.relativePath)
    const unresolvedId = createGraphGhostId('unresolved', normalizeLinkKey('Missing'))
    const ambiguousId = createGraphGhostId('ambiguous', normalizeLinkKey('Shared'))

    expect(snapshot.state).toBe('ready')
    expect(snapshot.nodes.map((node) => node.id)).toContain(alphaId)
    expect(snapshot.nodes.map((node) => node.id)).toContain(orphanId)
    expect(snapshot.nodes.find((node) => node.id === unresolvedId)).toMatchObject({
      status: 'unresolved',
      title: 'Missing',
      candidatePaths: []
    })
    expect(snapshot.nodes.find((node) => node.id === ambiguousId)).toMatchObject({
      status: 'ambiguous',
      candidatePaths: [beta.relativePath, gamma.relativePath]
    })
    expect(
      snapshot.edges.find((edge) => edge.sourceId === alphaId && edge.targetId === betaId)
    ).toMatchObject({ occurrenceCount: 2 })
    expect(
      snapshot.edges.find((edge) => edge.sourceId === alphaId && edge.targetId === alphaId)
    ).toMatchObject({ occurrenceCount: 1 })
    expect(
      snapshot.edges.some((edge) => edge.targetId === createGraphNoteId(gamma.relativePath))
    ).toBe(false)
    expect(snapshot.edges.some((edge) => edge.targetId === ambiguousId)).toBe(true)

    expect(snapshot.nodes.find((node) => node.id === alphaId)).toMatchObject({
      incomingCount: 1,
      outgoingCount: 4,
      degree: 5,
      orphan: false
    })
    expect(snapshot.nodes.find((node) => node.id === betaId)).toMatchObject({
      incomingCount: 1,
      outgoingCount: 0,
      degree: 1
    })
    expect(snapshot.nodes.find((node) => node.relativePath === orphan.relativePath)).toMatchObject({
      orphan: true,
      degree: 0
    })
  })

  test('applies existing-only and orphan visibility without leaving dangling edges', () => {
    const alpha = note('Alpha')
    const beta = note('Beta')
    const orphan = note('Orphan')
    const snapshot = buildGraphSnapshot({
      revision: 'rev-2',
      scope: { kind: 'global' },
      notes: [alpha, beta, orphan],
      links: [link(alpha, 'Beta'), link(alpha, 'Missing')],
      includedRelativePaths: new Set([alpha.relativePath, beta.relativePath, orphan.relativePath]),
      existingOnly: true,
      showOrphans: false
    })

    expect(snapshot.nodes.map((node) => node.relativePath)).toEqual([
      alpha.relativePath,
      beta.relativePath
    ])
    expect(snapshot.edges).toHaveLength(1)
    expect(
      snapshot.edges.every((edge) => snapshot.nodes.some((node) => node.id === edge.sourceId))
    ).toBe(true)
    expect(
      snapshot.edges.every((edge) => snapshot.nodes.some((node) => node.id === edge.targetId))
    ).toBe(true)
  })

  test('traverses incoming and outgoing neighbors to the requested local depth through cycles', () => {
    const notes = ['A', 'B', 'C', 'D', 'E'].map((name) => note(name))
    const [a, b, c, d, e] = notes
    const links = [link(a, 'B'), link(b, 'C'), link(c, 'D'), link(d, 'E'), link(e, 'C')]

    const atDepthOne = buildGraphSnapshot({
      revision: 'rev-3',
      scope: { kind: 'local', rootRelativePath: c.relativePath, depth: 1 },
      notes,
      links,
      existingOnly: false,
      showOrphans: true
    })
    const atDepthTwo = buildGraphSnapshot({
      revision: 'rev-3',
      scope: { kind: 'local', rootRelativePath: c.relativePath, depth: 2 },
      notes,
      links,
      existingOnly: false,
      showOrphans: true
    })

    expect(atDepthOne.nodes.map((node) => node.relativePath)).toEqual([
      c.relativePath,
      b.relativePath,
      d.relativePath,
      e.relativePath
    ])
    expect(atDepthTwo.nodes.map((node) => node.relativePath)).toEqual([
      c.relativePath,
      a.relativePath,
      b.relativePath,
      d.relativePath,
      e.relativePath
    ])
  })

  test('applies query membership after local traversal and always retains the root', () => {
    const notes = ['A', 'B', 'C', 'D', 'E'].map((name) => note(name))
    const [a, b, c, d, e] = notes
    const snapshot = buildGraphSnapshot({
      revision: 'rev-4',
      scope: { kind: 'local', rootRelativePath: c.relativePath, depth: 4 },
      notes,
      links: [link(a, 'B'), link(b, 'C'), link(c, 'D'), link(d, 'E')],
      includedRelativePaths: new Set([e.relativePath]),
      existingOnly: false,
      showOrphans: true
    })

    expect(snapshot.nodes.map((node) => node.relativePath)).toEqual([
      c.relativePath,
      e.relativePath
    ])
    expect(snapshot.edges).toEqual([])
    expect(snapshot.nodes.find((node) => node.relativePath === c.relativePath)?.orphan).toBe(true)
  })

  test('returns an explicit empty state when the local root is no longer indexed', () => {
    const snapshot = buildGraphSnapshot({
      revision: 'rev-5',
      scope: { kind: 'local', rootRelativePath: 'notes/Missing.mdx', depth: 1 },
      notes: [note('Existing')],
      links: [],
      existingOnly: false,
      showOrphans: true
    })

    expect(snapshot).toMatchObject({
      state: 'missing-root',
      nodes: [],
      edges: [],
      truncated: false
    })
  })

  test('truncates deterministically, retains the local root, and recomputes visible counts', () => {
    const notes = ['A', 'B', 'C', 'D', 'E'].map((name) => note(name))
    const [a, b, c, d, e] = notes
    const input = {
      revision: 'rev-6',
      scope: { kind: 'local' as const, rootRelativePath: c.relativePath, depth: 4 as const },
      notes,
      links: [link(a, 'B'), link(b, 'C'), link(c, 'D'), link(d, 'E')],
      existingOnly: false,
      showOrphans: true,
      nodeLimit: 3,
      edgeLimit: 1
    }
    const first = buildGraphSnapshot(input)
    const shuffled = buildGraphSnapshot({
      ...input,
      notes: [e, c, a, d, b],
      links: [...input.links].reverse()
    })

    expect(first).toEqual(shuffled)
    expect(first.nodes[0]?.relativePath).toBe(c.relativePath)
    expect(first.nodes).toHaveLength(3)
    expect(first.edges).toHaveLength(1)
    expect(first.truncated).toBe(true)
    expect(first.totals).toEqual({ nodes: 5, edges: 4 })
    expect(first.nodes.reduce((sum, node) => sum + node.outgoingCount, 0)).toBe(1)
    expect(first.nodes.reduce((sum, node) => sum + node.incomingCount, 0)).toBe(1)
  })

  test('assigns ordered group memberships with first-match priority available to the renderer', () => {
    const alpha = note('Alpha')
    const first = group('first')
    const second = group('second')
    const snapshot = buildGraphSnapshot({
      revision: 'rev-7',
      scope: { kind: 'global' },
      notes: [alpha],
      links: [],
      groupMemberships: [
        { group: second, relativePaths: new Set([alpha.relativePath]) },
        { group: first, relativePaths: new Set([alpha.relativePath]) }
      ],
      existingOnly: false,
      showOrphans: true
    })

    expect(snapshot.nodes[0]?.groupIds).toEqual(['second', 'first'])
  })
})
