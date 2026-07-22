import { z } from 'zod'

import { Recap, type RecapProps } from '../../islands/interactive-note/Recap'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const recapPropsSchema: z.ZodType<RecapProps> = z
  .object({
    children: requiredReactNodeSchema
  })
  .strict()

export const recapRegistryEntry = defineRegistryEntry({
  name: 'Recap',
  component: Recap,
  propsSchema: recapPropsSchema,
  description: 'Static post-widget result for fast repeat reading.',
  category: 'interactive-note',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/interactive-note/recap.ts',
    entryExport: 'recapRegistryEntry',
    static: 'render',
    interactive: 'hydrate'
  },
  insertSnippet: `<Recap>
  State the durable result here, after the prediction gate.
</Recap>`
})
