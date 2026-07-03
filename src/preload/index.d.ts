interface VaultFile {
  relativePath: string
  name: string
  directory: string
  extension: '.md' | '.mdx'
}

interface VaultInfo {
  name: string
  files: VaultFile[]
}

interface IndexedNoteSummary {
  id: string
  relativePath: string
  title: string
  aliases: string[]
  mtimeMs: number
  contentHash: string
}

interface SearchResult {
  note: IndexedNoteSummary
  snippet: string
  rank: number
}

interface BacklinkResult {
  source: IndexedNoteSummary
  target: string
  display: string
}

interface VaultApi {
  openVault: () => Promise<VaultInfo | null>
  listFiles: () => Promise<VaultFile[]>
  readFile: (relativePath: string) => Promise<string>
  readAssetFile: (relativePath: string) => Promise<string>
  writeFile: (relativePath: string, content: string) => Promise<void>
}

interface IndexApi {
  search: (query: string, limit?: number) => Promise<SearchResult[]>
  backlinks: (relativePath: string) => Promise<BacklinkResult[]>
  notes: () => Promise<IndexedNoteSummary[]>
  rebuild: () => Promise<void>
  onDidChange: (callback: () => void) => () => void
}

declare global {
  interface Window {
    vaultApi: VaultApi
    indexApi: IndexApi
  }
}

export {}
