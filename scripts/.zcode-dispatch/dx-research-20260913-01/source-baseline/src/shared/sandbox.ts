import { z } from 'zod'
import type { InteractiveDiagnostic } from './interactive-authoring'

export const INTERACTIVE_PREVIEW_PROPS_MAX_BYTES = 64 * 1024

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
  documentUrl: string
}

export type SandboxAuthoringProofResult =
  | { status: 'ready'; document: SandboxDocument }
  | { status: 'issues'; diagnostics: InteractiveDiagnostic[] }

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

const boundedAuthoringPropsSchema = z
  .record(z.string(), z.unknown())
  .superRefine((props, context) => {
    let serialized: string
    try {
      serialized = JSON.stringify(props)
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Authoring proof props must be JSON-serializable'
      })
      return
    }
    if (new TextEncoder().encode(serialized).byteLength > INTERACTIVE_PREVIEW_PROPS_MAX_BYTES) {
      context.addIssue({
        code: 'too_big',
        origin: 'string',
        maximum: INTERACTIVE_PREVIEW_PROPS_MAX_BYTES,
        inclusive: true,
        message: 'Authoring proof props cannot exceed 64 KiB'
      })
    }
  })

export const sandboxAuthoringProofLoadPayloadSchema = z
  .object({
    mode: z.literal('authoring-proof'),
    projectRoot: z
      .string()
      .min(1)
      .max(1024)
      .regex(
        /^interactives\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Authoring proof requires a canonical interactive project root'
      ),
    instanceId: z.string().min(1).max(128),
    props: boundedAuthoringPropsSchema
  })
  .strict()

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
    .strict(),
  z
    .object({
      channel: z.literal('mdx-vault'),
      instanceId: z.string().min(1),
      type: z.literal('runtimeError'),
      kind: z.enum(['error', 'unhandledrejection']),
      message: z.string().min(1).max(8192),
      stack: z.string().max(16_384).nullable()
    })
    .strict()
])

export const hostToSandboxMessageSchema = z.union([
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

export function getSandboxPropsValidationErrors(
  manifest: SandboxManifest,
  props: unknown
): string[] {
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return Object.keys(manifest.propsSchema).length === 0
      ? []
      : ['Interactive props must be an object']
  }

  const input = props as Record<string, unknown>
  const allowedKeys = new Set(Object.keys(manifest.propsSchema))
  const extraKey = Object.keys(input).find((key) => !allowedKeys.has(key))
  if (extraKey) {
    return [`Unknown interactive prop: ${extraKey}`]
  }

  const errors: string[] = []
  for (const [key, expectedType] of Object.entries(manifest.propsSchema)) {
    if (!matchesManifestType(input[key], expectedType)) {
      errors.push(`Invalid prop "${key}": expected ${expectedType}`)
    }
  }
  return errors
}

function matchesManifestType(value: unknown, expectedType: string): boolean {
  if (expectedType === 'array') {
    return Array.isArray(value)
  }
  if (expectedType === 'object') {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value))
  }
  if (expectedType === 'number') {
    return typeof value === 'number' && Number.isFinite(value)
  }
  if (expectedType === 'string' || expectedType === 'boolean') {
    return typeof value === expectedType
  }
  return false
}
