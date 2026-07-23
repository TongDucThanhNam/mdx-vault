import { describe, expect, test } from 'bun:test'

import {
  applyPropertyMutation,
  parseFrontmatterProperties,
  renamePropertyKey
} from '../src/main/services/frontmatter-properties'
import { buildNoteIndex, hashContent } from '../src/main/services/index-service'
import {
  extractFootnotes,
  extractOutgoingLinks,
  findUnlinkedMentions,
  linkUnlinkedMention
} from '../src/shared/knowledge-source'

describe('GOAL-23 source-preserving property model', () => {
  const source = [
    '---',
    '# keep this comment',
    'title: "Quoted title" # keep inline',
    "status: 'draft'",
    'published: false',
    'score: 3.5',
    'empty:',
    'tags:',
    '  - research',
    '  - "[[Target Note]]"',
    'nested:',
    '  owner: Ada',
    '---',
    '# Body',
    '',
    'Body bytes stay untouched.',
    ''
  ].join('\r\n')

  test('indexes supported scalar/list values and marks nested structures read-only', () => {
    const parsed = parseFrontmatterProperties(source)

    expect(parsed.lineEnding).toBe('\r\n')
    expect(
      parsed.properties.map(({ name, type, editable, empty }) => [name, type, editable, empty])
    ).toEqual([
      ['title', 'text', true, false],
      ['status', 'text', true, false],
      ['published', 'checkbox', true, false],
      ['score', 'number', true, false],
      ['empty', 'text', true, true],
      ['tags', 'tags', true, false],
      ['nested', 'unsupported', false, false]
    ])
    expect(
      parsed.properties.find((property) => property.name === 'nested')?.unsupportedReason
    ).toMatch(/nested/i)
  })

  test('updates one value while preserving comments, quoting, order, line endings, and body', () => {
    const result = applyPropertyMutation(source, {
      kind: 'set',
      name: 'status',
      value: 'published',
      expectedSourceHash: hashContent(source)
    })

    expect(result.source).toBe(source.replace("status: 'draft'", "status: 'published'"))
    expect(result.source.slice(result.source.indexOf('---\r\n# Body'))).toBe(
      source.slice(source.indexOf('---\r\n# Body'))
    )
  })

  test('rejects a stale source hash and refuses unsupported property edits', () => {
    expect(() =>
      applyPropertyMutation(source, {
        kind: 'delete',
        name: 'status',
        expectedSourceHash: 'stale'
      })
    ).toThrow(/changed/i)

    expect(() =>
      applyPropertyMutation(source, {
        kind: 'set',
        name: 'nested',
        value: 'unsafe',
        expectedSourceHash: hashContent(source)
      })
    ).toThrow(/read-only|unsupported/i)
  })

  test('renames only the exact top-level key token and detects collisions', () => {
    const renamed = renamePropertyKey(source, 'status', 'workflow-status')

    expect(renamed.source).toBe(source.replace("status: 'draft'", "workflow-status: 'draft'"))
    expect(renamed.edits).toHaveLength(1)
    expect(() => renamePropertyKey(source, 'status', 'title')).toThrow(/already exists/i)
  })

  test('adds and deletes one property without serializing unrelated YAML', () => {
    const added = applyPropertyMutation(source, {
      kind: 'add',
      name: 'reviewed',
      value: true,
      expectedSourceHash: hashContent(source)
    })
    expect(added.source).toContain('reviewed: true\r\n---\r\n# Body')
    expect(added.source).toContain('title: "Quoted title" # keep inline')

    const deleted = applyPropertyMutation(added.source, {
      kind: 'delete',
      name: 'reviewed',
      expectedSourceHash: hashContent(added.source)
    })
    expect(deleted.source).toBe(source)
  })

  test('adds and updates block lists without changing valid YAML structure', () => {
    const withoutFrontmatter = '# Note\r\n'
    const added = applyPropertyMutation(withoutFrontmatter, {
      kind: 'add',
      name: 'aliases',
      value: ['One', 'Two'],
      expectedSourceHash: hashContent(withoutFrontmatter)
    })
    expect(added.source).toStartWith('---\r\naliases:\r\n  - One\r\n  - Two\r\n---\r\n')
    expect(parseFrontmatterProperties(added.source).properties[0]?.values).toEqual(['One', 'Two'])

    const updated = applyPropertyMutation(source, {
      kind: 'set',
      name: 'tags',
      value: ['architecture', 'notes'],
      expectedSourceHash: hashContent(source)
    })
    expect(updated.source).toContain('tags:\r\n  - architecture\r\n  - notes\r\nnested:')
    expect(parseFrontmatterProperties(updated.source).parseError).toBeNull()
  })

  test('classifies ISO dates and date-times without coercing surrounding source', () => {
    const dated = '---\ncreated: 2026-07-23\nupdated: 2026-07-23T14:30:00+07:00\n---\n'
    expect(
      parseFrontmatterProperties(dated).properties.map(({ name, type }) => [name, type])
    ).toEqual([
      ['created', 'date'],
      ['updated', 'date-time']
    ])
  })

  test('includes normalized properties in the rebuildable note index', () => {
    const indexed = buildNoteIndex({ relativePath: 'notes/Fixture.mdx', source, mtimeMs: 1 })

    expect(
      indexed.properties.find((property) => property.normalizedName === 'status')
    ).toMatchObject({
      name: 'status',
      type: 'text',
      values: ['draft'],
      empty: false
    })
  })
})

describe('GOAL-23 outgoing links and unlinked mentions', () => {
  const source = [
    '---',
    'owner: Target Note',
    '---',
    '# Links',
    'First [[Target Note#Nested heading|Target label]].',
    'Then [Relative target](../Other%20Note.mdx#Section).',
    'Plain Target Note and Shared Alias.',
    '',
    '`Target Note`',
    '',
    '```ts',
    'const hidden = "Target Note"',
    '```',
    '',
    '<Widget label="Target Note" />',
    ''
  ].join('\n')

  test('extracts wikilinks and vault-relative Markdown links in source order', () => {
    const links = extractOutgoingLinks('notes/sources/Outgoing.mdx', source)

    expect(
      links.map(({ kind, target, subpath, display }) => [kind, target, subpath, display])
    ).toEqual([
      ['wikilink', 'Target Note', '#Nested heading', 'Target label'],
      ['markdown', 'notes/Other Note.mdx', '#Section', 'Relative target']
    ])
    expect(links[0].range.from).toBeLessThan(links[1].range.from)
  })

  test('finds visible prose only, preserves ambiguity, and excludes protected syntax', () => {
    const mentions = findUnlinkedMentions({
      source,
      activeRelativePath: 'notes/sources/Outgoing.mdx',
      candidates: [
        {
          relativePath: 'notes/Target Note.mdx',
          title: 'Target Note',
          aliases: ['Shared Alias']
        },
        {
          relativePath: 'archive/Shared.mdx',
          title: 'Shared',
          aliases: ['Shared Alias']
        }
      ]
    })

    expect(mentions.map((mention) => mention.text)).toEqual(['Target Note', 'Shared Alias'])
    expect(mentions[1].candidates.map((candidate) => candidate.relativePath)).toEqual([
      'archive/Shared.mdx',
      'notes/Target Note.mdx'
    ])
  })

  test('links exactly one verified mention and rejects stale offsets', () => {
    const [mention] = findUnlinkedMentions({
      source,
      activeRelativePath: 'notes/sources/Outgoing.mdx',
      candidates: [{ relativePath: 'notes/Target Note.mdx', title: 'Target Note', aliases: [] }]
    })
    const linked = linkUnlinkedMention(
      source,
      mention,
      'notes/Target Note.mdx',
      hashContent(source)
    )

    expect(linked).toContain('Plain [[notes/Target Note.mdx|Target Note]] and Shared Alias.')
    expect(() =>
      linkUnlinkedMention(`${source}changed`, mention, 'notes/Target Note.mdx', hashContent(source))
    ).toThrow(/changed/i)
  })
})

describe('GOAL-23 footnote source model', () => {
  test('tracks repeated, missing, multiline, and unreferenced footnotes with exact ranges', () => {
    const source = [
      'Alpha[^one] beta[^one] missing[^missing].',
      '',
      '[^one]: First line.',
      '    Continued line.',
      '',
      '[^unused]: Never referenced.',
      ''
    ].join('\n')
    const footnotes = extractFootnotes(source)

    expect(
      footnotes.entries.map(({ identifier, referenceCount, status }) => [
        identifier,
        referenceCount,
        status
      ])
    ).toEqual([
      ['one', 2, 'defined'],
      ['unused', 0, 'unreferenced'],
      ['missing', 1, 'missing-definition']
    ])
    expect(footnotes.entries[0].preview).toContain('Continued line')
    expect(
      source.slice(
        footnotes.entries[0].definitionRange?.from,
        footnotes.entries[0].definitionRange?.to
      )
    ).toContain('[^one]:')
    expect(footnotes.entries[0].referenceRanges).toHaveLength(2)
  })
})
