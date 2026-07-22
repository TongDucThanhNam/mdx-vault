import { z } from 'zod'

import { AlgorithmVisualizer } from '../islands/AlgorithmVisualizer'
import { defineRegistryEntry } from './types'

const algorithmVisualizerPropsSchema = z
  .object({
    algorithm: z.enum(['binary-search', 'bubble-sort']),
    data: z.array(z.number()).min(1).max(40),
    target: z.number().optional(),
    speed: z.number().int().min(100).max(5000).optional()
  })
  .strict()
  .superRefine((props, context) => {
    if (props.algorithm === 'binary-search' && props.target === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'target is required for binary search'
      })
    }
  })

export const algorithmVisualizerRegistryEntry = defineRegistryEntry({
  name: 'AlgorithmVisualizer',
  component: AlgorithmVisualizer,
  propsSchema: algorithmVisualizerPropsSchema,
  description: 'Step-by-step algorithm animation with play, pause, and manual stepping.',
  category: 'content',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/algorithm-visualizer.ts',
    entryExport: 'algorithmVisualizerRegistryEntry',
    static: 'algorithm-summary',
    interactive: 'hydrate'
  },
  defaultProps: {
    algorithm: 'binary-search',
    data: [1, 3, 4, 8, 12, 15, 20],
    target: 12,
    speed: 700
  },
  insertSnippet: `<AlgorithmVisualizer
  algorithm="binary-search"
  data={[1, 3, 4, 8, 12, 15, 20]}
  target={12}
  speed={700}
/>`
})
