export interface VaultFile {
  relativePath: string
  name: string
  directory: string
  extension: '.md' | '.mdx'
}

export interface VaultTreeFile {
  relativePath: string
  name: string
  directory: string
  extension: string
}

export interface VaultInfo {
  name: string
  files: VaultFile[]
  treeFiles: VaultTreeFile[]
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
