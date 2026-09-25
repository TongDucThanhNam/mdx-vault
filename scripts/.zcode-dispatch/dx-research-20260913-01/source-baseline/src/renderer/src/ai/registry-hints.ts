/**
 * `registry-hints.ts` — build a small, model-readable description of each
 * registry component. Used to populate `AssistantContext.registryTemplateHints`
 * so the model knows what's available before deciding whether to emit an
 * `interactiveInsert` (template) vs a `componentDraft` (new code).
 *
 * We deliberately walk zod schemas through a permissive `(schema as any)`
 * adapter rather than relying on `_def` internals — zod 4 reorganised those
 * types, and we only need a textual approximation for the model hint.
 */

import { componentRegistry } from '@/preview/registry'
import type { ComponentRegistryEntry } from '@/preview/registry/types'

export interface RegistryTemplateHint {
  name: string
  description: string
  category: string
  snippet?: string
  propsSchemaDescription: string
}

const SAFE_PROP_DEPTH = 3

type ZodLike = {
  _def?: { typeName?: string; innerType?: ZodLike }
  // v3-compatible shapes we still encounter in some shims:
  shape?: () => Record<string, ZodLike>
  options?: ZodLike[]
  items?: ZodLike
  values?: unknown
  value?: unknown
}

/**
 * Best-effort description of a zod schema. Returns a string like
 *   "{ name: string, options?: string[] }"
 * which is enough for the model to write an `<X ... />` snippet.
 */
export function describeZodSchema(schema: unknown, depth = 0): string {
  if (depth > SAFE_PROP_DEPTH) {
    return '…'
  }
  if (!schema || typeof schema !== 'object') {
    return 'unknown'
  }

  const inner = unwrapOptional(schema as ZodLike)

  // Object — use the v3-style `shape()` accessor first, falling back to a
  // property scan on the schema itself (v4 stores shape under `_def.shape`).
  if (typeof inner.shape === 'function') {
    return describeObject(inner.shape(), depth)
  }

  const def = (inner as { _def?: { typeName?: string; shape?: () => Record<string, ZodLike> } })
    ._def
  if (def?.shape && typeof def.shape === 'function') {
    return describeObject(def.shape(), depth)
  }

  const typeName = def?.typeName

  switch (typeName) {
    case 'ZodString':
      return 'string'
    case 'ZodNumber':
      return 'number'
    case 'ZodBoolean':
      return 'boolean'
    case 'ZodEnum': {
      const rawValues =
        (def as { values?: unknown } | undefined)?.values ??
        (inner as ZodLike & { values?: unknown }).values
      const values = Array.isArray(rawValues) ? (rawValues as unknown[]) : []
      return values.map((value) => JSON.stringify(value)).join(' | ') || 'enum'
    }
    case 'ZodLiteral':
      return JSON.stringify(
        (inner as ZodLike & { value?: unknown }).value ??
          (def as { value?: unknown } | undefined)?.value
      )
    case 'ZodArray': {
      const items = (inner as ZodLike & { items?: unknown }).items
      return `array<${items ? describeZodSchema(items, depth + 1) : 'unknown'}>`
    }
    case 'ZodUnion': {
      const options = (inner as ZodLike & { options?: unknown[] }).options ?? []
      return options.map((option) => describeZodSchema(option, depth + 1)).join(' | ')
    }
    case 'ZodRecord':
      return 'record<string, unknown>'
    default:
      return 'unknown'
  }
}

function unwrapOptional(schema: ZodLike): ZodLike {
  let inner: ZodLike = schema
  // Bound the unwrap loop defensively.
  for (let index = 0; index < 4; index += 1) {
    const def = inner._def
    const typeName = def?.typeName
    if (
      (typeName === 'ZodOptional' || typeName === 'ZodNullable' || typeName === 'ZodDefault') &&
      def?.innerType
    ) {
      inner = def.innerType
      continue
    }
    break
  }
  return inner
}

function describeObject(shape: Record<string, ZodLike>, depth: number): string {
  const fields = Object.entries(shape).map(([key, child]) => {
    const required = !isOptionalLike(child)
    const description = describeZodSchema(child, depth + 1)
    return `${key}${required ? '' : '?'}: ${description}`
  })
  return `{ ${fields.join(', ')} }`
}

function isOptionalLike(schema: ZodLike): boolean {
  const name = schema._def?.typeName
  return name === 'ZodOptional' || name === 'ZodNullable' || name === 'ZodDefault'
}

/** Build the hints we send to the model for the current registry. */
export function buildRegistryTemplateHints(): RegistryTemplateHint[] {
  return componentRegistry.map((entry) =>
    buildHintForEntry(entry as ComponentRegistryEntry<object>)
  )
}

function buildHintForEntry(entry: ComponentRegistryEntry<object>): RegistryTemplateHint {
  const propsSchemaDescription = describeZodSchema(entry.propsSchema)
  const hint: RegistryTemplateHint = {
    name: entry.name,
    description: entry.description,
    category: entry.category,
    propsSchemaDescription
  }

  if (entry.insertSnippet !== undefined) {
    hint.snippet = entry.insertSnippet
  }

  return hint
}
