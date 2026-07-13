import { contextBridge, ipcRenderer } from 'electron'
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
import type {
  ExportMode,
  ExportPickTargetResult,
  ExportProgressEvent,
  ExportRunPayload,
  ExportRunResult,
  ExportScanResult
} from '../shared/export'
import type { RenamePlanPreview, RenameResult } from '../shared/rename'
import type {
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
  readFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:read-file', { relativePath }),
  readAssetFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:read-asset-file', { relativePath }),
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
  getTheme: (): Promise<'light' | 'dark' | 'system'> =>
    ipcRenderer.invoke('app:get-theme') as Promise<'light' | 'dark' | 'system'>,
  setTheme: (theme: 'light' | 'dark' | 'system'): Promise<'light' | 'dark' | 'system'> =>
    ipcRenderer.invoke('app:set-theme', theme) as Promise<'light' | 'dark' | 'system'>,
  getFileTreeSort: (): Promise<'name' | 'modified-desc' | 'created-desc'> =>
    ipcRenderer.invoke('app:get-file-tree-sort') as Promise<
      'name' | 'modified-desc' | 'created-desc'
    >,
  setFileTreeSort: (
    sort: 'name' | 'modified-desc' | 'created-desc'
  ): Promise<'name' | 'modified-desc' | 'created-desc'> =>
    ipcRenderer.invoke('app:set-file-tree-sort', sort) as Promise<
      'name' | 'modified-desc' | 'created-desc'
    >
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('vaultApi', vaultApi)
    contextBridge.exposeInMainWorld('indexApi', indexApi)
    contextBridge.exposeInMainWorld('sandboxApi', sandboxApi)
    contextBridge.exposeInMainWorld('aiApi', aiApi)
    contextBridge.exposeInMainWorld('exportApi', exportApi)
    contextBridge.exposeInMainWorld('appApi', appApi)
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

async function invokeSandbox<T>(channel: string, payload?: unknown): Promise<T> {
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
