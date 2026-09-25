import type { BookmarkManifest } from '../shared/bookmarks'
import type {
  ExportMode,
  ExportPickTargetResult,
  ExportProgressEvent,
  ExportRunPayload,
  ExportRunResult,
  ExportScanResult
} from '../shared/export'
import type {
  GraphConfigLoadResult,
  GraphSnapshot,
  GraphSnapshotRequest,
  GraphViewManifest
} from '../shared/graph'
import type {
  InteractiveCreatePayload,
  InteractiveCreateResult
} from '../shared/interactive-authoring'
import type {
  KnowledgeNoteSnapshot,
  LinkMentionRequest,
  PropertyMutationRequest,
  PropertyMutationResponse,
  PropertyRenameApplyRequest,
  PropertyRenamePlan,
  PropertyRenameResult,
  PropertySummary
} from '../shared/knowledge'
import type { RenamePlanPreview, RenameResult } from '../shared/rename'

interface VaultFile {
  relativePath: string
  name: string
  directory: string
  extension: '.md' | '.mdx'
}

interface VaultTreeFile {
  relativePath: string
  name: string
  directory: string
  extension: string
}

interface VaultInfo {
  name: string
  files: VaultFile[]
  treeFiles: VaultTreeFile[]
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
  heading: NoteHeadingResult | null
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
  id: string
  depth: number
  text: string
  slug: string
  position: number
  sourceFrom: number
  sourceTo: number
}

interface TagSummary {
  tag: string
  count: number
}

type SandboxKind = 'html' | 'interactive'
type SandboxPermissionDecision = 'allow' | 'deny'
type SandboxPermissionStatus = 'allowed' | 'denied' | 'prompt'
type SandboxAuthoringProofResult =
  | { status: 'ready'; document: SandboxDocument }
  | {
      status: 'issues'
      diagnostics: import('../shared/interactive-authoring').InteractiveDiagnostic[]
    }

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
  documentUrl: string
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
  listTreeFiles: () => Promise<VaultTreeFile[]>
  onTreeDidChange: (callback: () => void) => () => void
  readFile: (relativePath: string) => Promise<string>
  readAssetFile: (relativePath: string) => Promise<string>
  readTextFile: (relativePath: string) => Promise<string>
  writeTextFile: (relativePath: string, content: string) => Promise<void>
  readImageFile: (relativePath: string) => Promise<string>
  probeFile: (relativePath: string) => Promise<void>
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

interface KnowledgeApi {
  noteSnapshot: (relativePath: string) => Promise<KnowledgeNoteSnapshot>
  propertyInventory: () => Promise<PropertySummary[]>
  mutateProperty: (request: PropertyMutationRequest) => Promise<PropertyMutationResponse>
  linkMention: (request: LinkMentionRequest) => Promise<PropertyMutationResponse>
  planPropertyRename: (oldName: string, newName: string) => Promise<PropertyRenamePlan>
  applyPropertyRename: (request: PropertyRenameApplyRequest) => Promise<PropertyRenameResult>
}

interface BookmarkApi {
  get: () => Promise<BookmarkManifest>
  save: (manifest: BookmarkManifest, expectedRevision: number) => Promise<BookmarkManifest>
}

interface GraphApi {
  getSnapshot: (request: GraphSnapshotRequest) => Promise<GraphSnapshot>
  getConfig: () => Promise<GraphConfigLoadResult>
  saveConfig: (
    manifest: GraphViewManifest,
    expectedRevision: number
  ) => Promise<GraphConfigLoadResult>
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
  loadAuthoringProof: (
    projectRoot: string,
    instanceId: string,
    props: unknown
  ) => Promise<SandboxAuthoringProofResult>
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

interface InteractiveApi {
  create: (input: InteractiveCreatePayload) => Promise<InteractiveCreateResult>
}

export type AppTheme = 'light' | 'dark' | 'system'
export type FileTreeSortSetting = 'name' | 'modified-desc' | 'created-desc'
export type DefaultNoteViewSetting = 'source' | 'live' | 'reading'
export type EditorFontFamilySetting = import('../shared/app-settings').EditorFontFamilySetting
export type EditorFontWeightSetting = 'regular' | 'medium'
export type EditorTabSizeSetting = '2' | '4' | '8'
export type EditorWordWrapSetting = 'off' | 'viewport' | 'bounded'
export type EditorWhitespaceSetting = 'none' | 'all'
export type ActivateOnCloseSetting = 'history' | 'right' | 'left'
export type WhenClosingWithNoTabsSetting = 'keep_window_open' | 'close_window'
export type KeymapOverrides = Record<string, string[]>

export interface WorkbenchSettings {
  activateOnClose: ActivateOnCloseSetting
  whenClosingWithNoTabs: WhenClosingWithNoTabsSetting
}

export interface PagePreviewSettings {
  enabled: boolean
  requireModifier: boolean
}

export interface AppSettingsSnapshot {
  version: 6
  theme: AppTheme
  locale: 'system' | 'en' | 'vi'
  density: 'comfortable' | 'compact'
  uiScale: number
  fileTreeSort: FileTreeSortSetting
  defaultNoteView: DefaultNoteViewSetting
  editorFontSize: number
  editorFontFamily: EditorFontFamilySetting
  editorFontWeight: EditorFontWeightSetting
  editorLineHeight: number
  editorLigatures: boolean
  editorTabSize: EditorTabSizeSetting
  editorNoteWordWrap: EditorWordWrapSetting
  editorCodeWordWrap: EditorWordWrapSetting
  editorWrapColumn: number
  editorIndentGuides: boolean
  editorWhitespace: EditorWhitespaceSetting
  editorRuler: boolean
  pagePreview: PagePreviewSettings
  workbench: WorkbenchSettings
  keymapOverrides: KeymapOverrides
}

export interface AppSettingsPatch {
  theme?: AppTheme
  locale?: 'system' | 'en' | 'vi'
  density?: 'comfortable' | 'compact'
  uiScale?: number
  fileTreeSort?: FileTreeSortSetting
  defaultNoteView?: DefaultNoteViewSetting
  editorFontSize?: number
  editorFontFamily?: EditorFontFamilySetting
  editorFontWeight?: EditorFontWeightSetting
  editorLineHeight?: number
  editorLigatures?: boolean
  editorTabSize?: EditorTabSizeSetting
  editorNoteWordWrap?: EditorWordWrapSetting
  editorCodeWordWrap?: EditorWordWrapSetting
  editorWrapColumn?: number
  editorIndentGuides?: boolean
  editorWhitespace?: EditorWhitespaceSetting
  editorRuler?: boolean
  pagePreview?: Partial<PagePreviewSettings>
  workbench?: Partial<WorkbenchSettings>
  keymapOverrides?: KeymapOverrides
}

interface AppApi {
  getSettings: () => Promise<AppSettingsSnapshot>
  updateSettings: (patch: AppSettingsPatch) => Promise<AppSettingsSnapshot>
  getTheme: () => Promise<AppTheme>
  setTheme: (theme: AppTheme) => Promise<AppTheme>
  getFileTreeSort: () => Promise<FileTreeSortSetting>
  setFileTreeSort: (sort: FileTreeSortSetting) => Promise<FileTreeSortSetting>
  getEditorFontSize: () => Promise<number>
  setEditorFontSize: (fontSize: number) => Promise<number>
}

interface WindowApi {
  platform: 'darwin' | 'win32' | 'linux' | 'other'
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<boolean>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
}

declare global {
  interface Window {
    vaultApi: VaultApi
    indexApi: IndexApi
    knowledgeApi: KnowledgeApi
    bookmarkApi: BookmarkApi
    graphApi: GraphApi
    sandboxApi: SandboxApi
    interactiveApi: InteractiveApi
    aiApi: AiApi
    exportApi: ExportApi
    appApi: AppApi
    windowApi: WindowApi
  }
}
