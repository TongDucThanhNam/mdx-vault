import { describe, expect, test } from 'bun:test'

import { buildNoteIndex } from '../src/main/services/index-service'

describe('GOAL-23 outgoing link indexing', () => {
  test('preserves each wikilink or Markdown subpath exactly once', () => {
    const source = [
      '[[Target#Memory#Caching|nested target]]',
      '[storage](./Target.mdx#Storage)'
    ].join('\n')

    const index = buildNoteIndex({
      relativePath: 'notes/Source.mdx',
      source,
      mtimeMs: 1
    })

    expect(
      index.wikilinks.map(({ kind, target, noteTarget, subpath }) => ({
        kind,
        target,
        noteTarget,
        subpath
      }))
    ).toEqual([
      {
        kind: 'wikilink',
        target: 'Target#Memory#Caching',
        noteTarget: 'Target',
        subpath: '#Memory#Caching'
      },
      {
        kind: 'markdown',
        target: 'notes/Target.mdx#Storage',
        noteTarget: 'notes/Target.mdx',
        subpath: '#Storage'
      }
    ])
  })
})
