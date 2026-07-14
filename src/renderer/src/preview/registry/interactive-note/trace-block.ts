import { z } from 'zod'

import { TraceBlock, type TraceBlockProps } from '../../islands/interactive-note/TraceBlock'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const traceBlockPropsSchema: z.ZodType<TraceBlockProps> = z
  .object({
    children: requiredReactNodeSchema
  })
  .strict()

export const traceBlockRegistryEntry = defineRegistryEntry({
  name: 'TraceBlock',
  component: TraceBlock,
  propsSchema: traceBlockPropsSchema,
  description: 'Whitespace-preserving mechanism trace in Courier Prime.',
  category: 'interactive-note',
  insertSnippet: `<TraceBlock>{\`Load address X
  → L1 lookup
  → RAM fetch on miss
  → Fill the whole cache line\`}</TraceBlock>`
})
