import DatabaseConstructor, { type Database as BetterSqliteDatabase } from 'better-sqlite3'
import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { basename, join } from 'path'
import type {
  IndexedProperty,
  OutgoingLinkResult,
  PropertyInventoryType,
  PropertySummary
} from '../../shared/knowledge'
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
  matches: string[]
}

export interface BacklinkResult {
  kind: 'linked' | 'unlinked'
  source: IndexedNoteSummary
  target: string
  display: string
  snippet: string
  matchedText: string
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
  body: string | null
}

interface BacklinkRow extends NoteRow {
  target: string
  display: string | null
  body: string | null
}

interface NoteBodyRow extends NoteRow {
  body: string | null
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

interface OutgoingLinkRow {
  kind: 'wikilink' | 'markdown'
  target: string
  note_target: string
  target_normalized: string
  subpath: string | null
  display: string | null
  source_from: number
  source_to: number
  position: number
}

interface PropertyRow {
  name: string
  normalized_name: string
  type: IndexedProperty['type']
  empty: number
  editable: number
  unsupported_reason: string | null
  position: number
}

interface PropertyValueRow {
  property_position: number
  value: string
}

interface PropertySummaryRow {
  name: string
  normalized_name: string
  types: string
  use_count: number
}

const SCHEMA_VERSION = 3
const MAX_SEARCH_QUERY_LENGTH = 300
const MAX_SEARCH_LIMIT = 100
const MAX_REGEX_PATTERN_LENGTH = 160
const MAX_REGEX_SCAN_ROWS = 1000
const MAX_BACKLINK_SCAN_ROWS = 1000
const MAX_OUTGOING_LINKS = 500

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
      this.db.prepare('DELETE FROM note_property_values WHERE note_id = ?').run(noteId)
      this.db.prepare('DELETE FROM note_properties WHERE note_id = ?').run(noteId)
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

  findLinkSourcePaths(targetKeys: string[]): string[] {
    const uniqueKeys = uniqueNonEmpty(targetKeys.map((key) => normalizeLinkKey(key)))

    if (uniqueKeys.length === 0) {
      return []
    }

    const placeholders = uniqueKeys.map(() => '?').join(', ')
    const rows = this.db
      .prepare(
        `SELECT DISTINCT n.relative_path
         FROM note_links l
         JOIN notes n ON n.id = l.source_note_id
         WHERE l.target_normalized IN (${placeholders})
         ORDER BY n.relative_path COLLATE NOCASE`
      )
      .all(...uniqueKeys) as Array<{ relative_path: string }>

    return rows.map((row) => row.relative_path)
  }

  search(query: string, limit: number): SearchResult[] {
    const parsedQuery = parseSearchQuery(query)
    const resultLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_SEARCH_LIMIT)
    const ftsQuery = toFtsQuery(parsedQuery.text)

    if (!parsedQuery.hasFilters && !ftsQuery) {
      return []
    }

    const rows = this.runSearchQuery(parsedQuery, ftsQuery, resultLimit)

    const notes = this.attachAliases(rows)
    const results: SearchResult[] = []

    rows.forEach((row, index) => {
      if (!matchesFileFilters(row.relative_path, parsedQuery.files)) {
        return
      }

      const searchableText = buildSearchableText(row)

      if (!matchesRegexFilters(searchableText, parsedQuery.regexes)) {
        return
      }

      results.push({
        note: notes[index],
        snippet:
          row.snippet ||
          buildSearchSnippet(searchableText, parsedQuery.textTokens, parsedQuery.regexes) ||
          row.title,
        rank: row.rank,
        matches: buildSearchMatchLabels(parsedQuery)
      })
    })

    return results.slice(0, resultLimit)
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
    const linkedRows = this.db
      .prepare(
        `SELECT
           n.id,
           n.relative_path,
           n.title,
           n.mtime_ms,
           n.content_hash,
           l.target,
           l.display,
           notes_fts.body AS body
         FROM note_links l
         JOIN notes n ON n.id = l.source_note_id
         LEFT JOIN notes_fts ON notes_fts.note_id = n.id
         WHERE l.target_normalized IN (${placeholders})
         ORDER BY n.title COLLATE NOCASE, n.relative_path COLLATE NOCASE`
      )
      .all(...targetKeys) as BacklinkRow[]

    const sources = this.attachAliases(linkedRows)
    const linkedSourceIds = new Set(linkedRows.map((row) => row.id))
    const linkedBacklinks = linkedRows.map((row, index) => {
      const display = row.display ?? row.target
      const searchableText = row.body ?? row.title

      return {
        kind: 'linked' as const,
        source: sources[index],
        target: row.target,
        display,
        snippet: buildSearchSnippet(searchableText, [display, row.target], []) || row.title,
        matchedText: display
      }
    })

    const unlinkedRows = this.db
      .prepare(
        `SELECT
           n.id,
           n.relative_path,
           n.title,
           n.mtime_ms,
           n.content_hash,
           notes_fts.body AS body
         FROM notes n
         LEFT JOIN notes_fts ON notes_fts.note_id = n.id
         WHERE n.id <> ?
         ORDER BY n.title COLLATE NOCASE, n.relative_path COLLATE NOCASE
         LIMIT ?`
      )
      .all(note.id, MAX_BACKLINK_SCAN_ROWS) as NoteBodyRow[]

    const unlinkedSources = this.attachAliases(unlinkedRows)
    const mentionTerms = uniqueNonEmpty([note.title, ...note.aliases])
    const unlinkedBacklinks: BacklinkResult[] = []

    unlinkedRows.forEach((row, index) => {
      if (linkedSourceIds.has(row.id)) {
        return
      }

      const body = row.body ?? ''
      const matchedText = findPlainMention(body, mentionTerms)

      if (!matchedText) {
        return
      }

      unlinkedBacklinks.push({
        kind: 'unlinked',
        source: unlinkedSources[index],
        target: matchedText,
        display: matchedText,
        snippet: buildSearchSnippet(body, [matchedText], []) || row.title,
        matchedText
      })
    })

    return [...linkedBacklinks, ...unlinkedBacklinks]
  }

  getOutgoingLinks(relativePath: string): OutgoingLinkResult[] {
    const note = this.getNoteByRelativePath(relativePath)
    if (!note) return []

    const rows = this.db
      .prepare(
        `SELECT kind, target, note_target, target_normalized, subpath, display,
                source_from, source_to, position
         FROM note_links
         WHERE source_note_id = ?
         ORDER BY position ASC
         LIMIT ?`
      )
      .all(note.id, MAX_OUTGOING_LINKS) as OutgoingLinkRow[]
    const notes = this.listNotes()
    const notesByLinkKey = new Map<string, IndexedNoteSummary[]>()
    for (const candidate of notes) {
      for (const key of getNoteLinkKeys(candidate)) {
        const matches = notesByLinkKey.get(key) ?? []
        matches.push(candidate)
        notesByLinkKey.set(key, matches)
      }
    }

    return rows.map((row) => ({
      kind: row.kind,
      target: row.target,
      noteTarget: row.note_target,
      subpath: row.subpath,
      display: row.display ?? row.target,
      sourceFrom: row.source_from,
      sourceTo: row.source_to,
      resolved: notesByLinkKey.get(row.target_normalized) ?? []
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

  getPropertiesForNote(relativePath: string): IndexedProperty[] {
    const note = this.getNoteByRelativePath(relativePath)
    if (!note) return []

    const properties = this.db
      .prepare(
        `SELECT name, normalized_name, type, empty, editable, unsupported_reason, position
         FROM note_properties
         WHERE note_id = ?
         ORDER BY position ASC`
      )
      .all(note.id) as PropertyRow[]
    const values = this.db
      .prepare(
        `SELECT property_position, value
         FROM note_property_values
         WHERE note_id = ?
         ORDER BY property_position ASC, value_position ASC`
      )
      .all(note.id) as PropertyValueRow[]
    const valuesByPosition = new Map<number, string[]>()

    for (const row of values) {
      const current = valuesByPosition.get(row.property_position) ?? []
      current.push(row.value)
      valuesByPosition.set(row.property_position, current)
    }

    return properties.map((property) => ({
      name: property.name,
      normalizedName: property.normalized_name,
      type: property.type,
      values: valuesByPosition.get(property.position) ?? [],
      empty: property.empty === 1,
      editable: property.editable === 1,
      unsupportedReason: property.unsupported_reason
    }))
  }

  listProperties(): PropertySummary[] {
    const rows = this.db
      .prepare(
        `SELECT
           MIN(name) AS name,
           normalized_name,
           GROUP_CONCAT(DISTINCT type) AS types,
           COUNT(*) AS use_count
         FROM note_properties
         GROUP BY normalized_name
         ORDER BY normalized_name COLLATE NOCASE`
      )
      .all() as PropertySummaryRow[]

    return rows.map((row) => {
      const observedTypes = row.types.split(',').filter(Boolean)
      const type: PropertyInventoryType =
        observedTypes.length === 1 ? (observedTypes[0] as IndexedProperty['type']) : 'mixed'
      return {
        name: row.name,
        normalizedName: row.normalized_name,
        type,
        useCount: row.use_count
      }
    })
  }

  listNotePathsWithProperty(propertyName: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT n.relative_path
         FROM note_properties p
         JOIN notes n ON n.id = p.note_id
         WHERE p.normalized_name = ?
         ORDER BY n.relative_path COLLATE NOCASE`
      )
      .all(normalizePropertyName(propertyName)) as Array<{ relative_path: string }>
    return rows.map((row) => row.relative_path)
  }

  clearAll(): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM notes_fts').run()
      this.db.prepare('DELETE FROM note_aliases').run()
      this.db.prepare('DELETE FROM note_headings').run()
      this.db.prepare('DELETE FROM note_links').run()
      this.db.prepare('DELETE FROM note_tags').run()
      this.db.prepare('DELETE FROM note_components').run()
      this.db.prepare('DELETE FROM note_property_values').run()
      this.db.prepare('DELETE FROM note_properties').run()
      this.db.prepare('DELETE FROM notes').run()
    })()
  }

  private migrate(): void {
    const version = this.db.pragma('user_version', { simple: true }) as number

    if (version === SCHEMA_VERSION) {
      return
    }

    if (version === 1 || version === 2) {
      this.db.exec(`
        BEGIN;
        DROP TABLE IF EXISTS notes_fts;
        DROP TABLE IF EXISTS note_property_values;
        DROP TABLE IF EXISTS note_properties;
        DROP TABLE IF EXISTS note_aliases;
        DROP TABLE IF EXISTS note_headings;
        DROP TABLE IF EXISTS note_links;
        DROP TABLE IF EXISTS note_tags;
        DROP TABLE IF EXISTS note_components;
        DROP TABLE IF EXISTS notes;
        PRAGMA user_version = 0;
        COMMIT;
      `)
    }

    if (version !== 0 && version !== 1 && version !== 2) {
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
        kind TEXT NOT NULL,
        target TEXT NOT NULL,
        note_target TEXT NOT NULL,
        target_normalized TEXT NOT NULL,
        subpath TEXT,
        display TEXT,
        source_from INTEGER NOT NULL,
        source_to INTEGER NOT NULL,
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

      CREATE TABLE IF NOT EXISTS note_properties (
        note_id TEXT NOT NULL,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        type TEXT NOT NULL,
        empty INTEGER NOT NULL,
        editable INTEGER NOT NULL,
        unsupported_reason TEXT,
        position INTEGER NOT NULL,
        PRIMARY KEY (note_id, position),
        UNIQUE (note_id, normalized_name)
      );

      CREATE TABLE IF NOT EXISTS note_property_values (
        note_id TEXT NOT NULL,
        property_position INTEGER NOT NULL,
        value TEXT NOT NULL,
        normalized_value TEXT NOT NULL,
        value_position INTEGER NOT NULL,
        PRIMARY KEY (note_id, property_position, value_position)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts
        USING fts5(note_id UNINDEXED, title, body, tokenize = 'unicode61');

      CREATE INDEX IF NOT EXISTS idx_note_aliases_normalized
        ON note_aliases(alias_normalized);
      CREATE INDEX IF NOT EXISTS idx_note_links_target_normalized
        ON note_links(target_normalized);
      CREATE INDEX IF NOT EXISTS idx_notes_relative_path
        ON notes(relative_path);
      CREATE INDEX IF NOT EXISTS idx_note_properties_name
        ON note_properties(normalized_name);
      CREATE INDEX IF NOT EXISTS idx_note_property_values
        ON note_property_values(note_id, property_position, normalized_value);

      PRAGMA user_version = ${SCHEMA_VERSION};
    `)
  }

  private replaceChildRows(noteId: string, note: NoteIndex): void {
    this.db.prepare('DELETE FROM note_aliases WHERE note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_headings WHERE note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_links WHERE source_note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_components WHERE note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_property_values WHERE note_id = ?').run(noteId)
    this.db.prepare('DELETE FROM note_properties WHERE note_id = ?').run(noteId)

    const insertAlias = this.db.prepare(
      'INSERT OR IGNORE INTO note_aliases (note_id, alias, alias_normalized) VALUES (?, ?, ?)'
    )
    const insertHeading = this.db.prepare(
      `INSERT INTO note_headings (note_id, depth, text, slug, position)
       VALUES (?, ?, ?, ?, ?)`
    )
    const insertLink = this.db.prepare(
      `INSERT INTO note_links (
         source_note_id, kind, target, note_target, target_normalized, subpath, display,
         source_from, source_to, position
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insertTag = this.db.prepare(
      'INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?, ?)'
    )
    const insertComponent = this.db.prepare(
      'INSERT OR IGNORE INTO note_components (note_id, component_name) VALUES (?, ?)'
    )
    const insertProperty = this.db.prepare(
      `INSERT INTO note_properties (
         note_id, name, normalized_name, type, empty, editable, unsupported_reason, position
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insertPropertyValue = this.db.prepare(
      `INSERT INTO note_property_values (
         note_id, property_position, value, normalized_value, value_position
       )
       VALUES (?, ?, ?, ?, ?)`
    )

    note.aliases.forEach((alias) => {
      insertAlias.run(noteId, alias, normalizeLinkKey(alias))
    })
    note.headings.forEach((heading) => {
      insertHeading.run(noteId, heading.depth, heading.text, heading.slug, heading.position)
    })
    note.wikilinks.forEach((link, position) => {
      insertLink.run(
        noteId,
        link.kind,
        link.target,
        link.noteTarget,
        link.targetNormalized,
        link.subpath,
        link.display,
        link.sourceFrom,
        link.sourceTo,
        position
      )
    })
    note.tags.forEach((tag) => {
      insertTag.run(noteId, tag)
    })
    note.components.forEach((componentName) => {
      insertComponent.run(noteId, componentName)
    })
    note.properties.forEach((property, propertyPosition) => {
      insertProperty.run(
        noteId,
        property.name,
        property.normalizedName,
        property.type,
        property.empty ? 1 : 0,
        property.editable ? 1 : 0,
        property.unsupportedReason,
        propertyPosition
      )
      property.values.forEach((value, valuePosition) => {
        insertPropertyValue.run(
          noteId,
          propertyPosition,
          value,
          normalizePropertyValue(value),
          valuePosition
        )
      })
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

  private runSearchQuery(
    parsedQuery: ParsedSearchQuery,
    ftsQuery: string | null,
    resultLimit: number
  ): SearchRow[] {
    const whereClauses: string[] = []
    const parameters: Array<number | string> = []

    if (ftsQuery) {
      whereClauses.push('notes_fts MATCH ?')
      parameters.push(ftsQuery)
    }

    parsedQuery.tags.forEach((tag) => {
      whereClauses.push(
        `EXISTS (
           SELECT 1
           FROM note_tags t
           WHERE t.note_id = n.id AND lower(t.tag) = ?
         )`
      )
      parameters.push(tag.toLocaleLowerCase())
    })

    parsedQuery.paths.forEach((pathFilter) => {
      whereClauses.push("lower(n.relative_path) LIKE ? ESCAPE '\\'")
      parameters.push(`%${escapeLike(pathFilter.toLocaleLowerCase())}%`)
    })

    parsedQuery.files.forEach((fileFilter) => {
      whereClauses.push("lower(n.relative_path) LIKE ? ESCAPE '\\'")
      parameters.push(`%${escapeLike(fileFilter.toLocaleLowerCase())}%`)
    })

    parsedQuery.properties.forEach((property) => {
      if (property.value === undefined) {
        whereClauses.push(
          `EXISTS (
             SELECT 1
             FROM note_properties p
             WHERE p.note_id = n.id AND p.normalized_name = ?
           )`
        )
        parameters.push(property.name)
        return
      }

      if (property.value === null) {
        whereClauses.push(
          `EXISTS (
             SELECT 1
             FROM note_properties p
             WHERE p.note_id = n.id AND p.normalized_name = ? AND p.empty = 1
           )`
        )
        parameters.push(property.name)
        return
      }

      whereClauses.push(
        `EXISTS (
           SELECT 1
           FROM note_properties p
           JOIN note_property_values pv
             ON pv.note_id = p.note_id AND pv.property_position = p.position
           WHERE p.note_id = n.id
             AND p.normalized_name = ?
             AND pv.normalized_value = ?
         )`
      )
      parameters.push(property.name, normalizePropertyValue(property.value))
    })

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const sqlLimit = parsedQuery.regexes.length > 0 ? MAX_REGEX_SCAN_ROWS : resultLimit

    if (ftsQuery) {
      return this.db
        .prepare(
          `SELECT
             n.id,
             n.relative_path,
             n.title,
             n.mtime_ms,
             n.content_hash,
             snippet(notes_fts, 2, '', '', '...', 12) AS snippet,
             bm25(notes_fts) AS rank,
             notes_fts.body AS body
           FROM notes_fts
           JOIN notes n ON n.id = notes_fts.note_id
           ${whereSql}
           ORDER BY rank, n.title COLLATE NOCASE
           LIMIT ?`
        )
        .all(...parameters, sqlLimit) as SearchRow[]
    }

    return this.db
      .prepare(
        `SELECT
           n.id,
           n.relative_path,
           n.title,
           n.mtime_ms,
           n.content_hash,
           '' AS snippet,
           0 AS rank,
           notes_fts.body AS body
         FROM notes n
         LEFT JOIN notes_fts ON notes_fts.note_id = n.id
         ${whereSql}
         ORDER BY n.title COLLATE NOCASE, n.relative_path COLLATE NOCASE
         LIMIT ?`
      )
      .all(...parameters, sqlLimit) as SearchRow[]
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

interface ParsedSearchQuery {
  text: string
  textTokens: string[]
  tags: string[]
  paths: string[]
  files: string[]
  regexes: RegExp[]
  regexLabels: string[]
  properties: PropertySearchFilter[]
  hasFilters: boolean
}

interface PropertySearchFilter {
  name: string
  value: string | null | undefined
  label: string
}

function parseSearchQuery(query: string): ParsedSearchQuery {
  const trimmedQuery = query.trim()

  if (trimmedQuery.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new Error(
      `Search query is too long. Keep it under ${MAX_SEARCH_QUERY_LENGTH} characters.`
    )
  }

  const textTokens: string[] = []
  const tags: string[] = []
  const paths: string[] = []
  const files: string[] = []
  const regexes: RegExp[] = []
  const regexLabels: string[] = []
  const properties: PropertySearchFilter[] = []

  for (const token of tokenizeSearchQuery(trimmedQuery)) {
    const propertyMatch = /^\[([^:\]]+)(?::([^\]]*))?\]$/u.exec(token)

    if (propertyMatch) {
      const name = normalizePropertyName(propertyMatch[1])
      const rawValue = propertyMatch[2]

      if (name) {
        properties.push({
          name,
          value:
            rawValue === undefined
              ? undefined
              : normalizePropertyName(rawValue) === 'null'
                ? null
                : stripWrappingQuotes(rawValue.trim()),
          label: token
        })
      }
      continue
    }

    const operatorMatch = /^(tag|path|file):(.+)$/i.exec(token)

    if (operatorMatch) {
      const operator = operatorMatch[1].toLocaleLowerCase()
      const value = stripWrappingQuotes(operatorMatch[2].trim())

      if (!value) {
        continue
      }

      if (operator === 'tag') {
        tags.push(value.replace(/^#/, ''))
      } else if (operator === 'path') {
        paths.push(value.replaceAll('\\', '/'))
      } else {
        files.push(value.replaceAll('\\', '/'))
      }
      continue
    }

    if (token.startsWith('/')) {
      const regex = parseRegexToken(token)
      regexes.push(regex)
      regexLabels.push(token)
      continue
    }

    textTokens.push(token)
  }

  return {
    text: textTokens.join(' '),
    textTokens,
    tags: uniqueNonEmpty(tags),
    paths: uniqueNonEmpty(paths),
    files: uniqueNonEmpty(files),
    regexes,
    regexLabels,
    properties,
    hasFilters:
      textTokens.length > 0 ||
      tags.length > 0 ||
      paths.length > 0 ||
      files.length > 0 ||
      regexes.length > 0 ||
      properties.length > 0
  }
}

function tokenizeSearchQuery(query: string): string[] {
  const tokens: string[] = []
  let index = 0

  while (index < query.length) {
    while (index < query.length && /\s/u.test(query[index])) {
      index += 1
    }

    if (index >= query.length) {
      break
    }

    if (query[index] === '/') {
      const start = index
      index += 1
      let escaped = false
      let closed = false

      while (index < query.length) {
        const character = query[index]

        if (!escaped && character === '/') {
          closed = true
          index += 1
          break
        }

        escaped = !escaped && character === '\\'
        if (character !== '\\') {
          escaped = false
        }
        index += 1
      }

      if (!closed) {
        throw new Error('Invalid regex search: missing closing slash.')
      }

      while (index < query.length && /[A-Za-z]/u.test(query[index])) {
        index += 1
      }

      tokens.push(query.slice(start, index))
      continue
    }

    if (query[index] === '[') {
      const closingIndex = query.indexOf(']', index + 1)
      if (closingIndex === -1) {
        throw new Error('Invalid property search: missing closing bracket.')
      }
      tokens.push(query.slice(index, closingIndex + 1))
      index = closingIndex + 1
      continue
    }

    const start = index
    while (index < query.length && !/\s/u.test(query[index])) {
      index += 1
    }
    tokens.push(query.slice(start, index))
  }

  return tokens
}

function parseRegexToken(token: string): RegExp {
  const lastSlash = token.lastIndexOf('/')
  const pattern = token.slice(1, lastSlash)
  const rawFlags = token.slice(lastSlash + 1)

  if (!pattern) {
    throw new Error('Invalid regex search: pattern cannot be empty.')
  }

  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    throw new Error(
      `Invalid regex search: pattern must be ${MAX_REGEX_PATTERN_LENGTH} characters or shorter.`
    )
  }

  if (/[^imsu]/u.test(rawFlags)) {
    throw new Error('Invalid regex search: only i, m, s, and u flags are supported.')
  }

  const flags = rawFlags || 'i'

  try {
    return new RegExp(pattern, flags)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid regex search: ${message}`)
  }
}

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }
  return value
}

function matchesFileFilters(relativePath: string, filters: string[]): boolean {
  if (filters.length === 0) {
    return true
  }

  const fileName = basename(relativePath).toLocaleLowerCase()
  return filters.every((filter) => fileName.includes(filter.toLocaleLowerCase()))
}

function matchesRegexFilters(value: string, regexes: RegExp[]): boolean {
  return regexes.every((regex) => {
    regex.lastIndex = 0
    return regex.test(value)
  })
}

function buildSearchableText(row: SearchRow | NoteBodyRow): string {
  return `${row.title}\n${row.relative_path}\n${row.body ?? ''}`
}

function buildSearchSnippet(text: string, terms: string[], regexes: RegExp[]): string {
  const normalizedTerms = terms
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .sort((left, right) => right.length - left.length)
  let matchIndex = -1
  let matchLength = 0

  for (const regex of regexes) {
    regex.lastIndex = 0
    const match = regex.exec(text)
    if (match?.index !== undefined) {
      matchIndex = match.index
      matchLength = match[0].length
      break
    }
  }

  if (matchIndex === -1) {
    const lowerText = text.toLocaleLowerCase()
    for (const term of normalizedTerms) {
      const index = lowerText.indexOf(term.toLocaleLowerCase())
      if (index !== -1) {
        matchIndex = index
        matchLength = term.length
        break
      }
    }
  }

  if (matchIndex === -1) {
    return collapseWhitespace(text).slice(0, 180)
  }

  const start = Math.max(0, matchIndex - 70)
  const end = Math.min(text.length, matchIndex + Math.max(matchLength, 1) + 90)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''

  return `${prefix}${collapseWhitespace(text.slice(start, end))}${suffix}`
}

function buildSearchMatchLabels(parsedQuery: ParsedSearchQuery): string[] {
  return [
    ...parsedQuery.tags.map((tag) => `tag:${tag}`),
    ...parsedQuery.paths.map((pathFilter) => `path:${pathFilter}`),
    ...parsedQuery.files.map((fileFilter) => `file:${fileFilter}`),
    ...parsedQuery.regexLabels,
    ...parsedQuery.properties.map((property) => property.label)
  ]
}

function normalizePropertyName(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

function normalizePropertyValue(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

function findPlainMention(text: string, terms: string[]): string | null {
  for (const term of terms.sort((left, right) => right.length - left.length)) {
    const regex = new RegExp(
      `(^|[^\\p{Letter}\\p{Number}_-])(${escapeRegExp(term)})(?=$|[^\\p{Letter}\\p{Number}_-])`,
      'iu'
    )
    const match = regex.exec(text)

    if (match) {
      return match[2]
    }
  }

  return null
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))]
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
