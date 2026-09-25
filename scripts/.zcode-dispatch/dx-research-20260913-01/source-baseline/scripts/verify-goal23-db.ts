import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import DatabaseConstructor from 'better-sqlite3'

import { DbService } from '../src/main/services/db-service'
import { buildNoteIndex } from '../src/main/services/index-service'

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal23-db-'))

  try {
  await mkdir(join(root, '.app'), { recursive: true })
  const legacy = new DatabaseConstructor(join(root, '.app', 'index.sqlite'))
  legacy.exec(`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      vault_path TEXT NOT NULL,
      relative_path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      mtime_ms INTEGER NOT NULL,
      content_hash TEXT NOT NULL
    );
    CREATE TABLE note_aliases (
      note_id TEXT NOT NULL,
      alias TEXT NOT NULL,
      alias_normalized TEXT NOT NULL,
      PRIMARY KEY (note_id, alias_normalized)
    );
    CREATE TABLE note_headings (
      note_id TEXT NOT NULL,
      depth INTEGER NOT NULL,
      text TEXT NOT NULL,
      slug TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (note_id, position)
    );
    CREATE TABLE note_links (
      source_note_id TEXT NOT NULL,
      target TEXT NOT NULL,
      target_normalized TEXT NOT NULL,
      display TEXT,
      position INTEGER NOT NULL,
      PRIMARY KEY (source_note_id, position)
    );
    CREATE TABLE note_tags (
      note_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (note_id, tag)
    );
    CREATE TABLE note_components (
      note_id TEXT NOT NULL,
      component_name TEXT NOT NULL,
      PRIMARY KEY (note_id, component_name)
    );
    CREATE VIRTUAL TABLE notes_fts USING fts5(note_id UNINDEXED, title, body);
    PRAGMA user_version = 2;
  `)
  legacy.close()

  const db = DbService.open(root)

  try {
    db.upsertNote(
      buildNoteIndex({
        relativePath: 'notes/Alpha.mdx',
        source: [
          '---',
          'status: Draft',
          'rating: 5',
          'empty:',
          'tags: [research, alpha]',
          '---',
          '# Alpha',
          'needle'
        ].join('\n'),
        mtimeMs: 1
      })
    )
    db.upsertNote(
      buildNoteIndex({
        relativePath: 'notes/Beta.mdx',
        source: ['---', 'status:', 'rating: high', '---', '# Beta', 'needle'].join('\n'),
        mtimeMs: 2
      })
    )

    assert.deepEqual(
      db.search('[status]', 20).map((result) => result.note.title),
      ['Alpha', 'Beta']
    )
    assert.equal(db.search('needle [status:Draft] tag:research', 20).length, 1)
    assert.deepEqual(
      db.search('[empty:null]', 20).map((result) => result.note.title),
      ['Alpha']
    )
    assert.ok(
      db.listProperties().some(
        (property) =>
          property.name === 'rating' && property.type === 'mixed' && property.useCount === 2
      )
    )
    assert.deepEqual(
      db
        .getPropertiesForNote('notes/Alpha.mdx')
        .find((property) => property.name === 'tags')?.values,
      ['research', 'alpha']
    )
  } finally {
    db.close()
  }

    process.stdout.write('GOAL-23 SQLite v2→v3 migration and property queries passed.\n')
  } finally {
    await rm(root, { force: true, recursive: true })
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
