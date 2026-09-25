import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettingsPatch,
  AppSettingsSnapshot,
  AppTheme,
  FileTreeSortSetting
} from '../main/services/app-settings'
import type {
  AiPublicSettings,
  AiSaveSettingsInput,
  AssistantApplyPatchOutput,
  AssistantApprovePatchOutput,
  AssistantChatStartInput,
  AssistantChatStartOutput,
  AssistantEvent,
  PatchOperation
} from '../shared/ai'
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
import type {
  SandboxAuthoringProofResult,
  SandboxDescriptor,
  SandboxDocument,
  SandboxKind,
  SandboxPermissionDecision
} from '../shared/sandbox'

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

interface IpcSuccess<T> {
  ok: true
  data: T
}

interface IpcFailure {
  ok: false
  error: {
    code: string
    message: string
  }
}

type IpcResult<T> = IpcSuccess<T> | IpcFailure

class VaultApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'VaultApiError'
    this.code = code
  }
}

const vaultApi = {
  openVault: (): Promise<VaultInfo | null> => invokeVault('vault:open'),
  openVaultPath: (path: string): Promise<VaultInfo | null> =>
    invokeVault('vault:open-path', { path }),
  lastOpenVault: (): Promise<string | null> => invokeVault('vault:last-open'),
  listFiles: (): Promise<VaultFile[]> => invokeVault('vault:list-files'),
  listTreeFiles: (): Promise<VaultTreeFile[]> => invokeVault('vault:list-tree-files'),
  onTreeDidChange: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('vault:tree-changed', listener)
    return () => {
      ipcRenderer.removeListener('vault:tree-changed', listener)
    }
  },
  readFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:read-file', { relativePath }),
  readAssetFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:read-asset-file', { relativePath }),
  readTextFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:read-text-file', { relativePath }),
  writeTextFile: (relativePath: string, content: string): Promise<void> =>
    invokeVault('vault:write-text-file', { relativePath, content }),
  readImageFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:read-image-file', { relativePath }),
  probeFile: (relativePath: string): Promise<void> =>
    invokeVault('vault:probe-file', { relativePath }),
  writeFile: (relativePath: string, content: string): Promise<void> =>
    invokeVault('vault:write-file', { relativePath, content }),
  createFile: (relativePath: string, content: string): Promise<string> =>
    invokeVault('vault:create-file', { relativePath, content }),
  deleteFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:delete-file', { relativePath }),
  planRename: (fromRelativePath: string, toRelativePath: string): Promise<RenamePlanPreview> =>
    invokeVault('vault:plan-rename', { fromRelativePath, toRelativePath }),
  renameFile: (
    fromRelativePath: string,
    toRelativePath: string,
    updateLinks: boolean
  ): Promise<RenameResult> =>
    invokeVault('vault:rename-file', { fromRelativePath, toRelativePath, updateLinks }),
  duplicateFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:duplicate-file', { relativePath }),
  fileExists: (relativePath: string): Promise<boolean> =>
    invokeVault('vault:file-exists', { relativePath }),
  emptyTrash: (): Promise<void> => invokeVault('vault:empty-trash'),
  listTrash: (): Promise<TrashEntry[]> => invokeVault('vault:list-trash'),
  listTemplates: (): Promise<NoteTemplate[]> => invokeVault('vault:list-templates'),
  renderTemplate: (relativePath: string, title: string): Promise<string> =>
    invokeVault('vault:render-template', { relativePath, title }),
  revealInExplorer: (relativePath: string): Promise<void> =>
    invokeVault('vault:reveal-in-explorer', { relativePath }),
  resolveAbsolutePath: (relativePath: string): Promise<string> =>
    invokeVault('vault:resolve-absolute-path', { relativePath }),
  saveAsset: (suggestedName: string, base64: string): Promise<string> =>
    invokeVault('vault:save-asset', { suggestedName, base64 })
}

const indexApi = {
  search: (query: string, limit?: number): Promise<SearchResult[]> =>
    invokeIndex('index:search', { query, limit }),
  backlinks: (relativePath: string): Promise<BacklinkResult[]> =>
    invokeIndex('index:backlinks', { relativePath }),
  notes: (): Promise<IndexedNoteSummary[]> => invokeIndex('index:notes'),
  headingsOfNote: (relativePath: string): Promise<NoteHeadingResult[]> =>
    invokeIndex('index:headings-of-note', { relativePath }),
  tags: (): Promise<TagSummary[]> => invokeIndex('index:all-tags'),
  notesByTag: (tag: string): Promise<IndexedNoteSummary[]> =>
    invokeIndex('index:notes-by-tag', { tag }),
  rebuild: (): Promise<void> => invokeIndex('index:rebuild'),
  onDidChange: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('index:changed', listener)
    return () => {
      ipcRenderer.removeListener('index:changed', listener)
    }
  }
}

const knowledgeApi = {
  noteSnapshot: (relativePath: string): Promise<KnowledgeNoteSnapshot> =>
    invokeKnowledge('knowledge:note-snapshot', { relativePath }),
  propertyInventory: (): Promise<PropertySummary[]> =>
    invokeKnowledge('knowledge:property-inventory'),
  mutateProperty: (request: PropertyMutationRequest): Promise<PropertyMutationResponse> =>
    invokeKnowledge('knowledge:mutate-property', request),
  linkMention: (request: LinkMentionRequest): Promise<PropertyMutationResponse> =>
    invokeKnowledge('knowledge:link-mention', request),
  planPropertyRename: (oldName: string, newName: string): Promise<PropertyRenamePlan> =>
    invokeKnowledge('knowledge:plan-property-rename', { oldName, newName }),
  applyPropertyRename: (request: PropertyRenameApplyRequest): Promise<PropertyRenameResult> =>
    invokeKnowledge('knowledge:apply-property-rename', request)
}

const bookmarkApi = {
  get: (): Promise<BookmarkManifest> => invokeBookmarks('bookmarks:get'),
  save: (manifest: BookmarkManifest, expectedRevision: number): Promise<BookmarkManifest> =>
    invokeBookmarks('bookmarks:save', { manifest, expectedRevision })
}

const graphApi = {
  getSnapshot: (request: GraphSnapshotRequest): Promise<GraphSnapshot> =>
    invokeGraph('graph:get-snapshot', request),
  getConfig: (): Promise<GraphConfigLoadResult> => invokeGraph('graph:get-config'),
  saveConfig: (
    manifest: GraphViewManifest,
    expectedRevision: number
  ): Promise<GraphConfigLoadResult> =>
    invokeGraph('graph:save-config', { manifest, expectedRevision })
}

const sandboxApi = {
  describeHtml: (src: string, notePath: string | null): Promise<SandboxDescriptor> =>
    invokeSandbox('sandbox:describe-html', { src, notePath }),
  loadHtml: (
    src: string,
    notePath: string | null,
    contentHash: string,
    instanceId: string
  ): Promise<SandboxDocument> =>
    invokeSandbox('sandbox:load-html', { src, notePath, contentHash, instanceId }),
  describeInteractive: (src: string, notePath: string | null): Promise<SandboxDescriptor> =>
    invokeSandbox('sandbox:describe-interactive', { src, notePath }),
  loadInteractive: (
    src: string,
    notePath: string | null,
    contentHash: string,
    instanceId: string,
    props: unknown
  ): Promise<SandboxDocument> =>
    invokeSandbox('sandbox:load-interactive', { src, notePath, contentHash, instanceId, props }),
  loadAuthoringProof: (
    projectRoot: string,
    instanceId: string,
    props: unknown
  ): Promise<SandboxAuthoringProofResult> =>
    invokeSandbox('sandbox:load-authoring-proof', {
      mode: 'authoring-proof',
      projectRoot,
      instanceId,
      props
    }),
  setPermission: (
    kind: SandboxKind,
    src: string,
    notePath: string | null,
    contentHash: string,
    decision: SandboxPermissionDecision
  ): Promise<SandboxDescriptor> =>
    invokeSandbox('sandbox:set-permission', { kind, src, notePath, contentHash, decision }),
  requestData: (
    kind: SandboxKind,
    src: string,
    notePath: string | null,
    contentHash: string,
    path: string
  ): Promise<string> =>
    invokeSandbox('sandbox:request-data', { kind, src, notePath, contentHash, path })
}

const interactiveApi = {
  create: (input: InteractiveCreatePayload): Promise<InteractiveCreateResult> =>
    invokeInteractive('interactive:create', input)
}

const aiApi = {
  getSettings: (): Promise<AiPublicSettings> => invokeAi<AiPublicSettings>('ai:get-settings'),
  saveSettings: (input: AiSaveSettingsInput): Promise<AiPublicSettings> =>
    invokeAi<AiPublicSettings>('ai:save-settings', input),
  clearApiKey: (): Promise<AiPublicSettings> => invokeAi<AiPublicSettings>('ai:clear-api-key'),
  chatStart: (input: AssistantChatStartInput): Promise<AssistantChatStartOutput> =>
    invokeAi<AssistantChatStartOutput>('ai:chat-start', input),
  chatCancel: (input: { sessionId: string }): Promise<{ ok: boolean; reason?: string }> =>
    invokeAi<{ ok: boolean; reason?: string }>('ai:chat-cancel', input),
  applyPatch: (input: {
    noteRelativePath: string
    operations: PatchOperation[]
  }): Promise<AssistantApplyPatchOutput> =>
    invokeAi<AssistantApplyPatchOutput>('ai:apply-patch', input),
  approvePatch: (input: {
    noteRelativePath: string
    operations: PatchOperation[]
  }): Promise<AssistantApprovePatchOutput> =>
    invokeAi<AssistantApprovePatchOutput>('ai:approve-patch', input),
  allowedPatchKinds: (): Promise<ReadonlyArray<PatchOperation['kind']>> =>
    invokeAi<ReadonlyArray<PatchOperation['kind']>>('ai:allowed-patch-kinds'),
  onEvent: (callback: (sessionId: string, event: AssistantEvent) => void): (() => void) => {
    const listener = (_event: unknown, payload: unknown): void => {
      if (!payload || typeof payload !== 'object') {
        return
      }
      const envelope = payload as { sessionId?: unknown; event?: unknown }
      if (typeof envelope.sessionId !== 'string' || !envelope.event) {
        return
      }
      callback(envelope.sessionId, envelope.event as AssistantEvent)
    }
    ipcRenderer.on('ai:event', listener)
    return () => {
      ipcRenderer.removeListener('ai:event', listener)
    }
  }
}

const exportApi = {
  scan: (noteRelativePath: string): Promise<ExportScanResult> =>
    invokeExport<ExportScanResult>('export:scan', { noteRelativePath }),
  pickTarget: (input: {
    noteRelativePath: string
    mode: ExportMode
    defaultFileName: string
  }): Promise<ExportPickTargetResult | null> =>
    invokeExport<ExportPickTargetResult | null>('export:pick-target', input),
  run: (input: ExportRunPayload): Promise<ExportRunResult> =>
    invokeExport<ExportRunResult>('export:run', input),
  onProgress: (callback: (event: ExportProgressEvent) => void): (() => void) => {
    const listener = (_event: unknown, payload: unknown): void => {
      if (!payload || typeof payload !== 'object') {
        return
      }
      callback(payload as ExportProgressEvent)
    }
    ipcRenderer.on('export:progress', listener)
    return () => {
      ipcRenderer.removeListener('export:progress', listener)
    }
  }
}

const appApi = {
  getSettings: (): Promise<AppSettingsSnapshot> =>
    invokeAppSettings<AppSettingsSnapshot>('app-settings:get'),
  updateSettings: (patch: AppSettingsPatch): Promise<AppSettingsSnapshot> =>
    invokeAppSettings<AppSettingsSnapshot>('app-settings:update', patch),
  getTheme: (): Promise<AppTheme> => invokeAppSettings<AppTheme>('app:get-theme'),
  setTheme: (theme: AppTheme): Promise<AppTheme> =>
    invokeAppSettings<AppTheme>('app:set-theme', theme),
  getFileTreeSort: (): Promise<FileTreeSortSetting> =>
    invokeAppSettings<FileTreeSortSetting>('app:get-file-tree-sort'),
  setFileTreeSort: (sort: FileTreeSortSetting): Promise<FileTreeSortSetting> =>
    invokeAppSettings<FileTreeSortSetting>('app:set-file-tree-sort', sort),
  getEditorFontSize: (): Promise<number> => invokeAppSettings<number>('app:get-editor-font-size'),
  setEditorFontSize: (fontSize: number): Promise<number> =>
    invokeAppSettings<number>('app:set-editor-font-size', fontSize)
}

const windowApi = {
  platform: readWindowPlatform(),
  minimize: (): Promise<void> => invokeWindow<void>('window:minimize'),
  toggleMaximize: (): Promise<boolean> => invokeWindow<boolean>('window:toggle-maximize'),
  close: (): Promise<void> => invokeWindow<void>('window:close'),
  isMaximized: (): Promise<boolean> => invokeWindow<boolean>('window:is-maximized'),
  onMaximizeChange: (callback: (isMaximized: boolean) => void): (() => void) => {
    const listener = (_event: unknown, payload: unknown): void => {
      if (typeof payload === 'boolean') {
        callback(payload)
      }
    }
    ipcRenderer.on('window:maximize-state-changed', listener)
    return () => {
      ipcRenderer.removeListener('window:maximize-state-changed', listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('vaultApi', vaultApi)
    contextBridge.exposeInMainWorld('indexApi', indexApi)
    contextBridge.exposeInMainWorld('knowledgeApi', knowledgeApi)
    contextBridge.exposeInMainWorld('bookmarkApi', bookmarkApi)
    contextBridge.exposeInMainWorld('graphApi', graphApi)
    contextBridge.exposeInMainWorld('sandboxApi', sandboxApi)
    contextBridge.exposeInMainWorld('interactiveApi', interactiveApi)
    contextBridge.exposeInMainWorld('aiApi', aiApi)
    contextBridge.exposeInMainWorld('exportApi', exportApi)
    contextBridge.exposeInMainWorld('appApi', appApi)
    contextBridge.exposeInMainWorld('windowApi', windowApi)
  } catch (error) {
    console.error(error)
  }
} else {
  throw new Error('contextIsolation must be enabled')
}

async function invokeVault<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeIndex<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeKnowledge<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeBookmarks<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeGraph<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeSandbox<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeInteractive<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeAi<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeExport<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeAppSettings<T>(channel: string, payload?: unknown): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, payload)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

async function invokeWindow<T>(channel: string): Promise<T> {
  const result = (await ipcRenderer.invoke(channel)) as IpcResult<T>

  if (!result.ok) {
    throw new VaultApiError(result.error.code, result.error.message)
  }

  return result.data
}

function readWindowPlatform(): 'darwin' | 'win32' | 'linux' | 'other' {
  if (
    process.platform === 'darwin' ||
    process.platform === 'win32' ||
    process.platform === 'linux'
  ) {
    return process.platform
  }
  return 'other'
}
