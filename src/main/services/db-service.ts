import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { join } from 'path'
import DatabaseConstructor, { type Database as BetterSqliteDatabase } from 'better-sqlite3'

import { getNoteLinkKeys, normalizeLinkKey } from '../../shared/wikilinks'
import type { NoteIndex } from './index-service'

export interface NoteFileState {
  mtimeMs: number
  contentHash: string
}

export interface IndexedNoteSummary {
  id: string
  relativePath: string
  title: string
  aliases: string[]
  mtimeMs: number
  contentHash: string
}

export interface SearchResult {
  note: IndexedNoteSummary
  snippet: string
  rank: number
}

export interface BacklinkResult {
  source: IndexedNoteSummary
  target: string
  display: string
}

export interface NoteHeadingResult {
  depth: number
  text: string
  slug: string
  position: number
}

export interface TagSummary {
  tag: string
  count: number
}

interface NoteRow {
  id: string
  relative_path: string
  title: string
  mtime_ms: number
  content_hash: string
}

interface AliasRow {
  note_id: string
  alias: string
}

interface SearchRow extends NoteRow {
  snippet: string
  rank: number
}

interface BacklinkRow extends NoteRow {
  target: string
  display: string | null
}

interface HeadingRow {
  depth: number
  text: string
  slug: string
  position: number
}

interface TagSummaryRow {
  tag: string
  count: number
}

const SCHEMA_VERSION = 1

export class DbService {
  private readonly db: BetterSqliteDatabase
  private readonly vaultPath: string

  private constructor(vaultPath: string, db: BetterSqliteDatabase) {
    this.vaultPath = vaultPath
    this.db = db
  }

  static open(vaultPath: string): DbService {
    const appDirectory = join(vaultPath, '.app')
    mkdirSync(appDirectory, { recursive: true })

    const db = new DatabaseConstructor(join(appDirectory, 'index.sqlite'))
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    const service = new DbService(vaultPath, db)
    service.migrate()
    return service
  }

  close(): void {
    this.db.close()
  }

  getNoteFileState(relativePath: string): NoteFileState | null {
    const row = this.db
      .prepare('SELECT mtime_ms, content_hash FROM notes WHERE relative_path = ?')
      .get(relativePath) as { mtime_ms: number; content_hash: string } | undefined

    if (!row) {
      return null
    }

    return {
      mtimeMs: row.mtime_ms,
      contentHash: row.content_hash
    }
  }

  updateNoteMtime(relativePath: string, mtimeMs: number): void {
    this.db
      .prepare('UPDATE notes SET mtime_ms = ? WHERE relative_path = ?')
      .run(Math.round(mtimeMs), relativePath)
  }

  upsertNote(note: NoteIndex): void {
    const writeNote = this.db.transaction((nextNote: NoteIndex) => {
      const noteId = createNoteId(nextNote.relativePath)

      this.db
        .prepare(
          `INSERT INTO notes (id, vault_path, relative_path, title, mtime_ms, content_hash)
           VALUES (@id, @vaultPath, @relativePath, @title, @mtimeMs, @contentHash)
           ON CONFLICT(id) DO UPDATE SET
             vault_path = excluded.vault_path,
             relative_path = excluded.relative_path,
             title = excluded.title,
             mtime_ms = excluded.mtime_ms,
             content_hash = excluded.content_hash`
        )
        .run({
          id: noteId,
          vaultPath: this.vaultPath,
          relativePath: nextNote.relativePath,
          title: nextNote.title,
          mtimeMs: Math.round(nextNote.mtimeMs),
          contentHash: nextNote.contentHash
        })

      this.replaceChildRows(noteId, nextNote)
      this.replaceFtsRow(noteId, nextNote)
    })

    writeNote(note)
  }

  deleteNote(relativePath: string): void {
    const noteId = createNoteId(relativePath)

    this.db.transaction(() => {
      this.db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(noteId)
      this.db.prepare('DELETE FROM note_aliases WHERE note_id = ?').run(noteId)
      this.db.prepare('DELETE FROM note_headings WHERE note_id = ?').run(noteId)
      this.db.prepare('DELETE FROM note_links WHERE source_note_id = ?').run(noteId)
      this.db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)
      this.db.prepare('DELETE FROM note_components WHERE note_id = ?').run(noteId)
      this.db.prepare('DELETE FROM notes WHERE id = ?').run(noteId)
    })()
  }

  listNotePaths(): string[] {
    const rows = this.db.prepare('SELECT relative_path FROM notes').all() as {
      relative_path: string
    }[]

    return rows.map((row) => row.relative_path)
  }

  listNotes(): IndexedNoteSummary[] {
    const rows = this.db
      .prepare(
        `SELECT id, relative_path, title, mtime_ms, content_hash
         FROM notes
         ORDER BY title COLLATE NOCASE, relative_path COLLATE NOCASE`
      )
      .all() as NoteRow[]

    return this.attachAliases(rows)
  }

  search(query: string, limit: number): SearchResult[] {
    const ftsQuery = toFtsQuery(query)

    if (!ftsQuery) {
      return []
    }

    const rows = this.db
      .prepare(
        `SELECT
           n.id,
           n.relative_path,
           n.title,
           n.mtime_ms,
           n.content_hash,
           snippet(notes_fts, 2, '', '', '...', 12) AS snippet,
           bm25(notes_fts) AS rank
         FROM notes_fts
         JOIN notes n ON n.id = notes_fts.note_id
         WHERE notes_fts MATCH ?
         ORDER BY rank, n.title COLLATE NOCASE
         LIMIT ?`
      )
      .all(ftsQuery, limit) as SearchRow[]

    const notes = this.attachAliases(rows)

    return rows.map((row, index) => ({
      note: notes[index],
      snippet: row.snippet,
      rank: row.rank
    }))
  }

  getBacklinks(relativePath: string): BacklinkResult[] {
    const note = this.getNoteByRelativePath(relativePath)

    if (!note) {
      return []
    }

    const targetKeys = getNoteLinkKeys(note)

    if (targetKeys.length === 0) {
      return []
    }

    const placeholders = targetKeys.map(() => '?').join(', ')
    const rows = this.db
      .prepare(
        `SELECT
           n.id,
           n.relative_path,
           n.title,
           n.mtime_ms,
           n.content_hash,
           l.target,
           l.display
         FROM note_links l
         JOIN notes n ON n.id = l.source_note_id
         WHERE l.target_normalized IN (${placeholders})
         ORDER BY n.title COLLATE NOCASE, n.relative_path COLLATE NOCASE`
      )
      .all(...targetKeys) as BacklinkRow[]

    const sources = this.attachAliases(rows)

    return rows.map((row, index) => ({
      source: sources[index],
      target: row.target,
      display: row.display ?? row.target
    }))
  }

  getHeadings(relativePath: string): NoteHeadingResult[] {
    const note = this.getNoteByRelativePath(relativePath)

    if (!note) {
      return []
    }

    const rows = this.db
      .prepare(
        `SELECT depth, text, slug, position
         FROM note_headings
         WHERE note_id = ?
         ORDER BY position ASC`
      )
      .all(note.id) as HeadingRow[]

    return rows.map((row) => ({
      depth: row.depth,
      text: row.text,
      slug: row.slug,
      position: row.position
    }))
  }

  listTags(): TagSummary[] {
    const rows = this.db
      .prepare(
        `SELECT tag, COUNT(*) AS count
         FROM note_tags
         GROUP BY tag
         ORDER BY tag COLLATE NOCASE`
      )
      .all() as TagSummaryRow[]

    return rows.map((row) => ({
      tag: row.tag,
      count: row.count
    }))
  }

  getNotesByTag(tag: string): IndexedNoteSummary[] {
    const rows = this.db
      .prepare(
        `SELECT n.id, n.relative_path, n.title, n.mtime_ms, n.content_hash
         FROM note_tags t
         JOIN notes n ON n.id = t.note_id
         WHERE t.tag = ?
         ORDER BY n.title COLLATE NOCASE, n.relative_path COLLATE NOCASE`
      )
      .all(tag) as NoteRow[]

    return this.attachAliases(rows)
  }

  clearAll(): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM notes_fts').run()
      this.db.prepare('DELETE FROM note_aliases').run()
      this.db.prepare('DELETE FROM note_headings').run()
      this.db.prepare('DELETE FROM note_links').run()
      this.db.prepare('DELETE FROM note_tags').run()
      this.db.prepare('DELETE FROM note_components').run()
      this.db.prepare('DELETE FROM notes').run()
    })()
  }

  private migrate(): void {
    const version = this.db.pragma('user_version', { simple: true }) as number

    if (version === SCHEMA_VERSION) {
      return
    }

    if (version !== 0) {
      throw new Error(`Unsupported index schema version: ${version}`)
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        vault_path TEXT NOT NULL,
        relative_path TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        mtime_ms INTEGER NOT NULL,
        content_hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS note_aliases (
        note_id TEXT NOT NULL,
        alias TEXT NOT NULL,
        alias_normalized TEXT NOT NULL,
        PRIMARY KEY (note_id, alias_normalized)
      );

      CREATE TABLE IF NOT EXISTS note_headings (
        note_id TEXT NOT NULL,
        depth INTEGER NOT NULL,
        text TEXT NOT NULL,
        slug TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (note_id, position)
      );

      CREATE TABLE IF NOT EXISTS note_links (
        source_note_id TEXT NOT NULL,
        target TEXT NOT NULL,
        target_normalized TEXT NOT NULL,
        display TEXT,
        position INTEGER NOT NULL,
        PRIMARY KEY (source_note_id, position)
      );

      CREATE TABLE IF NOT EXISTS note_tags (
        note_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (note_id, tag)
      );

      CREATE TABLE IF NOT EXISTS note_components (
        note_id TEXT NOT NULL,
        component_name TEXT NOT NULL,
        PRIMARY KEY (note_id, component_name)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts
        USING fts5(note_id UNINDEXED, title, body, tokenize = 'unicode61');

      CREATE INDEX IF NOT EXISTS idx_note_aliases_normalized
        ON note_aliases(alias_normalized);
      CREATE INDEX IF NOT EXISTS idx_note_links_target_normalized
        ON note_links(target_normalized);
      CREATE INDEX IF NOT EXISTS idx_notes_relative_path
        ON notes(relative_path);

      PRAGMA user_version = ${SCHEMA_VERSION};
    `)
  }

  private replaceChildRows(noteId: string, note: NoteIndex): void {
    this.db.prepare('DELETE FROM note_aliases WHERE note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_headings WHERE note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_links WHERE source_note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_components WHERE note_id = ?').run(noteId)

    const insertAlias = this.db.prepare(
      'INSERT OR IGNORE INTO note_aliases (note_id, alias, alias_normalized) VALUES (?, ?, ?)'
    )
    const insertHeading = this.db.prepare(
      `INSERT INTO note_headings (note_id, depth, text, slug, position)
       VALUES (?, ?, ?, ?, ?)`
    )
    const insertLink = this.db.prepare(
      `INSERT INTO note_links (source_note_id, target, target_normalized, display, position)
       VALUES (?, ?, ?, ?, ?)`
    )
    const insertTag = this.db.prepare(
      'INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)'
    )
    const insertComponent = this.db.prepare(
      'INSERT OR IGNORE INTO note_components (note_id, component_name) VALUES (?, ?)'
    )

    note.aliases.forEach((alias) => {
      insertAlias.run(noteId, alias, normalizeLinkKey(alias))
    })
    note.headings.forEach((heading) => {
      insertHeading.run(noteId, heading.depth, heading.text, heading.slug, heading.position)
    })
    note.wikilinks.forEach((link, position) => {
      insertLink.run(noteId, link.target, link.targetNormalized, link.display, position)
    })
    note.tags.forEach((tag) => {
      insertTag.run(noteId, tag)
    })
    note.components.forEach((componentName) => {
      insertComponent.run(noteId, componentName)
    })
  }

  private replaceFtsRow(noteId: string, note: NoteIndex): void {
    this.db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(noteId)
    this.db
      .prepare('INSERT INTO notes_fts (note_id, title, body) VALUES (?, ?, ?)')
      .run(noteId, note.title, note.body)
  }

  private getNoteByRelativePath(relativePath: string): IndexedNoteSummary | null {
    const row = this.db
      .prepare(
        `SELECT id, relative_path, title, mtime_ms, content_hash
         FROM notes
         WHERE relative_path = ?`
      )
      .get(relativePath) as NoteRow | undefined

    if (!row) {
      return null
    }

    return this.attachAliases([row])[0]
  }

  private attachAliases<TRow extends NoteRow>(rows: TRow[]): IndexedNoteSummary[] {
    const noteIds = rows.map((row) => row.id)

    if (noteIds.length === 0) {
      return []
    }

    const placeholders = noteIds.map(() => '?').join(', ')
    const aliasRows = this.db
      .prepare(
        `SELECT note_id, alias
         FROM note_aliases
         WHERE note_id IN (${placeholders})
         ORDER BY alias COLLATE NOCASE`
      )
      .all(...noteIds) as AliasRow[]
    const aliasesByNoteId = new Map<string, string[]>()

    aliasRows.forEach((row) => {
      const aliases = aliasesByNoteId.get(row.note_id) ?? []
      aliases.push(row.alias)
      aliasesByNoteId.set(row.note_id, aliases)
    })

    return rows.map((row) => ({
      id: row.id,
      relativePath: row.relative_path,
      title: row.title,
      aliases: aliasesByNoteId.get(row.id) ?? [],
      mtimeMs: row.mtime_ms,
      contentHash: row.content_hash
    }))
  }
}

export function createNoteId(relativePath: string): string {
  return createHash('sha256').update(relativePath).digest('hex')
}

function toFtsQuery(query: string): string | null {
  const tokens = query.match(/[\p{Letter}\p{Number}_]+/gu)

  if (!tokens || tokens.length === 0) {
    return null
  }

  return tokens.map((token) => `"${token.replaceAll('"', '""')}"*`).join(' AND ')
}
