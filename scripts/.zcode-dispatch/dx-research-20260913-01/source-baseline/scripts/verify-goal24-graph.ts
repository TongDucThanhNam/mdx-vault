import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'

import { MAX_GRAPH_EDGES, MAX_GRAPH_NODES } from '../src/shared/graph'
import {
  buildGraphSnapshot,
  createGraphNoteId,
  type GraphSourceLink,
  type GraphSourceNote
} from '../src/shared/graph-model'
import { normalizeLinkKey } from '../src/shared/wikilinks'

interface SyntheticTier {
  name: string
  noteCount: number
  collapsedEdgeCount: number
}

const tiers: SyntheticTier[] = [
  { name: 'medium', noteCount: 500, collapsedEdgeCount: 2_000 },
  { name: 'large', noteCount: 2_000, collapsedEdgeCount: 8_000 }
]

verifySemanticFixture()
for (const tier of tiers) verifyTier(tier)

function verifyTier(tier: SyntheticTier): void {
  const fixture = createSyntheticFixture(tier.noteCount, tier.collapsedEdgeCount)
  const heapBefore = process.memoryUsage().heapUsed
  const startedAt = performance.now()
  const snapshot = buildGraphSnapshot({
    revision: `synthetic:${tier.name}`,
    scope: { kind: 'global' },
    notes: fixture.notes,
    links: fixture.links,
    existingOnly: false,
    showOrphans: true,
    nodeLimit: MAX_GRAPH_NODES,
    edgeLimit: MAX_GRAPH_EDGES
  })
  const elapsedMs = performance.now() - startedAt
  const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore

  assert.equal(snapshot.edges.length, tier.collapsedEdgeCount)
  assert.equal(snapshot.nodes.filter((node) => node.status === 'resolved').length, tier.noteCount)
  assert.equal(snapshot.nodes.filter((node) => node.status === 'ambiguous').length, 1)
  assert.equal(snapshot.nodes.filter((node) => node.status === 'unresolved').length, 1)
  assert.equal(snapshot.nodes.filter((node) => node.orphan).length, 1)
  assert.equal(snapshot.truncated, false)
  assert.equal(snapshot.truncationReason, null)
  assert.ok(elapsedMs < 12_000, `${tier.name} topology exceeded the 12 s safety budget`)

  console.log(
    JSON.stringify({
      tier: tier.name,
      sourceNotes: tier.noteCount,
      authoredLinks: fixture.links.length,
      returnedNodes: snapshot.nodes.length,
      collapsedEdges: snapshot.edges.length,
      truncated: snapshot.truncated,
      elapsedMs: Number(elapsedMs.toFixed(2)),
      heapDeltaMiB: Number((heapDeltaBytes / 1024 / 1024).toFixed(2))
    })
  )
}

function createSyntheticFixture(
  noteCount: number,
  collapsedEdgeCount: number
): { notes: GraphSourceNote[]; links: GraphSourceLink[] } {
  assert.ok(noteCount >= 4)
  assert.ok(collapsedEdgeCount >= noteCount)
  const notes = Array.from({ length: noteCount }, (_, index): GraphSourceNote => {
    const padded = String(index).padStart(4, '0')
    return {
      relativePath: `synthetic/Note-${padded}.mdx`,
      title: `Note ${padded}`,
      aliases: index === 1 || index === 2 ? ['Shared Synthetic Alias'] : []
    }
  })
  const connectedCount = noteCount - 1
  const links: GraphSourceLink[] = []
  const resolvedEdgeCount = collapsedEdgeCount - 2

  for (let index = 0; index < resolvedEdgeCount; index += 1) {
    const sourceIndex = index % connectedCount
    const layer = Math.floor(index / connectedCount)
    const targetIndex = (sourceIndex + layer) % connectedCount
    links.push(createLink(notes[sourceIndex]!, notes[targetIndex]!.relativePath))
  }

  links.push({ ...links[0]! })
  links.push(createLink(notes[0]!, 'Shared Synthetic Alias'))
  links.push(createLink(notes[0]!, 'Missing Synthetic Target'))
  return { notes, links }
}

function verifySemanticFixture(): void {
  const notes: GraphSourceNote[] = Array.from({ length: 6 }, (_, index) => ({
    relativePath: `depth/Level-${index}.mdx`,
    title: `Level ${index}`,
    aliases: index === 1 || index === 2 ? ['Shared Depth Alias'] : []
  }))
  const chain = notes.slice(0, -1).map((source, index) => createLink(source, notes[index + 1]!.relativePath))
  const links = [
    ...chain,
    createLink(notes[0]!, notes[0]!.relativePath),
    createLink(notes[0]!, notes[0]!.relativePath),
    createLink(notes[0]!, 'Shared Depth Alias'),
    createLink(notes[0]!, 'Missing Depth Target')
  ]
  const local = buildGraphSnapshot({
    revision: 'synthetic:semantic',
    scope: { kind: 'local', rootRelativePath: notes[0]!.relativePath, depth: 4 },
    notes,
    links,
    existingOnly: false,
    showOrphans: true
  })

  assert.equal(local.state, 'ready')
  assert.ok(local.nodes.some((node) => node.id === createGraphNoteId(notes[4]!.relativePath)))
  assert.ok(!local.nodes.some((node) => node.id === createGraphNoteId(notes[5]!.relativePath)))
  assert.equal(local.nodes.filter((node) => node.status === 'ambiguous').length, 1)
  assert.equal(local.nodes.filter((node) => node.status === 'unresolved').length, 1)
  assert.equal(
    local.edges.find(
      (edge) =>
        edge.sourceId === createGraphNoteId(notes[0]!.relativePath) &&
        edge.targetId === createGraphNoteId(notes[0]!.relativePath)
    )?.occurrenceCount,
    2
  )
}

function createLink(source: GraphSourceNote, target: string): GraphSourceLink {
  return {
    sourceRelativePath: source.relativePath,
    target,
    targetNormalized: normalizeLinkKey(target)
  }
}
