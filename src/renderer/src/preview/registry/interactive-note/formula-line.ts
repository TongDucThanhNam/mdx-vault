import { z } from 'zod'

import { FormulaLine, type FormulaLineProps } from '../../islands/interactive-note/FormulaLine'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const formulaLinePropsSchema: z.ZodType<FormulaLineProps> = z
  .object({
    children: requiredReactNodeSchema
  })
  .strict()

export const formulaLineRegistryEntry = defineRegistryEntry({
  name: 'FormulaLine',
  component: FormulaLine,
  propsSchema: formulaLinePropsSchema,
  description: 'Monospace formula or result line with a hard shadow.',
  category: 'interactive-note',
  insertSnippet: `<FormulaLine>hit ratio = 1 - stride / line size</FormulaLine>`
})
