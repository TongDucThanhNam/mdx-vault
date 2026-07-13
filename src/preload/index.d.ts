import type { RenamePlanPreview, RenameResult } from '../shared/rename'

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

interface TrashEntry {
  relativePath: string
  originalPath: string
  name: string
  extension: '.md' | '.mdx'
  mtimeMs: number
}

interface NoteTemplate {
  relativePath: string
  name: string
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
  matches: string[]
}

interface BacklinkResult {
  kind: 'linked' | 'unlinked'
  source: IndexedNoteSummary
  target: string
  display: string
  snippet: string
  matchedText: string
}

interface NoteHeadingResult {
  depth: number
  text: string
  slug: string
  position: number
}

interface TagSummary {
  tag: string
  count: number
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

interface SelectionRange {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  text: string
}

interface RegistryTemplateHint {
  name: string
  description: string
  category: string
  snippet?: string
  propsSchemaDescription: string
}

interface AiPublicSettings {
  version: 1
  provider: 'openai' | 'none'
  model: string
  hasApiKey: boolean
  safeStorageAvailable: boolean
  baseUrl?: string
  updatedAt?: string
}

type ExportMode = 'static' | 'interactive'

interface ExportScanResult {
  noteRelativePath: string
  noteTitle: string
  usedComponents: string[]
  sandboxIslands: Array<{
    kind: 'html' | 'interactive'
    src: string
    resolvedPath: string
    manifestName: string
    permissionStatus: 'allowed' | 'denied' | 'prompt'
    fallback?: string
  }>
  imageAssets: string[]
  datasetAssets: string[]
  wikilinkTargets: string[]
}

interface ExportPickTargetResult {
  absolutePath: string
}

interface ExportRunPayload {
  noteRelativePath: string
  mode: ExportMode
  target: { absolutePath: string }
  confirmedOversized?: boolean
}

interface ExportRunResult {
  size: number
  warnings: string[]
  sandboxSkipped: Array<{ resolvedPath: string; reason: string }>
}

type ExportProgressEvent =
  | { phase: 'scan'; message: string }
  | { phase: 'render'; message: string }
  | { phase: 'bundle'; message: string }
  | { phase: 'inline'; message: string }
  | { phase: 'leak-check' }
  | { phase: 'write' }
  | { phase: 'done'; size: number }
  | { phase: 'error'; code: string; message: string }
  | { phase: 'size-warning'; totalBytes: number; thresholdBytes: number }

interface AiSaveSettingsInput {
  provider: 'openai' | 'none'
  model: string
  apiKey?: string
  clearApiKey?: boolean
  baseUrl?: string
}

interface AssistantContext {
  noteRelativePath: string
  noteTitle: string
  noteExcerpt: string
  selection: SelectionRange | null
  backlinks: Array<{ relativePath: string; display: string }>
  registryTemplateHints: RegistryTemplateHint[]
}

type AssistantEvent =
  | { type: 'token'; delta: string }
  | { type: 'tool-call'; callId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; callId: string; ok: boolean; output?: unknown; error?: string }
  | {
      type: 'patch-proposal'
      proposal: { rationale?: string; patches: PatchOperation[] }
    }
  | { type: 'error'; message: string; code?: string }
  | { type: 'done' }

type PatchOperation =
  | {
      kind: 'textPatch'
      rationale?: string
      start: number
      end: number
      replacement: string
    }
  | {
      kind: 'interactiveInsert'
      rationale?: string
      atOffset: number
      src: string
      propsJson: string
    }
  | {
      kind: 'componentDraft'
      rationale?: string
      folderRelativePath: string
      componentSource: string
      manifestJson: string
      readmeMarkdown: string
      provenance: {
        prompt: string
        noteRelativePath: string
        modelName: string
        generatedAt: string
      }
    }

interface AssistantApplyPatchOutput {
  results: Array<
    | { kind: 'textPatch'; resultText: string }
    | { kind: 'interactiveInsert'; resultText: string }
    | {
        kind: 'componentDraft'
        files: Array<{ relativePath: string; content: string }>
      }
  >
}

interface AssistantChatStartInput {
  context: AssistantContext
  actionId: string
  userMessage: string
}

interface AssistantChatStartOutput {
  sessionId: string
}

interface AiApi {
  getSettings: () => Promise<AiPublicSettings>
  saveSettings: (input: AiSaveSettingsInput) => Promise<AiPublicSettings>
  clearApiKey: () => Promise<AiPublicSettings>
  chatStart: (input: AssistantChatStartInput) => Promise<AssistantChatStartOutput>
  chatCancel: (input: { sessionId: string }) => Promise<{ ok: boolean; reason?: string }>
  applyPatch: (input: {
    noteRelativePath: string
    operations: PatchOperation[]
  }) => Promise<AssistantApplyPatchOutput>
  approvePatch: (input: {
    noteRelativePath: string
    operations: PatchOperation[]
  }) => Promise<{ writtenPaths: string[] }>
  allowedPatchKinds: () => Promise<ReadonlyArray<PatchOperation['kind']>>
  onEvent: (callback: (sessionId: string, event: AssistantEvent) => void) => () => void
}

interface ExportApi {
  scan: (noteRelativePath: string) => Promise<ExportScanResult>
  pickTarget: (input: {
    noteRelativePath: string
    mode: ExportMode
    defaultFileName: string
  }) => Promise<ExportPickTargetResult | null>
  run: (input: ExportRunPayload) => Promise<ExportRunResult>
  onProgress: (callback: (event: ExportProgressEvent) => void) => () => void
}

interface VaultApi {
  openVault: () => Promise<VaultInfo | null>
  openVaultPath: (path: string) => Promise<VaultInfo | null>
  lastOpenVault: () => Promise<string | null>
  listFiles: () => Promise<VaultFile[]>
  readFile: (relativePath: string) => Promise<string>
  readAssetFile: (relativePath: string) => Promise<string>
  writeFile: (relativePath: string, content: string) => Promise<void>
  createFile: (relativePath: string, content: string) => Promise<string>
  deleteFile: (relativePath: string) => Promise<string>
  planRename: (fromRelativePath: string, toRelativePath: string) => Promise<RenamePlanPreview>
  renameFile: (
    fromRelativePath: string,
    toRelativePath: string,
    updateLinks: boolean
  ) => Promise<RenameResult>
  duplicateFile: (relativePath: string) => Promise<string>
  fileExists: (relativePath: string) => Promise<boolean>
  emptyTrash: () => Promise<void>
  listTrash: () => Promise<TrashEntry[]>
  listTemplates: () => Promise<NoteTemplate[]>
  renderTemplate: (relativePath: string, title: string) => Promise<string>
  revealInExplorer: (relativePath: string) => Promise<void>
  resolveAbsolutePath: (relativePath: string) => Promise<string>
  saveAsset: (suggestedName: string, base64: string) => Promise<string>
}

interface IndexApi {
  search: (query: string, limit?: number) => Promise<SearchResult[]>
  backlinks: (relativePath: string) => Promise<BacklinkResult[]>
  notes: () => Promise<IndexedNoteSummary[]>
  headingsOfNote: (relativePath: string) => Promise<NoteHeadingResult[]>
  tags: () => Promise<TagSummary[]>
  notesByTag: (tag: string) => Promise<IndexedNoteSummary[]>
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

type AppTheme = 'light' | 'dark' | 'system'
type FileTreeSortSetting = 'name' | 'modified-desc' | 'created-desc'

interface AppApi {
  getTheme: () => Promise<AppTheme>
  setTheme: (theme: AppTheme) => Promise<AppTheme>
  getFileTreeSort: () => Promise<FileTreeSortSetting>
  setFileTreeSort: (sort: FileTreeSortSetting) => Promise<FileTreeSortSetting>
}

declare global {
  interface Window {
    vaultApi: VaultApi
    indexApi: IndexApi
    sandboxApi: SandboxApi
    aiApi: AiApi
    exportApi: ExportApi
    appApi: AppApi
  }
}

export {}
