import { z } from 'zod'

import { SelfTestItem, type SelfTestItemProps } from '../../islands/interactive-note/SelfTestItem'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const selfTestItemPropsSchema: z.ZodType<SelfTestItemProps> = z
  .object({
    level: z.union([z.literal(3), z.literal(4), z.literal(5)]),
    question: z.string().min(1),
    children: requiredReactNodeSchema
  })
  .strict()

export const selfTestItemRegistryEntry = defineRegistryEntry({
  name: 'SelfTestItem',
  component: SelfTestItem,
  propsSchema: selfTestItemPropsSchema,
  description: 'Levelled self-test question with an answer hidden until reveal.',
  category: 'interactive-note',
  insertSnippet: `<SelfTest>
  <SelfTestItem level={3} question="Explain the mechanism from memory.">
    Put the answer and a link back to the relevant section here.
  </SelfTestItem>
</SelfTest>`
})
