import type { ComponentType } from 'react'
import type { z } from 'zod'

export type RegistryCategory = 'demo' | 'content' | 'data' | 'layout' | 'interactive-note'

export interface ComponentRegistryEntry<TProps extends object = object> {
  name: string
  component: ComponentType<TProps>
  propsSchema: z.ZodType<TProps>
  description: string
  category: RegistryCategory
  defaultProps?: Partial<TProps>
  insertSnippet?: string
}

export function defineRegistryEntry<TProps extends object>(
  entry: ComponentRegistryEntry<TProps>
): ComponentRegistryEntry<TProps> {
  return entry
}
