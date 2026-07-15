import { z } from 'zod'

import { CellGrid, type CellGridProps } from '../../islands/interactive-note/CellGrid'
import { defineRegistryEntry } from '../types'

const cellGridCellSchema = z
  .object({
    label: z.string().optional(),
    state: z.enum(['default', 'current', 'hit', 'miss', 'cached', 'dim']).optional()
  })
  .strict()

const cellGridPropsSchema: z.ZodType<CellGridProps> = z
  .object({
    columns: z.number().int().min(1).max(32),
    cells: z.array(cellGridCellSchema).min(1),
    caption: z.string().min(1).optional(),
    groupSize: z.number().int().min(1).max(32).optional(),
    groupLabels: z.array(z.string().min(1)).optional()
  })
  .strict()
  .superRefine((props, context) => {
    if (props.groupLabels && !props.groupSize) {
      context.addIssue({
        code: 'custom',
        message: 'groupLabels requires groupSize',
        path: ['groupLabels']
      })
    }

    if (props.groupSize && props.columns % props.groupSize !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'groupSize must divide columns evenly',
        path: ['groupSize']
      })
    }
  })

export const cellGridRegistryEntry = defineRegistryEntry({
  name: 'CellGrid',
  component: CellGrid,
  propsSchema: cellGridPropsSchema,
  description: 'Static state-cell grid with optional brackets for contiguous groups.',
  category: 'interactive-note',
  insertSnippet: `<CellGrid
  columns={4}
  cells={[
    { label: "0" }, { label: "1", state: "current" },
    { label: "2", state: "hit" }, { label: "3", state: "cached" }
  ]}
  groupSize={4}
  groupLabels={["LINE 0"]}
  caption="Four adjacent values share one cache line"
/>`
})
