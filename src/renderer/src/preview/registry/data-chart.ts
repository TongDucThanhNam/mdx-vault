import { z } from 'zod'

import { DataChart } from '../islands/DataChart'
import { defineRegistryEntry } from './types'

const chartPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
const chartDatumSchema = z.record(z.string(), chartPrimitiveSchema)

const dataChartPropsSchema = z
  .object({
    type: z.enum(['line', 'bar', 'scatter']),
    data: z.array(chartDatumSchema).optional(),
    src: z.string().min(1).optional(),
    x: z.string().min(1),
    y: z.string().min(1),
    title: z.string().min(1).optional()
  })
  .strict()
  .superRefine((props, context) => {
    if (!props.data && !props.src) {
      context.addIssue({
        code: 'custom',
        path: ['data'],
        message: 'Provide either inline data or src'
      })
    }

    if (props.data && props.src) {
      context.addIssue({
        code: 'custom',
        path: ['src'],
        message: 'Use either inline data or src, not both'
      })
    }
  })

export const dataChartRegistryEntry = defineRegistryEntry({
  name: 'DataChart',
  component: DataChart,
  propsSchema: dataChartPropsSchema,
  description: 'Responsive Recharts line, bar, or scatter chart from inline data or a vault asset.',
  category: 'data',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/data-chart.ts',
    entryExport: 'dataChartRegistryEntry',
    static: 'data-table',
    interactive: 'hydrate'
  },
  defaultProps: {
    type: 'line',
    x: 'x',
    y: 'y',
    title: 'Sample dataset'
  },
  insertSnippet: `<DataChart
  title="Sample dataset"
  type="line"
  src="../assets/datasets/sample.csv"
  x="x"
  y="y"
/>`
})
