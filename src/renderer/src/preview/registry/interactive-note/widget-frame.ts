import { z } from 'zod'

import { WidgetFrame, type WidgetFrameProps } from '../../islands/interactive-note/WidgetFrame'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const widgetFramePropsSchema: z.ZodType<WidgetFrameProps> = z
  .object({
    title: z.string().min(1),
    misconception: z.string().min(1).optional(),
    children: requiredReactNodeSchema
  })
  .strict()

export const widgetFrameRegistryEntry = defineRegistryEntry({
  name: 'WidgetFrame',
  component: WidgetFrame,
  propsSchema: widgetFramePropsSchema,
  description: 'Hard-shadow widget frame with LOCKED, READY, and DONE context state.',
  category: 'interactive-note',
  insertSnippet: `<WidgetFrame
  title="Stride Explorer"
  misconception="A regular access pattern always benefits from cache."
>
  <PredictionGate
    question="At which stride does spatial locality disappear?"
    options={["2 elements", "4 elements", "8 elements"]}
    answer="8 elements"
    explain="A stride equal to the line size touches a new line every time."
  />
</WidgetFrame>`
})
