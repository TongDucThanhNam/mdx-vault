import { z } from 'zod'

import { HighlightBox, type HighlightBoxProps } from '../../islands/interactive-note/HighlightBox'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const highlightBoxPropsSchema: z.ZodType<HighlightBoxProps> = z
  .object({
    title: z.string().min(1).optional(),
    children: requiredReactNodeSchema
  })
  .strict()

export const highlightBoxRegistryEntry = defineRegistryEntry({
  name: 'HighlightBox',
  component: HighlightBox,
  propsSchema: highlightBoxPropsSchema,
  description: 'Editorial highlight with the source theme red rule.',
  category: 'interactive-note',
  insertSnippet: `<HighlightBox title="Version-dependent">
  State the important caveat here.
</HighlightBox>`
})
