import { z } from 'zod'

import { EvidenceLog, type EvidenceLogProps } from '../../islands/interactive-note/EvidenceLog'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const evidenceLogPropsSchema: z.ZodType<EvidenceLogProps> = z
  .object({
    children: requiredReactNodeSchema
  })
  .strict()

export const evidenceLogRegistryEntry = defineRegistryEntry({
  name: 'EvidenceLog',
  component: EvidenceLog,
  propsSchema: evidenceLogPropsSchema,
  description: 'Container for real commands and observed results, never simulated evidence.',
  category: 'interactive-note',
  insertSnippet: `<EvidenceLog>
  <EvidenceItem cmd="perf stat -e cache-misses ./benchmark" />
</EvidenceLog>`
})
