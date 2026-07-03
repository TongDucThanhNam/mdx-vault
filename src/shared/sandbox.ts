import { z } from 'zod'

export const sandboxKindSchema = z.enum(['html', 'interactive'])
export type SandboxKind = z.infer<typeof sandboxKindSchema>

export const sandboxPermissionDecisionSchema = z.enum(['allow', 'deny'])
export type SandboxPermissionDecision = z.infer<typeof sandboxPermissionDecisionSchema>

export const sandboxPermissionsSchema = z
  .object({
    network: z.boolean().default(false),
    filesystem: z.boolean().default(false),
    dataPaths: z.array(z.string().min(1)).default([])
  })
  .strict()

export const sandboxManifestSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    runtime: z.enum(['html', 'react']),
    permissions: sandboxPermissionsSchema,
    propsSchema: z.record(z.string(), z.string()).default({}),
    dependencies: z.record(z.string(), z.string()).default({}),
    fallback: z.string().min(1).optional()
  })
  .strict()

export type SandboxManifest = z.infer<typeof sandboxManifestSchema>

export type SandboxPermissionStatus = 'allowed' | 'denied' | 'prompt'

export interface SandboxDescriptor {
  kind: SandboxKind
  src: string
  resolvedPath: string
  contentHash: string
  manifest: SandboxManifest
  permissionStatus: SandboxPermissionStatus
}

export interface SandboxDocument {
  kind: SandboxKind
  src: string
  resolvedPath: string
  contentHash: string
  instanceId: string
  srcDoc: string
}

export const sandboxDescribePayloadSchema = z
  .object({
    src: z.string().min(1),
    notePath: z.string().min(1).nullable()
  })
  .strict()

export const sandboxLoadPayloadSchema = sandboxDescribePayloadSchema.extend({
  contentHash: z.string().min(1),
  instanceId: z.string().min(1),
  props: z.unknown().optional()
})

export const sandboxSetPermissionPayloadSchema = sandboxDescribePayloadSchema.extend({
  kind: sandboxKindSchema,
  contentHash: z.string().min(1),
  decision: sandboxPermissionDecisionSchema
})

export const sandboxRequestDataPayloadSchema = sandboxDescribePayloadSchema.extend({
  kind: sandboxKindSchema,
  contentHash: z.string().min(1),
  path: z.string().min(1)
})

export const sandboxToHostMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      channel: z.literal('mdx-vault'),
      instanceId: z.string().min(1),
      type: z.literal('ready')
    })
    .strict(),
  z
    .object({
      channel: z.literal('mdx-vault'),
      instanceId: z.string().min(1),
      type: z.literal('resize'),
      height: z.number().finite().nonnegative().max(100000)
    })
    .strict(),
  z
    .object({
      channel: z.literal('mdx-vault'),
      instanceId: z.string().min(1),
      type: z.literal('requestData'),
      requestId: z.string().min(1),
      path: z.string().min(1)
    })
    .strict()
])

export const hostToSandboxMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      channel: z.literal('mdx-vault'),
      instanceId: z.string().min(1),
      type: z.literal('init'),
      props: z.unknown()
    })
    .strict(),
  z
    .object({
      channel: z.literal('mdx-vault'),
      instanceId: z.string().min(1),
      type: z.literal('dataResponse'),
      requestId: z.string().min(1),
      ok: z.literal(true),
      data: z.string()
    })
    .strict(),
  z
    .object({
      channel: z.literal('mdx-vault'),
      instanceId: z.string().min(1),
      type: z.literal('dataResponse'),
      requestId: z.string().min(1),
      ok: z.literal(false),
      error: z.string()
    })
    .strict()
])

export type SandboxToHostMessage = z.infer<typeof sandboxToHostMessageSchema>
export type HostToSandboxMessage = z.infer<typeof hostToSandboxMessageSchema>
