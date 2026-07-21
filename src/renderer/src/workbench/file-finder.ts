import { isEditableTextPath, isNotePath, isPreviewableVaultImagePath } from '@/vault/file-kind'
import type { IndexedNoteSummary, VaultTreeFile } from '@/vault/types'

import type { WorkbenchItemKind } from './types'
import { canonicalizeWorkbenchPath } from './workbench-state'

export type FileFinderMatchKind =
  | 'title'
  | 'basename'
  | 'alias'
  | 'path'
  | 'extension'
  | 'directory'
  | 'empty'

export interface FileFinderResult {
  file: VaultTreeFile
  relativePath: string
  name: string
  basename: string
  directory: string
  extension: string
  kind: WorkbenchItemKind
  title: string
  aliases: string[]
  score: number
  matchKind: FileFinderMatchKind
  matchedAlias?: string
  isOpen: boolean
  isRecent: boolean
}

export interface FileFinderSearchOptions {
  /** Null means no vault. An empty array means an open, empty vault. */
  files: readonly VaultTreeFile[] | null
  notes?: readonly IndexedNoteSummary[]
  query?: string
  /** Prefer MRU order when supplied by the workbench. */
  openIds?: readonly string[]
  /** Current-session only; the caller resets this list on a vault switch. */
  recentIds?: readonly string[]
  limit?: number
}

export type FileFinderModel =
  | { status: 'no_vault'; results: [] }
  | { status: 'ready'; results: FileFinderResult[] }

export type FileFinderSelectionResolution =
  | { status: 'ready'; file: VaultTreeFile }
  | { status: 'stale' }
  | { status: 'no_vault' }

interface MatchScore {
  score: number
  matchKind: FileFinderMatchKind
  matchedAlias?: string
}

interface FileFinderEntry {
  file: VaultTreeFile
  relativePath: string
  name: string
  basename: string
  directory: string
  extension: string
  kind: WorkbenchItemKind
  title: string
  aliases: string[]
}

export function isFileFinderAvailable(
  files: readonly VaultTreeFile[] | null
): files is readonly VaultTreeFile[] {
  return files !== null
}

export function getFileFinderModel(options: FileFinderSearchOptions): FileFinderModel {
  if (!isFileFinderAvailable(options.files)) {
    return { status: 'no_vault', results: [] }
  }

  const query = normalizeSearchText(options.query ?? '')
  const notesByPath = new Map<string, IndexedNoteSummary>()
  for (const note of options.notes ?? []) {
    const canonicalPath = tryCanonicalizeWorkbenchPath(note.relativePath)
    if (canonicalPath) {
      notesByPath.set(canonicalPath, note)
    }
  }
  const openRanks = createRankMap(options.openIds ?? [])
  const recentRanks = createRankMap(options.recentIds ?? [])
  const results = options.files
    .map((file) => createEntry(file, notesByPath))
    .map((entry): FileFinderResult | null => {
      const match = query ? scoreEntry(entry, query) : EMPTY_MATCH

      if (match.score <= 0) {
        return null
      }

      return {
        ...entry,
        score: match.score,
        matchKind: match.matchKind,
        matchedAlias: match.matchedAlias,
        isOpen: openRanks.has(entry.relativePath),
        isRecent: recentRanks.has(entry.relativePath)
      }
    })
    .filter((result): result is FileFinderResult => result !== null)
    .sort((left, right) => compareResults(left, right, query.length > 0, openRanks, recentRanks))
    .slice(0, Math.max(0, options.limit ?? 30))

  return { status: 'ready', results }
}

export function getFileFinderResults(options: FileFinderSearchOptions): FileFinderResult[] {
  return getFileFinderModel(options).results
}

export function resolveFileFinderSelection(
  relativePath: string,
  files: readonly VaultTreeFile[] | null
): FileFinderSelectionResolution {
  if (!files) {
    return { status: 'no_vault' }
  }

  const canonicalPath = tryCanonicalizeWorkbenchPath(relativePath)
  if (!canonicalPath) {
    return { status: 'stale' }
  }
  const file = files.find(
    (candidate) => canonicalizeWorkbenchPath(candidate.relativePath) === canonicalPath
  )

  return file ? { status: 'ready', file } : { status: 'stale' }
}

export function classifyFileFinderItem(relativePath: string): WorkbenchItemKind {
  if (isNotePath(relativePath)) {
    return 'note'
  }

  if (isEditableTextPath(relativePath)) {
    return 'text'
  }

  if (isPreviewableVaultImagePath(relativePath)) {
    return 'image'
  }

  return 'unsupported'
}

export function recordRecentFile(
  currentIds: readonly string[],
  relativePath: string,
  limit = 20
): string[] {
  const id = canonicalizeWorkbenchPath(relativePath)
  return [id, ...currentIds.filter((candidate) => candidate !== id)].slice(0, Math.max(0, limit))
}

export function resetFileFinderSessionRecents(): string[] {
  return []
}

/**
 * The explicit create row can use this guard to avoid treating `data.csv` or
 * unsafe/path-like input as an implicit note name.
 */
export function canOfferCreateMdxNote(
  query: string,
  notes: readonly IndexedNoteSummary[]
): boolean {
  const trimmedQuery = query.trim()

  if (!trimmedQuery || trimmedQuery.includes('\0')) {
    return false
  }

  const slashedQuery = trimmedQuery.replaceAll('\\', '/')
  if (
    slashedQuery.startsWith('/') ||
    /^[A-Za-z]:\//u.test(slashedQuery) ||
    slashedQuery.split('/').includes('..')
  ) {
    return false
  }

  const finalSegment = slashedQuery.split('/').at(-1) ?? ''
  const dotIndex = finalSegment.lastIndexOf('.')

  if (dotIndex > 0) {
    const extension = finalSegment.slice(dotIndex).toLocaleLowerCase()
    if (extension !== '.md' && extension !== '.mdx') {
      return false
    }
  }

  const normalizedQuery = normalizeSearchText(trimmedQuery.replace(/\.(?:md|mdx)$/iu, ''))
  return !notes.some((note) => {
    const pathWithoutExtension = note.relativePath.replace(/\.(?:md|mdx)$/iu, '')
    return [note.title, pathWithoutExtension, note.relativePath, ...note.aliases].some(
      (candidate) => normalizeSearchText(candidate) === normalizedQuery
    )
  })
}

const EMPTY_MATCH: MatchScore = { score: 1, matchKind: 'empty' }

function createEntry(
  file: VaultTreeFile,
  notesByPath: ReadonlyMap<string, IndexedNoteSummary>
): FileFinderEntry {
  const relativePath = canonicalizeWorkbenchPath(file.relativePath)
  const pathSegments = relativePath.split('/')
  const pathName = pathSegments.at(-1) ?? relativePath
  const name = file.name || pathName
  const extension = normalizeExtension(file.extension || getExtension(pathName))
  const basename = removeExtension(name, extension)
  const note = notesByPath.get(relativePath)

  return {
    file,
    relativePath,
    name,
    basename,
    directory: file.directory || pathSegments.slice(0, -1).join('/'),
    extension,
    kind: classifyFileFinderItem(relativePath),
    title: note?.title || (isNotePath(relativePath) ? basename : name),
    aliases: note?.aliases ?? []
  }
}

function scoreEntry(entry: FileFinderEntry, query: string): MatchScore {
  const fields: Array<{
    value: string
    kind: Exclude<FileFinderMatchKind, 'empty'>
    weight: number
    alias?: string
  }> = [
    ...(entry.kind === 'note'
      ? [
          { value: entry.title, kind: 'title' as const, weight: 600 },
          ...entry.aliases.map((alias) => ({
            value: alias,
            kind: 'alias' as const,
            weight: 540,
            alias
          }))
        ]
      : []),
    { value: entry.basename, kind: 'basename', weight: 580 },
    { value: entry.name, kind: 'basename', weight: 560 },
    { value: entry.relativePath, kind: 'path', weight: 420 },
    { value: entry.relativePath.replace(/\.[^/.]+$/u, ''), kind: 'path', weight: 410 },
    { value: entry.extension, kind: 'extension', weight: 340 },
    { value: entry.extension.replace(/^\./u, ''), kind: 'extension', weight: 330 },
    { value: entry.directory, kind: 'directory', weight: 260 }
  ]
  let best: MatchScore = { score: 0, matchKind: 'path' }

  for (const field of fields) {
    const fieldScore = scoreText(field.value, query)
    const score = fieldScore > 0 ? fieldScore + field.weight : 0

    if (score > best.score) {
      best = {
        score,
        matchKind: field.kind,
        matchedAlias: field.kind === 'alias' ? field.alias : undefined
      }
    }
  }

  return best
}

function scoreText(value: string, query: string): number {
  const normalizedValue = normalizeSearchText(value)

  if (!normalizedValue) {
    return 0
  }

  if (normalizedValue === query) {
    return 1000
  }

  if (normalizedValue.startsWith(query)) {
    return 760
  }

  const wordIndex = normalizedValue.search(new RegExp(`(?:^|[\\s._/-])${escapeRegExp(query)}`, 'u'))
  if (wordIndex !== -1) {
    return 680
  }

  if (normalizedValue.includes(query)) {
    return 520
  }

  return isSubsequence(query, normalizedValue) ? 240 : 0
}

function compareResults(
  left: FileFinderResult,
  right: FileFinderResult,
  hasQuery: boolean,
  openRanks: ReadonlyMap<string, number>,
  recentRanks: ReadonlyMap<string, number>
): number {
  if (hasQuery && left.score !== right.score) {
    return right.score - left.score
  }

  const leftOpenRank = openRanks.get(left.relativePath)
  const rightOpenRank = openRanks.get(right.relativePath)
  const openComparison = compareOptionalRanks(leftOpenRank, rightOpenRank)
  if (openComparison !== 0) {
    return openComparison
  }

  const leftRecentRank = recentRanks.get(left.relativePath)
  const rightRecentRank = recentRanks.get(right.relativePath)
  const recentComparison = compareOptionalRanks(leftRecentRank, rightRecentRank)
  if (recentComparison !== 0) {
    return recentComparison
  }

  if (hasQuery && left.score !== right.score) {
    return right.score - left.score
  }

  return (
    compareStableText(left.title, right.title) ||
    compareStableText(left.relativePath, right.relativePath)
  )
}

function compareOptionalRanks(left: number | undefined, right: number | undefined): number {
  if (left !== undefined && right === undefined) {
    return -1
  }

  if (left === undefined && right !== undefined) {
    return 1
  }

  return (left ?? 0) - (right ?? 0)
}

function createRankMap(ids: readonly string[]): Map<string, number> {
  const ranks = new Map<string, number>()

  for (const id of ids) {
    const canonicalId = tryCanonicalizeWorkbenchPath(id)
    if (canonicalId && !ranks.has(canonicalId)) {
      ranks.set(canonicalId, ranks.size)
    }
  }

  return ranks
}

function getExtension(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  return dotIndex > 0 ? name.slice(dotIndex) : ''
}

function normalizeExtension(extension: string): string {
  if (!extension) {
    return ''
  }

  const normalized = extension.toLocaleLowerCase()
  return normalized.startsWith('.') ? normalized : `.${normalized}`
}

function removeExtension(name: string, extension: string): string {
  if (!extension || !name.toLocaleLowerCase().endsWith(extension)) {
    return name
  }

  return name.slice(0, -extension.length)
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function isSubsequence(query: string, value: string): boolean {
  let queryIndex = 0

  for (const character of value) {
    if (character === query[queryIndex]) {
      queryIndex += 1
    }

    if (queryIndex === query.length) {
      return true
    }
  }

  return false
}

function compareStableText(left: string, right: string): number {
  const normalizedLeft = normalizeSearchText(left)
  const normalizedRight = normalizeSearchText(right)

  if (normalizedLeft < normalizedRight) {
    return -1
  }

  if (normalizedLeft > normalizedRight) {
    return 1
  }

  if (left < right) {
    return -1
  }

  return left > right ? 1 : 0
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function tryCanonicalizeWorkbenchPath(relativePath: string): string | null {
  try {
    return canonicalizeWorkbenchPath(relativePath)
  } catch {
    return null
  }
}
