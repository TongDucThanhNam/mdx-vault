import type { ComponentType } from 'react'
import type { z } from 'zod'

export type RegistryCategory = 'demo' | 'content' | 'data' | 'layout' | 'interactive-note'

export type RegistryStaticExportPolicy =
  | 'render'
  | 'counter-summary'
  | 'quiz-disclosure'
  | 'equation-summary'
  | 'data-table'
  | 'algorithm-summary'
  | 'widget-frame'
  | 'prediction-disclosure'
  | 'self-test-disclosure'

export interface RegistryExportPolicy {
  /** Repository-relative module containing the named registry entry. */
  modulePath: string
  /** Named export imported by the per-note browser bundle. */
  entryExport: string
  static: RegistryStaticExportPolicy
  interactive: 'hydrate'
}

export interface ComponentRegistryEntry<TProps extends object = object> {
  name: string
  component: ComponentType<TProps>
  propsSchema: z.ZodType<TProps>
  description: string
  category: RegistryCategory
  exportPolicy: RegistryExportPolicy
  defaultProps?: Partial<TProps>
  insertSnippet?: string
}

export function defineRegistryEntry<TProps extends object>(
  entry: ComponentRegistryEntry<TProps>
): ComponentRegistryEntry<TProps> {
  return entry
}
