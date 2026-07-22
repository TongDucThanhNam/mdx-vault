import { z } from 'zod'

import {
  MentalModelRow,
  type MentalModelRowProps
} from '../../islands/interactive-note/MentalModelRow'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const mentalModelRowPropsSchema: z.ZodType<MentalModelRowProps> = z
  .object({
    label: z.string().min(1),
    conflict: z.boolean().optional(),
    children: requiredReactNodeSchema
  })
  .strict()

export const mentalModelRowRegistryEntry = defineRegistryEntry({
  name: 'MentalModelRow',
  component: MentalModelRow,
  propsSchema: mentalModelRowPropsSchema,
  description: 'One labelled mental-model row; conflict rows use the red accent.',
  category: 'interactive-note',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/interactive-note/mental-model-row.ts',
    entryExport: 'mentalModelRowRegistryEntry',
    static: 'render',
    interactive: 'hydrate'
  },
  insertSnippet: `<MentalModel>
  <MentalModelRow label="Conflicts" conflict>The misconception this concept invalidates.</MentalModelRow>
</MentalModel>`
})
