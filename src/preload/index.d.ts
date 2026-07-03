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

type SandboxKind = 'html' | 'interactive'
type SandboxPermissionDecision = 'allow' | 'deny'
type SandboxPermissionStatus = 'allowed' | 'denied' | 'prompt'

interface SandboxManifest {
  name: string
  version: string
  runtime: 'html' | 'react'
  permissions: {
    network: boolean
    filesystem: boolean
    dataPaths: string[]
  }
  propsSchema: Record<string, string>
  dependencies: Record<string, string>
  fallback?: string
}

interface SandboxDescriptor {
  kind: SandboxKind
  src: string
  resolvedPath: string
  contentHash: string
  manifest: SandboxManifest
  permissionStatus: SandboxPermissionStatus
}

interface SandboxDocument {
  kind: SandboxKind
  src: string
  resolvedPath: string
  contentHash: string
  instanceId: string
  srcDoc: string
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

interface SandboxApi {
  describeHtml: (src: string, notePath: string | null) => Promise<SandboxDescriptor>
  loadHtml: (
    src: string,
    notePath: string | null,
    contentHash: string,
    instanceId: string
  ) => Promise<SandboxDocument>
  describeInteractive: (src: string, notePath: string | null) => Promise<SandboxDescriptor>
  loadInteractive: (
    src: string,
    notePath: string | null,
    contentHash: string,
    instanceId: string,
    props: unknown
  ) => Promise<SandboxDocument>
  setPermission: (
    kind: SandboxKind,
    src: string,
    notePath: string | null,
    contentHash: string,
    decision: SandboxPermissionDecision
  ) => Promise<SandboxDescriptor>
  requestData: (
    kind: SandboxKind,
    src: string,
    notePath: string | null,
    contentHash: string,
    path: string
  ) => Promise<string>
}

declare global {
  interface Window {
    vaultApi: VaultApi
    indexApi: IndexApi
    sandboxApi: SandboxApi
  }
}

export {}
