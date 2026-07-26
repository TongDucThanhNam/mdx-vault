import {
  type GraphSnapshot,
  type GraphSnapshotRequest,
  graphSnapshotRequestSchema,
  graphSnapshotSchema,
  MAX_GRAPH_EDGES,
  MAX_GRAPH_NODES
} from '../../shared/graph'
import { buildGraphSnapshot, type GraphGroupMembership } from '../../shared/graph-model'
import type { DbService, GraphSourceData } from './db-service'

export type GraphQueryDatabase = Pick<DbService, 'getGraphSourceData' | 'matchGraphNotePaths'>

export class GraphQueryService {
  private readonly database: GraphQueryDatabase
  private readonly getRevision: () => string

  constructor(database: GraphQueryDatabase, getRevision: () => string) {
    this.database = database
    this.getRevision = getRevision
  }

  getSnapshot(request: GraphSnapshotRequest): GraphSnapshot {
    const input = graphSnapshotRequestSchema.parse(request)
    const source = this.database.getGraphSourceData(MAX_GRAPH_NODES, MAX_GRAPH_EDGES)
    const includedRelativePaths = input.settings.query.trim()
      ? new Set(this.database.matchGraphNotePaths(input.settings.query, MAX_GRAPH_NODES))
      : null
    const groupMemberships: GraphGroupMembership[] = input.groups.map((group) => ({
      group,
      relativePaths: group.query.trim()
        ? new Set(this.database.matchGraphNotePaths(group.query, MAX_GRAPH_NODES))
        : new Set()
    }))
    const snapshot = buildGraphSnapshot({
      revision: this.getRevision(),
      scope: input.scope,
      notes: source.notes,
      links: source.links,
      includedRelativePaths,
      groupMemberships,
      existingOnly: input.settings.existingOnly,
      showOrphans: input.settings.showOrphans,
      nodeLimit: MAX_GRAPH_NODES,
      edgeLimit: MAX_GRAPH_EDGES
    })

    return graphSnapshotSchema.parse(withSourceTruncation(snapshot, source))
  }
}

function withSourceTruncation(snapshot: GraphSnapshot, source: GraphSourceData): GraphSnapshot {
  if (!source.sourceTruncated) {
    return snapshot
  }

  const sourceReason =
    `Source scan limited to ${source.notes.length} of ${source.totals.notes} indexed notes ` +
    `and ${source.links.length} of ${source.totals.links} authored links.`

  return {
    ...snapshot,
    truncated: true,
    truncationReason: snapshot.truncationReason
      ? `${snapshot.truncationReason} ${sourceReason}`
      : sourceReason
  }
}
