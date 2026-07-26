import { z } from 'zod'

export const GRAPH_VIEW_VERSION = 1 as const
export const GRAPH_CONFIG_RELATIVE_PATH = '.app/graph-view.json' as const

export const MAX_GRAPH_NODES = 2_500
export const MAX_GRAPH_EDGES = 10_000
export const MAX_GRAPH_QUERY_LENGTH = 300
export const MAX_GRAPH_GROUPS = 8
export const MAX_GRAPH_LOCAL_DEPTH = 4
export const MAX_GRAPH_LABEL_LENGTH = 500
export const MAX_GRAPH_GROUP_ID_LENGTH = 80
export const MAX_GRAPH_CANDIDATE_PATHS = MAX_GRAPH_NODES

export const graphDepthSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])

export type GraphDepth = z.infer<typeof graphDepthSchema>

export const graphRelativePathSchema = z
  .string()
  .min(1)
  .max(1_024)
  .refine((value) => {
    const normalized = value.replaceAll('\\', '/')
    return (
      !value.includes('\0') &&
      !normalized.startsWith('/') &&
      !/^[a-z]:/iu.test(normalized) &&
      !normalized.split('/').includes('..')
    )
  }, 'Graph paths must stay vault-relative')

export const graphScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('global') }).strict(),
  z
    .object({
      kind: z.literal('local'),
      rootRelativePath: graphRelativePathSchema,
      depth: graphDepthSchema
    })
    .strict()
])

export type GraphScope = z.infer<typeof graphScopeSchema>

export const graphNodeStatusSchema = z.enum(['resolved', 'unresolved', 'ambiguous'])
export type GraphNodeStatus = z.infer<typeof graphNodeStatusSchema>

export const graphNodeSchema = z
  .object({
    id: z.string().min(1).max(2_048),
    status: graphNodeStatusSchema,
    relativePath: graphRelativePathSchema.nullable(),
    title: z.string().min(1).max(MAX_GRAPH_LABEL_LENGTH),
    candidatePaths: z.array(graphRelativePathSchema).max(MAX_GRAPH_CANDIDATE_PATHS),
    incomingCount: z.number().int().nonnegative(),
    outgoingCount: z.number().int().nonnegative(),
    degree: z.number().int().nonnegative(),
    orphan: z.boolean(),
    groupIds: z.array(z.string().min(1).max(MAX_GRAPH_GROUP_ID_LENGTH)).max(MAX_GRAPH_GROUPS)
  })
  .strict()

export type GraphNode = z.infer<typeof graphNodeSchema>

export const graphEdgeSchema = z
  .object({
    id: z.string().min(1).max(4_096),
    sourceId: z.string().min(1).max(2_048),
    targetId: z.string().min(1).max(2_048),
    occurrenceCount: z.number().int().positive()
  })
  .strict()

export type GraphEdge = z.infer<typeof graphEdgeSchema>

export const graphSnapshotStateSchema = z.enum(['ready', 'missing-root'])
export type GraphSnapshotState = z.infer<typeof graphSnapshotStateSchema>

export const graphSnapshotSchema = z
  .object({
    revision: z.string().min(1).max(500),
    state: graphSnapshotStateSchema,
    scope: graphScopeSchema,
    nodes: z.array(graphNodeSchema).max(MAX_GRAPH_NODES),
    edges: z.array(graphEdgeSchema).max(MAX_GRAPH_EDGES),
    totals: z
      .object({
        nodes: z.number().int().nonnegative(),
        edges: z.number().int().nonnegative()
      })
      .strict(),
    truncated: z.boolean(),
    truncationReason: z.string().min(1).max(500).nullable()
  })
  .strict()
  .superRefine((snapshot, context) => {
    const nodeIds = new Set(snapshot.nodes.map((node) => node.id))
    const edgeIds = new Set<string>()

    for (const edge of snapshot.edges) {
      if (edgeIds.has(edge.id)) {
        context.addIssue({ code: 'custom', message: `Duplicate graph edge ID: ${edge.id}` })
      }
      edgeIds.add(edge.id)
      if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) {
        context.addIssue({ code: 'custom', message: `Dangling graph edge: ${edge.id}` })
      }
    }
  })

export type GraphSnapshot = z.infer<typeof graphSnapshotSchema>

export const graphVisualTokenSchema = z.enum([
  'slate',
  'blue',
  'red',
  'green',
  'gold',
  'violet',
  'cyan',
  'orange'
])

export type GraphVisualToken = z.infer<typeof graphVisualTokenSchema>

export const graphGroupSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(MAX_GRAPH_GROUP_ID_LENGTH)
      .regex(/^[a-z0-9][a-z0-9_-]*$/iu),
    label: z.string().min(1).max(80),
    query: z.string().max(MAX_GRAPH_QUERY_LENGTH),
    visualToken: graphVisualTokenSchema
  })
  .strict()

export type GraphGroup = z.infer<typeof graphGroupSchema>

export const graphViewSettingsSchema = z
  .object({
    query: z.string().max(MAX_GRAPH_QUERY_LENGTH),
    existingOnly: z.boolean(),
    showOrphans: z.boolean(),
    arrows: z.boolean(),
    labelFadeThreshold: z.number().min(0).max(1),
    nodeSize: z.number().min(4).max(40),
    linkThickness: z.number().min(0.5).max(6),
    centerForce: z.number().min(0).max(5),
    repelForce: z.number().min(128).max(16_384),
    linkForce: z.number().min(1).max(256),
    linkDistance: z.number().min(16).max(256)
  })
  .strict()

export type GraphViewSettings = z.infer<typeof graphViewSettingsSchema>

export const localGraphViewSettingsSchema = graphViewSettingsSchema.extend({
  depth: graphDepthSchema
})

export type LocalGraphViewSettings = z.infer<typeof localGraphViewSettingsSchema>

export const graphViewManifestSchema = z
  .object({
    version: z.literal(GRAPH_VIEW_VERSION),
    revision: z.number().int().nonnegative(),
    global: graphViewSettingsSchema,
    local: localGraphViewSettingsSchema,
    groups: z.array(graphGroupSchema).max(MAX_GRAPH_GROUPS)
  })
  .strict()
  .superRefine((manifest, context) => {
    const groupIds = new Set<string>()
    for (const group of manifest.groups) {
      if (groupIds.has(group.id)) {
        context.addIssue({ code: 'custom', message: `Duplicate graph group ID: ${group.id}` })
      }
      groupIds.add(group.id)
    }
  })

export type GraphViewManifest = z.infer<typeof graphViewManifestSchema>

export const graphSnapshotRequestSchema = z
  .object({
    scope: graphScopeSchema,
    settings: graphViewSettingsSchema,
    groups: z.array(graphGroupSchema).max(MAX_GRAPH_GROUPS)
  })
  .strict()
  .superRefine((request, context) => {
    const groupIds = new Set<string>()
    for (const group of request.groups) {
      if (groupIds.has(group.id)) {
        context.addIssue({ code: 'custom', message: `Duplicate graph group ID: ${group.id}` })
      }
      groupIds.add(group.id)
    }
  })

export type GraphSnapshotRequest = z.infer<typeof graphSnapshotRequestSchema>

export const graphConfigRecoverySchema = z
  .object({
    kind: z.enum(['corrupt', 'unsupported-version']),
    relativePath: z.literal(GRAPH_CONFIG_RELATIVE_PATH)
  })
  .strict()

export type GraphConfigRecovery = z.infer<typeof graphConfigRecoverySchema>

export const graphConfigLoadResultSchema = z
  .object({
    manifest: graphViewManifestSchema,
    recovery: graphConfigRecoverySchema.nullable()
  })
  .strict()

export type GraphConfigLoadResult = z.infer<typeof graphConfigLoadResultSchema>

export const graphConfigSaveRequestSchema = z
  .object({
    manifest: graphViewManifestSchema,
    expectedRevision: z.number().int().nonnegative()
  })
  .strict()

export type GraphConfigSaveRequest = z.infer<typeof graphConfigSaveRequestSchema>

export const DEFAULT_GRAPH_VIEW_SETTINGS: GraphViewSettings = {
  query: '',
  existingOnly: false,
  showOrphans: true,
  arrows: true,
  labelFadeThreshold: 0.35,
  nodeSize: 12,
  linkThickness: 1.5,
  centerForce: 1,
  repelForce: 2_048,
  linkForce: 32,
  linkDistance: 56
}

export const DEFAULT_LOCAL_GRAPH_VIEW_SETTINGS: LocalGraphViewSettings = {
  ...DEFAULT_GRAPH_VIEW_SETTINGS,
  depth: 1
}

export function createDefaultGraphViewManifest(): GraphViewManifest {
  return {
    version: GRAPH_VIEW_VERSION,
    revision: 0,
    global: { ...DEFAULT_GRAPH_VIEW_SETTINGS },
    local: { ...DEFAULT_LOCAL_GRAPH_VIEW_SETTINGS },
    groups: []
  }
}
