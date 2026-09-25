import { z } from 'zod'

import {
  ComparisonBars,
  type ComparisonBarsProps
} from '../../islands/interactive-note/ComparisonBars'
import { defineRegistryEntry } from '../types'

const comparisonBarItemSchema = z
  .object({
    label: z.string().min(1),
    value: z.number().nonnegative(),
    display: z.string().min(1).optional(),
    bad: z.boolean().optional()
  })
  .strict()

const comparisonBarsPropsSchema: z.ZodType<ComparisonBarsProps> = z
  .object({
    items: z.array(comparisonBarItemSchema).min(1),
    caption: z.string().min(1).optional()
  })
  .strict()

export const comparisonBarsRegistryEntry = defineRegistryEntry({
  name: 'ComparisonBars',
  component: ComparisonBars,
  propsSchema: comparisonBarsPropsSchema,
  description: 'Static horizontal comparison bars scaled to the largest value.',
  category: 'interactive-note',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/interactive-note/comparison-bars.ts',
    entryExport: 'comparisonBarsRegistryEntry',
    static: 'render',
    interactive: 'hydrate'
  },
  insertSnippet: `<ComparisonBars
  items={[
    { label: "Row-major misses", value: 4, display: "4" },
    { label: "Column-major misses", value: 16, display: "16", bad: true }
  ]}
  caption="Same work count, different line-fill count"
/>`
})
