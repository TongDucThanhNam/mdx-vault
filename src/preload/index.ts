import { contextBridge, ipcRenderer } from 'electron'
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
  listFiles: (): Promise<VaultFile[]> => invokeVault('vault:list-files'),
  readFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:read-file', { relativePath }),
  readAssetFile: (relativePath: string): Promise<string> =>
    invokeVault('vault:read-asset-file', { relativePath }),
  writeFile: (relativePath: string, content: string): Promise<void> =>
    invokeVault('vault:write-file', { relativePath, content })
}

const indexApi = {
  search: (query: string, limit?: number): Promise<SearchResult[]> =>
    invokeIndex('index:search', { query, limit }),
  backlinks: (relativePath: string): Promise<BacklinkResult[]> =>
    invokeIndex('index:backlinks', { relativePath }),
  notes: (): Promise<IndexedNoteSummary[]> => invokeIndex('index:notes'),
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

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('vaultApi', vaultApi)
    contextBridge.exposeInMainWorld('indexApi', indexApi)
    contextBridge.exposeInMainWorld('sandboxApi', sandboxApi)
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
