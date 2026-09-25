import { describe, expect, test } from 'bun:test'

import { DbService } from '../src/main/services/db-service'

describe('GOAL-29 section-aware search', () => {
  test('returns the best matching section with an exact heading target', () => {
    const database = createSectionSearchDatabase()

    expect(database.search('cache invalidation', 20)).toEqual([
      {
        note: {
          id: 'systems',
          relativePath: 'notes/Systems.mdx',
          title: 'Systems',
          aliases: [],
          mtimeMs: 1,
          contentHash: 'proof'
        },
        snippet: 'Cache invalidation details live here.',
        rank: -1,
        matches: [],
        heading: {
          id: 'cache-invalidation',
          depth: 2,
          text: 'Cache invalidation',
          slug: 'cache-invalidation',
          position: 3,
          sourceFrom: 120,
          sourceTo: 141
        }
      }
    ])
  })
})

function createSectionSearchDatabase(): DbService {
  const noteRow = {
    id: 'systems',
    relative_path: 'notes/Systems.mdx',
    title: 'Systems',
    mtime_ms: 1,
    content_hash: 'proof',
    snippet: 'Note-level fallback.',
    rank: -1,
    body: 'Cache invalidation details live here.'
  }
  const fakeDatabase = {
    prepare: (sql: string) => ({
      all: () => {
        if (sql.includes('FROM note_sections_fts')) {
          return [
            {
              note_id: 'systems',
              heading_id: 'cache-invalidation',
              heading_depth: 2,
              heading_text: 'Cache invalidation',
              heading_slug: 'cache-invalidation',
              heading_position: 3,
              heading_source_from: 120,
              heading_source_to: 141,
              snippet: 'Cache invalidation details live here.',
              rank: -2
            }
          ]
        }
        if (sql.includes('FROM note_aliases')) return []
        return [noteRow]
      }
    })
  }

  return Reflect.construct(DbService, ['test-vault', fakeDatabase]) as DbService
}
