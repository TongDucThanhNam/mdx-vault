import { z } from 'zod'

import { Counter } from '../Counter'
import { defineRegistryEntry } from './types'

const counterPropsSchema = z
  .object({
    initial: z.number().optional()
  })
  .strict()

export const counterRegistryEntry = defineRegistryEntry({
  name: 'Counter',
  component: Counter,
  propsSchema: counterPropsSchema,
  description: 'Small demo counter used to prove trusted component rendering.',
  category: 'demo',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/counter.ts',
    entryExport: 'counterRegistryEntry',
    static: 'counter-summary',
    interactive: 'hydrate'
  },
  defaultProps: {
    initial: 0
  }
})
