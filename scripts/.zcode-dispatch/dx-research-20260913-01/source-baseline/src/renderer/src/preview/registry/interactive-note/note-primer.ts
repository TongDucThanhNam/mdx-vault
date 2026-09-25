import { z } from 'zod'

import { NotePrimer, type NotePrimerProps } from '../../islands/interactive-note/NotePrimer'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const notePrimerPropsSchema: z.ZodType<NotePrimerProps> = z
  .object({
    children: requiredReactNodeSchema
  })
  .strict()

export const notePrimerRegistryEntry = defineRegistryEntry({
  name: 'NotePrimer',
  component: NotePrimer,
  propsSchema: notePrimerPropsSchema,
  description: 'Dashed primer strip for terms the note defines before its first section.',
  category: 'interactive-note',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/interactive-note/note-primer.ts',
    entryExport: 'notePrimerRegistryEntry',
    static: 'render',
    interactive: 'hydrate'
  },
  insertSnippet: `<NotePrimer>
  <PrimerTerm term="cache line" href="#mechanism">The transfer unit between RAM and cache.</PrimerTerm>
</NotePrimer>`
})
