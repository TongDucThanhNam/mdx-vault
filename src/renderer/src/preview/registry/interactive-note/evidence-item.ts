import { z } from 'zod'

import { EvidenceItem, type EvidenceItemProps } from '../../islands/interactive-note/EvidenceItem'
import { defineRegistryEntry } from '../types'
import { optionalReactNodeSchema } from './react-node-schema'

const evidenceItemPropsSchema: z.ZodType<EvidenceItemProps> = z
  .object({
    cmd: z.string().min(1),
    children: optionalReactNodeSchema
  })
  .strict()

export const evidenceItemRegistryEntry = defineRegistryEntry({
  name: 'EvidenceItem',
  component: EvidenceItem,
  propsSchema: evidenceItemPropsSchema,
  description: 'Command and optional real result; missing evidence is visibly marked CHƯA CÓ.',
  category: 'interactive-note',
  insertSnippet: `<EvidenceLog>
  <EvidenceItem cmd="perf stat -e cache-misses ./benchmark" />
</EvidenceLog>`
})
