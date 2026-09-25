import { describe, expect, test } from 'bun:test'

import { DbService } from '../src/main/services/db-service'

interface FakeSearchRow {
  id: string
  relative_path: string
  title: string
  mtime_ms: number
  content_hash: string
  snippet: string
  rank: number
  body: string
}

const alpha: FakeSearchRow = {
  id: 'alpha',
  relative_path: 'projects/Alpha.mdx',
  title: 'Alpha Plan',
  mtime_ms: 1,
  content_hash: 'alpha',
  snippet: '',
  rank: 0,
  body: 'Needle architecture for the first milestone.'
}
const beta: FakeSearchRow = {
  id: 'beta',
  relative_path: 'notes/Beta.mdx',
  title: 'Beta Reference',
  mtime_ms: 2,
  content_hash: 'beta',
  snippet: '',
  rank: 0,
  body: 'A separate body with no matching term.'
}

describe('GOAL-24 graph search membership', () => {
  test('uses the same free-text, tag, path, file, regex, and property matcher as Search', () => {
    const queries = [
      'Needle architecture',
      'tag:project',
      'path:projects',
      'file:Alpha.mdx',
      '/needle\\s+architecture/i',
      '[status:active]',
      'tag:graph [status:active] path:projects'
    ]

    for (const query of queries) {
      const database = createSearchDatabase()
      const searchPaths = database.search(query, 100).map((result) => result.note.relativePath)
      expect(database.matchGraphNotePaths(query)).toEqual(searchPaths)
      expect(searchPaths).toEqual(['projects/Alpha.mdx'])
    }
  })

  test('keeps empty-query and invalid-query behavior aligned with Search', () => {
    const database = createSearchDatabase()

    expect(database.matchGraphNotePaths('')).toEqual([])
    expect(database.matchGraphNotePaths('   ')).toEqual([])
    expect(() => database.matchGraphNotePaths('/unterminated')).toThrow()
    expect(() => database.matchGraphNotePaths('x'.repeat(301))).toThrow(/too long/i)
  })
})

function createSearchDatabase(): DbService {
  const fakeDatabase = {
    prepare: (sql: string) => ({
      all: (...parameters: Array<number | string>) => {
        if (sql.includes('FROM note_aliases')) {
          return []
        }

        if (
          sql.includes('notes_fts MATCH') ||
          parameters.some((value) =>
            typeof value === 'string'
              ? value.includes('project') ||
                value.includes('graph') ||
                value.includes('active') ||
                value.includes('projects') ||
                value.includes('alpha.mdx')
              : false
          )
        ) {
          return [alpha]
        }

        return [alpha, beta]
      }
    })
  }

  return Reflect.construct(DbService, ['test-vault', fakeDatabase]) as DbService
}
