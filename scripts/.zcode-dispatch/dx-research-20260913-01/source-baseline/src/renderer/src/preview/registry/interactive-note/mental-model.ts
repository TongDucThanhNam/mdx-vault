import { z } from 'zod'

import { MentalModel, type MentalModelProps } from '../../islands/interactive-note/MentalModel'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const mentalModelPropsSchema: z.ZodType<MentalModelProps> = z
  .object({
    children: requiredReactNodeSchema
  })
  .strict()

export const mentalModelRegistryEntry = defineRegistryEntry({
  name: 'MentalModel',
  component: MentalModel,
  propsSchema: mentalModelPropsSchema,
  description: 'Two-column grid for extends, conflicts, requires, and misapplication.',
  category: 'interactive-note',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/interactive-note/mental-model.ts',
    entryExport: 'mentalModelRegistryEntry',
    static: 'render',
    interactive: 'hydrate'
  },
  insertSnippet: `<MentalModel>
  <MentalModelRow label="Extends">The model this concept extends.</MentalModelRow>
  <MentalModelRow label="Conflicts" conflict>The misconception it invalidates.</MentalModelRow>
  <MentalModelRow label="Requires">The prerequisite model.</MentalModelRow>
  <MentalModelRow label="Misapplication">Where the model is commonly misused.</MentalModelRow>
</MentalModel>`
})
