import {
  type GraphEdge,
  type GraphGroup,
  type GraphNode,
  type GraphNodeStatus,
  type GraphScope,
  type GraphSnapshot,
  MAX_GRAPH_EDGES,
  MAX_GRAPH_NODES
} from './graph'
import { getFilenameStem, getNoteLinkKeys, normalizeLinkKey } from './wikilinks'

export interface GraphSourceNote {
  relativePath: string
  title: string
  aliases: string[]
}

export interface GraphSourceLink {
  sourceRelativePath: string
  target: string
  targetNormalized: string
}

export interface GraphGroupMembership {
  group: GraphGroup
  relativePaths: ReadonlySet<string>
}

export interface BuildGraphSnapshotInput {
  revision: string
  scope: GraphScope
  notes: readonly GraphSourceNote[]
  links: readonly GraphSourceLink[]
  includedRelativePaths?: ReadonlySet<string> | null
  groupMemberships?: readonly GraphGroupMembership[]
  existingOnly: boolean
  showOrphans: boolean
  nodeLimit?: number
  edgeLimit?: number
}

interface ResolvedGraphNote extends GraphSourceNote {
  relativePath: string
  id: string
}

interface MutableGhost {
  id: string
  status: Exclude<GraphNodeStatus, 'resolved'>
  title: string
  candidatePaths: string[]
}

interface CollapsedTopology {
  notesByPath: Map<string, ResolvedGraphNote>
  nodesById: Map<string, GraphNode>
  edges: GraphEdge[]
}

export function buildGraphSnapshot(input: BuildGraphSnapshotInput): GraphSnapshot {
  const nodeLimit = clampLimit(input.nodeLimit, MAX_GRAPH_NODES)
  const edgeLimit = clampLimit(input.edgeLimit, MAX_GRAPH_EDGES)
  const topology = collapseGraphTopology(input.notes, input.links)
  const rootPath =
    input.scope.kind === 'local'
      ? canonicalizeGraphRelativePath(input.scope.rootRelativePath)
      : null
  const rootNote = rootPath ? topology.notesByPath.get(rootPath) : null

  if (input.scope.kind === 'local' && !rootNote) {
    return {
      revision: input.revision,
      state: 'missing-root',
      scope: input.scope,
      nodes: [],
      edges: [],
      totals: { nodes: 0, edges: 0 },
      truncated: false,
      truncationReason: null
    }
  }

  const scopeNodeIds =
    input.scope.kind === 'local' && rootNote
      ? traverseLocalGraph(topology.edges, rootNote.id, input.scope.depth)
      : new Set(topology.nodesById.keys())
  const includedPaths = input.includedRelativePaths
    ? new Set([...input.includedRelativePaths].map(canonicalizeGraphRelativePath))
    : null
  const rootId = rootNote?.id ?? null
  const visibleNodeIds = new Set<string>()

  for (const nodeId of scopeNodeIds) {
    const node = topology.nodesById.get(nodeId)
    if (!node) continue

    if (node.status === 'resolved') {
      if (node.id === rootId || !includedPaths || includedPaths.has(node.relativePath ?? '')) {
        visibleNodeIds.add(node.id)
      }
      continue
    }

    if (!input.existingOnly) {
      visibleNodeIds.add(node.id)
    }
  }

  let visibleEdges = topology.edges.filter(
    (edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId)
  )
  removeIsolatedGhosts(visibleNodeIds, visibleEdges, topology.nodesById)
  removeHiddenOrphans(visibleNodeIds, visibleEdges, topology.nodesById, input.showOrphans, rootId)
  visibleEdges = visibleEdges.filter(
    (edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId)
  )

  const orderedNodes = orderGraphNodes(
    [...visibleNodeIds]
      .map((nodeId) => topology.nodesById.get(nodeId))
      .filter((node): node is GraphNode => Boolean(node)),
    rootId
  )
  const orderedEdges = [...visibleEdges].sort(compareGraphEdges)
  const totals = { nodes: orderedNodes.length, edges: orderedEdges.length }
  const returnedNodes = orderedNodes.slice(0, nodeLimit)
  const returnedNodeIds = new Set(returnedNodes.map((node) => node.id))
  const edgesWithinReturnedNodes = orderedEdges.filter(
    (edge) => returnedNodeIds.has(edge.sourceId) && returnedNodeIds.has(edge.targetId)
  )
  const returnedEdges = edgesWithinReturnedNodes.slice(0, edgeLimit)
  const returnedEdgeNodeIds = collectIncidentNodeIds(returnedEdges)
  let finalNodes =
    input.showOrphans || input.scope.kind === 'global'
      ? returnedNodes
      : returnedNodes.filter(
          (node) =>
            node.id === rootId || node.status !== 'resolved' || returnedEdgeNodeIds.has(node.id)
        )

  if (!input.showOrphans && input.scope.kind === 'global') {
    finalNodes = returnedNodes.filter(
      (node) => node.status !== 'resolved' || returnedEdgeNodeIds.has(node.id)
    )
  }

  const finalNodeIds = new Set(finalNodes.map((node) => node.id))
  const finalEdges = returnedEdges.filter(
    (edge) => finalNodeIds.has(edge.sourceId) && finalNodeIds.has(edge.targetId)
  )
  const countedNodes = calculateVisibleCounts(finalNodes, finalEdges, input.groupMemberships ?? [])
  const truncated =
    totals.nodes > countedNodes.length ||
    totals.edges > finalEdges.length ||
    orderedNodes.length > nodeLimit ||
    edgesWithinReturnedNodes.length > edgeLimit

  return {
    revision: input.revision,
    state: 'ready',
    scope: input.scope,
    nodes: countedNodes,
    edges: finalEdges,
    totals,
    truncated,
    truncationReason: truncated
      ? createTruncationReason(totals, countedNodes.length, finalEdges.length, nodeLimit, edgeLimit)
      : null
  }
}

export function collapseGraphTopology(
  sourceNotes: readonly GraphSourceNote[],
  sourceLinks: readonly GraphSourceLink[]
): CollapsedTopology {
  const notes = sourceNotes
    .map((note) => ({
      ...note,
      relativePath: canonicalizeGraphRelativePath(note.relativePath),
      aliases: [...note.aliases],
      id: createGraphNoteId(note.relativePath)
    }))
    .sort(compareResolvedNotes)
  const notesByPath = new Map(notes.map((note) => [note.relativePath, note]))
  const notesByLinkKey = new Map<string, ResolvedGraphNote[]>()

  for (const note of notes) {
    for (const key of getNoteLinkKeys(note)) {
      const candidates = notesByLinkKey.get(key) ?? []
      candidates.push(note)
      notesByLinkKey.set(key, candidates)
    }
  }
  for (const candidates of notesByLinkKey.values()) {
    candidates.sort(compareResolvedNotes)
  }

  const ghostsById = new Map<string, MutableGhost>()
  const collapsedEdges = new Map<string, GraphEdge>()
  const orderedLinks = [...sourceLinks].sort(compareSourceLinks)

  for (const link of orderedLinks) {
    const sourcePath = canonicalizeGraphRelativePath(link.sourceRelativePath)
    const source = notesByPath.get(sourcePath)
    if (!source) continue

    const targetKey = link.targetNormalized || normalizeLinkKey(link.target)
    const candidates = targetKey ? (notesByLinkKey.get(targetKey) ?? []) : [source]
    let targetId: string

    if (candidates.length === 1) {
      targetId = candidates[0].id
    } else {
      const status = candidates.length > 1 ? 'ambiguous' : 'unresolved'
      targetId = createGraphGhostId(status, targetKey)
      const title = normalizeGhostTitle(link.target, targetKey)
      const existing = ghostsById.get(targetId)
      if (existing) {
        if (compareStableText(title, existing.title) < 0) {
          existing.title = title
        }
      } else {
        ghostsById.set(targetId, {
          id: targetId,
          status,
          title,
          candidatePaths: candidates.map((candidate) => candidate.relativePath)
        })
      }
    }

    const edgeId = createGraphEdgeId(source.id, targetId)
    const existingEdge = collapsedEdges.get(edgeId)
    if (existingEdge) {
      existingEdge.occurrenceCount += 1
    } else {
      collapsedEdges.set(edgeId, {
        id: edgeId,
        sourceId: source.id,
        targetId,
        occurrenceCount: 1
      })
    }
  }

  const nodesById = new Map<string, GraphNode>()
  for (const note of notes) {
    nodesById.set(note.id, {
      id: note.id,
      status: 'resolved',
      relativePath: note.relativePath,
      title: note.title || getFilenameStem(note.relativePath),
      candidatePaths: [],
      incomingCount: 0,
      outgoingCount: 0,
      degree: 0,
      orphan: true,
      groupIds: []
    })
  }
  for (const ghost of ghostsById.values()) {
    nodesById.set(ghost.id, {
      ...ghost,
      relativePath: null,
      incomingCount: 0,
      outgoingCount: 0,
      degree: 0,
      orphan: false,
      groupIds: []
    })
  }

  return {
    notesByPath,
    nodesById,
    edges: [...collapsedEdges.values()].sort(compareGraphEdges)
  }
}

export function traverseLocalGraph(
  edges: readonly GraphEdge[],
  rootId: string,
  depth: number
): Set<string> {
  const adjacency = new Map<string, Set<string>>()

  for (const edge of edges) {
    addAdjacent(adjacency, edge.sourceId, edge.targetId)
    addAdjacent(adjacency, edge.targetId, edge.sourceId)
  }

  const visited = new Set([rootId])
  let frontier = [rootId]
  const boundedDepth = Math.min(Math.max(Math.floor(depth), 1), 4)

  for (let level = 0; level < boundedDepth; level += 1) {
    const next = new Set<string>()
    for (const nodeId of frontier.sort(compareStableText)) {
      const neighbors = [...(adjacency.get(nodeId) ?? [])].sort(compareStableText)
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          next.add(neighbor)
        }
      }
    }
    frontier = [...next]
    if (frontier.length === 0) break
  }

  return visited
}

export function createGraphNoteId(relativePath: string): string {
  return `note:${encodeURIComponent(canonicalizeGraphRelativePath(relativePath))}`
}

export function createGraphGhostId(
  status: Exclude<GraphNodeStatus, 'resolved'>,
  normalizedTarget: string
): string {
  return `ghost:${status}:${encodeURIComponent(normalizedTarget)}`
}

export function createGraphEdgeId(sourceId: string, targetId: string): string {
  return `edge:${encodeURIComponent(sourceId)}>${encodeURIComponent(targetId)}`
}

export function canonicalizeGraphRelativePath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/').replace(/^\.\//u, '')
}

function calculateVisibleCounts(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  groupMemberships: readonly GraphGroupMembership[]
): GraphNode[] {
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  const normalizedGroupMemberships = groupMemberships.map((membership) => ({
    groupId: membership.group.id,
    relativePaths: new Set([...membership.relativePaths].map(canonicalizeGraphRelativePath))
  }))

  for (const edge of edges) {
    outgoing.set(edge.sourceId, (outgoing.get(edge.sourceId) ?? 0) + 1)
    incoming.set(edge.targetId, (incoming.get(edge.targetId) ?? 0) + 1)
  }

  return nodes.map((node) => {
    const incomingCount = incoming.get(node.id) ?? 0
    const outgoingCount = outgoing.get(node.id) ?? 0
    const relativePath = node.relativePath
    const groupIds =
      node.status === 'resolved' && relativePath
        ? normalizedGroupMemberships
            .filter((membership) => membership.relativePaths.has(relativePath))
            .map((membership) => membership.groupId)
        : []

    return {
      ...node,
      incomingCount,
      outgoingCount,
      degree: incomingCount + outgoingCount,
      orphan: node.status === 'resolved' && incomingCount + outgoingCount === 0,
      groupIds
    }
  })
}

function removeIsolatedGhosts(
  visibleNodeIds: Set<string>,
  edges: readonly GraphEdge[],
  nodesById: ReadonlyMap<string, GraphNode>
): void {
  const incidentIds = collectIncidentNodeIds(edges)
  for (const nodeId of visibleNodeIds) {
    const node = nodesById.get(nodeId)
    if (node && node.status !== 'resolved' && !incidentIds.has(nodeId)) {
      visibleNodeIds.delete(nodeId)
    }
  }
}

function removeHiddenOrphans(
  visibleNodeIds: Set<string>,
  edges: readonly GraphEdge[],
  nodesById: ReadonlyMap<string, GraphNode>,
  showOrphans: boolean,
  rootId: string | null
): void {
  if (showOrphans) return

  const incidentIds = collectIncidentNodeIds(edges)
  for (const nodeId of visibleNodeIds) {
    const node = nodesById.get(nodeId)
    if (node && node.status === 'resolved' && node.id !== rootId && !incidentIds.has(node.id)) {
      visibleNodeIds.delete(node.id)
    }
  }
}

function collectIncidentNodeIds(edges: readonly GraphEdge[]): Set<string> {
  const result = new Set<string>()
  for (const edge of edges) {
    result.add(edge.sourceId)
    result.add(edge.targetId)
  }
  return result
}

function orderGraphNodes(nodes: GraphNode[], rootId: string | null): GraphNode[] {
  return nodes.sort((left, right) => {
    if (left.id === rootId) return -1
    if (right.id === rootId) return 1
    if (left.status === 'resolved' && right.status !== 'resolved') return -1
    if (left.status !== 'resolved' && right.status === 'resolved') return 1
    return (
      compareStableText(left.relativePath ?? left.title, right.relativePath ?? right.title) ||
      compareStableText(left.id, right.id)
    )
  })
}

function createTruncationReason(
  totals: { nodes: number; edges: number },
  returnedNodes: number,
  returnedEdges: number,
  nodeLimit: number,
  edgeLimit: number
): string {
  return `Graph limited to ${returnedNodes} of ${totals.nodes} nodes and ${returnedEdges} of ${totals.edges} edges (caps: ${nodeLimit} nodes, ${edgeLimit} edges).`
}

function normalizeGhostTitle(target: string, normalizedTarget: string): string {
  return target.trim() || normalizedTarget || 'Unresolved link'
}

function clampLimit(value: number | undefined, maximum: number): number {
  if (value === undefined) return maximum
  return Math.min(Math.max(Math.floor(value), 1), maximum)
}

function addAdjacent(
  adjacency: Map<string, Set<string>>,
  sourceId: string,
  targetId: string
): void {
  const neighbors = adjacency.get(sourceId) ?? new Set<string>()
  neighbors.add(targetId)
  adjacency.set(sourceId, neighbors)
}

function compareResolvedNotes(left: ResolvedGraphNote, right: ResolvedGraphNote): number {
  return compareStableText(left.relativePath, right.relativePath)
}

function compareSourceLinks(left: GraphSourceLink, right: GraphSourceLink): number {
  return (
    compareStableText(left.sourceRelativePath, right.sourceRelativePath) ||
    compareStableText(left.targetNormalized, right.targetNormalized) ||
    compareStableText(left.target, right.target)
  )
}

function compareGraphEdges(left: GraphEdge, right: GraphEdge): number {
  return compareStableText(left.id, right.id)
}

function compareStableText(left: string, right: string): number {
  return left.localeCompare(right, 'en', { sensitivity: 'base' }) || left.localeCompare(right, 'en')
}
