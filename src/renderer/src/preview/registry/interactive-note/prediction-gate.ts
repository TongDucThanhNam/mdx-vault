import { z } from 'zod'

import {
  PredictionGate,
  type PredictionGateProps
} from '../../islands/interactive-note/PredictionGate'
import { defineRegistryEntry } from '../types'

const predictionGatePropsSchema: z.ZodType<PredictionGateProps> = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answer: z.string().min(1).optional(),
    explain: z.string().min(1).optional()
  })
  .strict()
  .superRefine((props, context) => {
    if (props.answer !== undefined && !props.options.includes(props.answer)) {
      context.addIssue({
        code: 'custom',
        path: ['answer'],
        message: 'answer must match one of the options'
      })
    }
  })

export const predictionGateRegistryEntry = defineRegistryEntry({
  name: 'PredictionGate',
  component: PredictionGate,
  propsSchema: predictionGatePropsSchema,
  description: 'Commit-once prediction with immediate correct or incorrect verdict.',
  category: 'interactive-note',
  insertSnippet: `<PredictionGate
  question="What will happen before you reveal the result?"
  options={["Outcome A", "Outcome B", "Outcome C"]}
  answer="Outcome B"
  explain="Explain the mechanism behind the result."
/>`
})
