import { z } from 'zod'

import { QuizBlock } from '../islands/QuizBlock'
import { defineRegistryEntry } from './types'

const quizBlockPropsSchema = z
  .object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answerIndex: z.number().int().min(0),
    explanation: z.string().min(1).optional()
  })
  .strict()
  .superRefine((props, context) => {
    if (props.answerIndex >= props.options.length) {
      context.addIssue({
        code: 'custom',
        path: ['answerIndex'],
        message: 'answerIndex must point to an option'
      })
    }
  })

export const quizBlockRegistryEntry = defineRegistryEntry({
  name: 'QuizBlock',
  component: QuizBlock,
  propsSchema: quizBlockPropsSchema,
  description: 'Multiple-choice question with immediate feedback and an explanation.',
  category: 'content',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/quiz-block.ts',
    entryExport: 'quizBlockRegistryEntry',
    static: 'quiz-disclosure',
    interactive: 'hydrate'
  },
  defaultProps: {
    question: 'Which invariant makes binary search valid?',
    options: ['The input is sorted', 'The input is random', 'The array has no duplicates'],
    answerIndex: 0,
    explanation: 'Binary search can discard half of the search space only when ordering is known.'
  },
  insertSnippet: `<QuizBlock
  question="Which invariant makes binary search valid?"
  options={["The input is sorted", "The input is random", "The array has no duplicates"]}
  answerIndex={0}
  explanation="Binary search can discard half of the search space only when ordering is known."
/>`
})
