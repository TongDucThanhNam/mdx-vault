import { z } from 'zod'

import { FlowSequence, type FlowSequenceProps } from '../../islands/interactive-note/FlowSequence'
import { defineRegistryEntry } from '../types'

const flowSequenceNodeSchema = z
  .object({
    label: z.string().min(1),
    sublabel: z.string().min(1).optional(),
    accent: z.boolean().optional()
  })
  .strict()

const flowSequencePropsSchema: z.ZodType<FlowSequenceProps> = z
  .object({
    nodes: z.array(flowSequenceNodeSchema).min(1),
    edgeLabels: z.array(z.string().min(1)).optional(),
    caption: z.string().min(1).optional(),
    direction: z.enum(['row', 'column']).optional()
  })
  .strict()
  .superRefine((props, context) => {
    if (props.edgeLabels && props.edgeLabels.length > Math.max(0, props.nodes.length - 1)) {
      context.addIssue({
        code: 'custom',
        message: 'edgeLabels cannot outnumber the edges between nodes',
        path: ['edgeLabels']
      })
    }
  })

export const flowSequenceRegistryEntry = defineRegistryEntry({
  name: 'FlowSequence',
  component: FlowSequence,
  propsSchema: flowSequencePropsSchema,
  description: 'Static node-and-arrow sequence for paths, handshakes, and pipelines.',
  category: 'interactive-note',
  defaultProps: { direction: 'row' },
  insertSnippet: `<FlowSequence
  nodes={[
    { label: "Stub resolver", sublabel: "local" },
    { label: "Recursive resolver", accent: true },
    { label: "Authoritative", sublabel: "answer" }
  ]}
  edgeLabels={["query", "~30ms"]}
  caption="DNS resolution path"
/>`
})
