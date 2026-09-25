import { describe, expect, test } from 'bun:test'
import { analyzeMdxStructure } from '../src/shared/markdown-source'

describe('safe MDX structure analysis', () => {
  test('creates deterministic unique heading identities and source ranges', () => {
    const source = [
      'Intro before headings.',
      '',
      '## Usage',
      'First section.',
      '',
      '## Usage',
      'Second section with `code`.',
      '',
      '#### Deep dive',
      'Nested details.',
      ''
    ].join('\n')

    const structure = analyzeMdxStructure(source)

    expect(
      structure.headings.map(({ id, slug, depth, text, position }) => ({
        id,
        slug,
        depth,
        text,
        position
      }))
    ).toEqual([
      { id: 'usage', slug: 'usage', depth: 2, text: 'Usage', position: 0 },
      { id: 'usage-2', slug: 'usage', depth: 2, text: 'Usage', position: 1 },
      { id: 'deep-dive', slug: 'deep-dive', depth: 4, text: 'Deep dive', position: 2 }
    ])
    expect(structure.headings[0].sourceFrom).toBe(source.indexOf('## Usage'))
    expect(structure.headings[0].sourceTo).toBeGreaterThan(structure.headings[0].sourceFrom)
  })

  test('associates searchable prose with its nearest preceding heading', () => {
    const source = [
      'Preamble.',
      '',
      '# Alpha',
      'Alpha prose.',
      '',
      '## Beta with `inline`',
      'Beta prose.',
      '',
      '```ts',
      'const proof = true',
      '```'
    ].join('\n')

    const sections = analyzeMdxStructure(source).sections

    expect(sections.map((section) => section.heading?.id ?? null)).toEqual([
      null,
      'alpha',
      'beta-with-inline'
    ])
    expect(sections[0].body).toBe('Preamble.')
    expect(sections[1].body).toBe('Alpha prose.')
    expect(sections[2].body).toContain('Beta prose.')
    expect(sections[2].body).toContain('const proof = true')
    expect(sections[2].body).not.toContain('Beta with')
  })
})
