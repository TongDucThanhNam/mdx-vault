import { describe, expect, test } from 'bun:test'

import {
  formatWikilinkTarget,
  parseWikilinkTarget,
  resolveMarkdownNoteTarget,
  resolveWikilinkHeading,
  resolveWikilinkTarget
} from '../src/shared/wikilinks'

const NOTES = [
  {
    relativePath: 'notes/Welcome.mdx',
    title: 'Welcome',
    aliases: ['Home']
  },
  {
    relativePath: 'notes/Systems.mdx',
    title: 'Systems',
    aliases: []
  }
]

describe('wikilink references', () => {
  test('separates note, nested heading, and block subpaths without losing syntax', () => {
    const heading = parseWikilinkTarget('Systems#Memory#Cache Coherency')
    const block = parseWikilinkTarget('Systems#^cache-note')

    expect(heading).toEqual({
      noteTarget: 'Systems',
      subpath: {
        kind: 'heading',
        segments: ['Memory', 'Cache Coherency']
      }
    })
    expect(block).toEqual({
      noteTarget: 'Systems',
      subpath: {
        kind: 'block',
        identifier: 'cache-note'
      }
    })
    expect(heading && formatWikilinkTarget(heading)).toBe('Systems#Memory#Cache Coherency')
  })

  test('resolves the note independently from its subpath and supports same-note headings', () => {
    expect(resolveWikilinkTarget(NOTES, 'Systems#Memory')?.relativePath).toBe('notes/Systems.mdx')
    expect(resolveWikilinkTarget(NOTES, '#Overview', 'notes/Welcome.mdx')?.relativePath).toBe(
      'notes/Welcome.mdx'
    )
  })

  test('uses nested heading ancestry to disambiguate duplicate section names', () => {
    const headings = [
      { depth: 2, text: 'Storage', position: 0 },
      { depth: 3, text: 'Caching', position: 1 },
      { depth: 2, text: 'Memory', position: 2 },
      { depth: 3, text: 'Caching', position: 3 }
    ]
    const reference = parseWikilinkTarget('Systems#Memory#Caching')

    expect(resolveWikilinkHeading(headings, reference?.subpath ?? null)?.position).toBe(3)
  })

  test('resolves vault-relative Markdown note links and decoded heading fragments', () => {
    const resolved = resolveMarkdownNoteTarget(
      NOTES,
      '../notes/Systems.mdx#Memory%20Model',
      'drafts/Current.mdx'
    )
    expect(resolved).toEqual({
      note: NOTES[1],
      reference: {
        relativePath: 'notes/Systems.mdx',
        subpath: { kind: 'heading', segments: ['Memory Model'] }
      }
    })
    expect(resolveMarkdownNoteTarget(NOTES, 'https://example.com', 'notes/Welcome.mdx')).toBeNull()
  })
})
