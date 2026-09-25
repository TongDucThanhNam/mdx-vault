import { z } from 'zod'

import { PrimerTerm, type PrimerTermProps } from '../../islands/interactive-note/PrimerTerm'
import { defineRegistryEntry } from '../types'
import { requiredReactNodeSchema } from './react-node-schema'

const primerHrefSchema = z
  .string()
  .min(1)
  .refine(
    (href) =>
      href.startsWith('#') || (!href.startsWith('//') && !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(href)),
    { message: 'href must be an anchor or a relative note path' }
  )

const primerTermPropsSchema: z.ZodType<PrimerTermProps> = z
  .object({
    term: z.string().min(1),
    href: primerHrefSchema.optional(),
    children: requiredReactNodeSchema
  })
  .strict()

export const primerTermRegistryEntry = defineRegistryEntry({
  name: 'PrimerTerm',
  component: PrimerTerm,
  propsSchema: primerTermPropsSchema,
  description: 'One primer term with a concise definition and optional internal link.',
  category: 'interactive-note',
  exportPolicy: {
    modulePath: 'src/renderer/src/preview/registry/interactive-note/primer-term.ts',
    entryExport: 'primerTermRegistryEntry',
    static: 'render',
    interactive: 'hydrate'
  },
  insertSnippet: `<NotePrimer>
  <PrimerTerm term="cache line" href="#mechanism">The transfer unit between RAM and cache.</PrimerTerm>
</NotePrimer>`
})
