import { describe, expect, test } from 'bun:test'
import type { IndexedNoteSummary, VaultTreeFile } from '../src/renderer/src/vault/types'
import {
  canOfferCreateMdxNote,
  getFileFinderModel,
  getFileFinderResults,
  isFileFinderAvailable,
  recordRecentFile,
  resetFileFinderSessionRecents,
  resolveFileFinderSelection
} from '../src/renderer/src/workbench/file-finder'

function file(relativePath: string): VaultTreeFile {
  const segments = relativePath.split('/')
  const name = segments.at(-1) ?? relativePath
  const dotIndex = name.lastIndexOf('.')

  return {
    relativePath,
    name,
    directory: segments.slice(0, -1).join('/'),
    extension: dotIndex > 0 ? name.slice(dotIndex).toLocaleLowerCase() : ''
  }
}

function note(relativePath: string, title: string, aliases: string[] = []): IndexedNoteSummary {
  return {
    id: relativePath,
    relativePath,
    title,
    aliases,
    mtimeMs: 1,
    contentHash: `hash:${relativePath}`
  }
}

const files = [
  file('notes/Hash Table.mdx'),
  file('datasets/people.csv'),
  file('config/app.json'),
  file('interactives/chart/component.tsx'),
  file('assets/diagram.png'),
  file('downloads/archive.bin')
]
const notes = [note('notes/Hash Table.mdx', 'Hash Tables', ['Dictionary', 'Hash Map'])]

describe('GOAL-22 vault-wide File Finder', () => {
  test('includes every visible VaultTreeFile kind rather than only indexed notes', () => {
    const results = getFileFinderResults({ files, notes, limit: 50 })
    const kinds = Object.fromEntries(results.map((result) => [result.relativePath, result.kind]))

    expect(results).toHaveLength(files.length)
    expect(kinds).toEqual({
      'assets/diagram.png': 'image',
      'config/app.json': 'text',
      'datasets/people.csv': 'text',
      'downloads/archive.bin': 'unsupported',
      'interactives/chart/component.tsx': 'text',
      'notes/Hash Table.mdx': 'note'
    })
  })

  test('enriches note rows and matches indexed titles and aliases', () => {
    const titleResult = getFileFinderResults({ files, notes, query: 'hash tables' })[0]
    const aliasResult = getFileFinderResults({ files, notes, query: 'dictionary' })[0]

    expect(titleResult).toMatchObject({
      relativePath: 'notes/Hash Table.mdx',
      title: 'Hash Tables',
      aliases: ['Dictionary', 'Hash Map'],
      matchKind: 'title'
    })
    expect(aliasResult).toMatchObject({
      relativePath: 'notes/Hash Table.mdx',
      matchKind: 'alias',
      matchedAlias: 'Dictionary'
    })
  })

  test('ranks strong title and basename matches before path-only matches', () => {
    const rankingFiles = [
      file('archive/intro/reference.json'),
      file('datasets/intro.csv'),
      file('notes/start.mdx')
    ]
    const rankingNotes = [note('notes/start.mdx', 'Intro')]
    const results = getFileFinderResults({
      files: rankingFiles,
      notes: rankingNotes,
      query: 'intro'
    })

    expect(results.map((result) => result.relativePath)).toEqual([
      'notes/start.mdx',
      'datasets/intro.csv',
      'archive/intro/reference.json'
    ])
    expect(results.map((result) => result.matchKind)).toEqual(['title', 'basename', 'path'])
  })

  test('matches extension, vault-relative path, and duplicate basenames deterministically', () => {
    const duplicateFiles = [
      file('zeta/readme.json'),
      file('alpha/readme.json'),
      file('interactives/widgets/component.tsx')
    ]

    expect(
      getFileFinderResults({ files: duplicateFiles, query: 'tsx' }).map(
        (result) => result.relativePath
      )
    ).toEqual(['interactives/widgets/component.tsx'])
    expect(
      getFileFinderResults({ files: duplicateFiles, query: 'widgets/component' })[0]
    ).toMatchObject({
      relativePath: 'interactives/widgets/component.tsx',
      matchKind: 'path'
    })
    expect(
      getFileFinderResults({ files: duplicateFiles, query: 'readme' }).map(
        (result) => result.relativePath
      )
    ).toEqual(['alpha/readme.json', 'zeta/readme.json'])
    expect(getFileFinderResults({ files, query: 'people.csv' })[0]?.matchKind).toBe('basename')
  })

  test('empty query promotes open files, then recents, then a stable fallback order', () => {
    const unordered = [file('zeta/Zed.txt'), file('beta/Beta.txt'), file('alpha/Alpha.txt')]
    const results = getFileFinderResults({
      files: unordered,
      openIds: ['zeta/Zed.txt'],
      recentIds: ['alpha/Alpha.txt']
    })

    expect(results.map((result) => result.relativePath)).toEqual([
      'zeta/Zed.txt',
      'alpha/Alpha.txt',
      'beta/Beta.txt'
    ])
    expect(results[0]).toMatchObject({ isOpen: true, isRecent: false })
    expect(results[1]).toMatchObject({ isOpen: false, isRecent: true })
  })

  test('ranking is stable when the source inventory arrives in a different order', () => {
    const first = getFileFinderResults({ files, notes, query: 'a', limit: 50 }).map(
      (result) => result.relativePath
    )
    const second = getFileFinderResults({
      files: [...files].reverse(),
      notes,
      query: 'a',
      limit: 50
    }).map((result) => result.relativePath)

    expect(second).toEqual(first)
  })

  test('no-vault and stale selections are explicit and cannot create phantom state', () => {
    expect(isFileFinderAvailable(null)).toBe(false)
    expect(isFileFinderAvailable([])).toBe(true)
    expect(getFileFinderModel({ files: null })).toEqual({ status: 'no_vault', results: [] })
    expect(getFileFinderModel({ files: [] })).toEqual({ status: 'ready', results: [] })
    expect(resolveFileFinderSelection('notes/Hash Table.mdx', null)).toEqual({
      status: 'no_vault'
    })
    expect(resolveFileFinderSelection('notes/deleted.mdx', files)).toEqual({ status: 'stale' })
    expect(resolveFileFinderSelection('C:\\outside\\secret.mdx', files)).toEqual({
      status: 'stale'
    })
    expect(resolveFileFinderSelection('notes/Hash Table.mdx', files)).toEqual({
      status: 'ready',
      file: files[0]
    })
  })

  test('session recency deduplicates, remains relative, is bounded, and resets on vault switch', () => {
    let recentIds: string[] = []
    recentIds = recordRecentFile(recentIds, 'notes/a.mdx', 2)
    recentIds = recordRecentFile(recentIds, 'notes/b.mdx', 2)
    recentIds = recordRecentFile(recentIds, 'notes\\a.mdx', 2)
    recentIds = recordRecentFile(recentIds, 'notes/c.mdx', 2)

    expect(recentIds).toEqual(['notes/c.mdx', 'notes/a.mdx'])
    expect(resetFileFinderSessionRecents()).toEqual([])
  })

  test('the explicit MDX create row rejects file-like, unsafe, and exact-note queries', () => {
    expect(canOfferCreateMdxNote('Fresh concept', notes)).toBe(true)
    expect(canOfferCreateMdxNote('Fresh concept.mdx', notes)).toBe(true)
    expect(canOfferCreateMdxNote('data.csv', notes)).toBe(false)
    expect(canOfferCreateMdxNote('../outside', notes)).toBe(false)
    expect(canOfferCreateMdxNote('Hash Tables', notes)).toBe(false)
    expect(canOfferCreateMdxNote('Dictionary', notes)).toBe(false)
  })
})
