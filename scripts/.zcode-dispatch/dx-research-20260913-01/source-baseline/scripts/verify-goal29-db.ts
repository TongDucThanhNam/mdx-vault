import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'

import { DbService } from '../src/main/services/db-service'
import { buildNoteIndex } from '../src/main/services/index-service'

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal29-db-'))
  let database: DbService | null = null

  try {
    database = DbService.open(root)
    database.upsertNote(
      buildNoteIndex({
        relativePath: 'Systems.mdx',
        source: [
          '# Systems',
          'General systems context.',
          '',
          '## Cache invalidation',
          'The bounded eviction window is the exact proof term.',
          '',
          '#### Operations',
          'Runtime notes.'
        ].join('\n'),
        mtimeMs: 1
      })
    )

    const headings = database.getHeadings('Systems.mdx')
    const results = database.search('bounded eviction', 20)

    assert.deepEqual(
      headings.map((heading) => heading.id),
      ['systems', 'cache-invalidation', 'operations']
    )
    assert.equal(results.length, 1)
    assert.equal(results[0]?.heading?.id, 'cache-invalidation')
    assert.match(results[0]?.snippet ?? '', /bounded eviction/i)
    process.stdout.write(
      `${JSON.stringify({ schema: 4, headings: headings.length, section: results[0]?.heading?.id })}\n`
    )
  } finally {
    database?.close()
    const resolvedRoot = resolve(root)
    const resolvedTemp = resolve(tmpdir())
    if (
      resolvedRoot.startsWith(`${resolvedTemp}${sep}`) &&
      resolvedRoot.includes('mdx-vault-goal29-db-')
    ) {
      await rm(resolvedRoot, { recursive: true, force: true })
    }
  }
}

void main().then(
  () => process.exit(0),
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exit(1)
  }
)
