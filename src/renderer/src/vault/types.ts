export interface VaultFile {
  relativePath: string
  name: string
  directory: string
  extension: '.md' | '.mdx'
}

export interface VaultInfo {
  name: string
  files: VaultFile[]
}

export interface NoteTemplate {
  relativePath: string
  name: string
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
