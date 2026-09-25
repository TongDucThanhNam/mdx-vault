import { z } from 'zod'

import { SelfTest, type SelfTestProps } from '../../islands/interactive-note/SelfTest'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const selfTestPropsSchema: z.ZodType<SelfTestProps> = z
  .object({
    children: requiredReactNodeSchema
  })
  .strict()

export const selfTestRegistryEntry = defineRegistryEntry({
  name: 'SelfTest',
  component: SelfTest,
  propsSchema: selfTestPropsSchema,
  description: 'Retrieval-practice container for level 3, 4, and 5 questions.',
  category: 'interactive-note',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/interactive-note/self-test.ts',
    entryExport: 'selfTestRegistryEntry',
    static: 'render',
    interactive: 'hydrate'
  },
  insertSnippet: `<SelfTest>
  <SelfTestItem level={3} question="Explain the mechanism from memory.">
    Put the answer and a link back to the relevant section here.
  </SelfTestItem>
</SelfTest>`
})
