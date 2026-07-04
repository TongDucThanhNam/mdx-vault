import {
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type OpenDialogOptions,
  type OpenDialogReturnValue
} from 'electron'
import { z } from 'zod'

import type { TrashEntry, VaultInfo, VaultFile } from '../services/vault-service'
import { getCurrentIndex, getCurrentVault, openCurrentVault } from '../services/vault-session'
import type { AppSettingsService } from '../services/app-settings'

export interface IpcSuccess<T> {
  ok: true
  data: T
}

export interface IpcFailure {
  ok: false
  error: {
    code: string
    message: string
  }
}

export type IpcResult<T> = IpcSuccess<T> | IpcFailure

type OpenVaultResult = VaultInfo | null

interface RegisterVaultIpcOptions {
  onIndexChanged?: () => void
  appSettings?: AppSettingsService
}

const emptyPayloadSchema = z.undefined()
const openVaultPathPayloadSchema = z.object({
  path: z.string().min(1)
})
const readFilePayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const readAssetFilePayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const writeFilePayloadSchema = z.object({
  relativePath: z.string().min(1),
  content: z.string()
})
const createFilePayloadSchema = z.object({
  relativePath: z.string().min(1),
  content: z.string()
})
const deleteFilePayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const renameFilePayloadSchema = z.object({
  fromRelativePath: z.string().min(1),
  toRelativePath: z.string().min(1)
})
const duplicateFilePayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const revealInExplorerPayloadSchema = z.object({
  relativePath: z.string().min(1)
})

export function registerVaultIpc(options: RegisterVaultIpcOptions = {}): void {
  ipcMain.handle('vault:open', (event, payload): Promise<IpcResult<OpenVaultResult>> => {
    return handleVaultRequest(async () => {
      emptyPayloadSchema.parse(payload)

      const window = BrowserWindow.fromWebContents(event.sender)
      const result = await showOpenVaultDialog(window)

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      const vaultPath = result.filePaths[0]
      const vault = await openCurrentVault(vaultPath, options.onIndexChanged)
      await options.appSettings?.setLastVaultPath(vaultPath)
      return vault.getInfo()
    })
  })

  ipcMain.handle('vault:open-path', (_event, payload): Promise<IpcResult<OpenVaultResult>> => {
    return handleVaultRequest(async () => {
      const input = openVaultPathPayloadSchema.parse(payload)
      const vault = await openCurrentVault(input.path, options.onIndexChanged)
      await options.appSettings?.setLastVaultPath(input.path)
      return vault.getInfo()
    })
  })

  ipcMain.handle('vault:last-open', (): Promise<IpcResult<string | null>> => {
    return handleVaultRequest(async () => {
      return options.appSettings ? await options.appSettings.getLastVaultPath() : null
    })
  })

  ipcMain.handle('vault:list-files', (_event, payload): Promise<IpcResult<VaultFile[]>> => {
    return handleVaultRequest(async () => {
      emptyPayloadSchema.parse(payload)
      return getCurrentVault().listFiles()
    })
  })

  ipcMain.handle('vault:read-file', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = readFilePayloadSchema.parse(payload)
      return getCurrentVault().readFile(input.relativePath)
    })
  })

  ipcMain.handle('vault:read-asset-file', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = readAssetFilePayloadSchema.parse(payload)
      return getCurrentVault().readAssetFile(input.relativePath)
    })
  })

  ipcMain.handle('vault:write-file', (_event, payload): Promise<IpcResult<void>> => {
    return handleVaultRequest(async () => {
      const input = writeFilePayloadSchema.parse(payload)
      await getCurrentVault().writeFile(input.relativePath, input.content)
      await getCurrentIndex().indexFile(input.relativePath)
    })
  })

  ipcMain.handle('vault:create-file', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = createFilePayloadSchema.parse(payload)
      const createdPath = await getCurrentVault().createFile(input.relativePath, input.content)
      await getCurrentIndex().indexFile(createdPath)
      return createdPath
    })
  })

  /**
   * Soft-delete: move the note into `<vault>/.trash/` and unindex it. The
   * file remains on disk and is recoverable via the OS file manager. The
   * chokidar watcher will also fire `unlink` for the source path — both this
   * explicit unindex and the watcher's are idempotent.
   */
  ipcMain.handle('vault:delete-file', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = deleteFilePayloadSchema.parse(payload)
      const vault = getCurrentVault()
      const index = getCurrentIndex()
      const trashPath = await vault.deleteFile(input.relativePath)
      index.deleteFile(input.relativePath)
      return trashPath
    })
  })

  /**
   * Atomic rename/move. The new path is reindexed; the old path is unindexed.
   * Both pass through safeJoin so traversal attempts are rejected before any
   * filesystem op happens.
   */
  ipcMain.handle('vault:rename-file', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = renameFilePayloadSchema.parse(payload)
      const vault = getCurrentVault()
      const index = getCurrentIndex()
      const newPath = await vault.renameFile(input.fromRelativePath, input.toRelativePath)
      index.deleteFile(input.fromRelativePath)
      await index.indexFile(newPath)
      return newPath
    })
  })

  /** Copy a note to `<stem> copy.mdx` (or `copy 2`, `copy 3`, …). */
  ipcMain.handle('vault:duplicate-file', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = duplicateFilePayloadSchema.parse(payload)
      const vault = getCurrentVault()
      const index = getCurrentIndex()
      const newPath = await vault.duplicateFile(input.relativePath)
      await index.indexFile(newPath)
      return newPath
    })
  })

  /** Permanently remove all entries from `<vault>/.trash/`. */
  ipcMain.handle('vault:empty-trash', (): Promise<IpcResult<void>> => {
    return handleVaultRequest(async () => {
      await getCurrentVault().emptyTrash()
    })
  })

  /** List entries currently sitting in `<vault>/.trash/`. */
  ipcMain.handle('vault:list-trash', (): Promise<IpcResult<TrashEntry[]>> => {
    return handleVaultRequest(async () => {
      return getCurrentVault().listTrash()
    })
  })

  /** Reveal a vault file in the OS file manager (Finder/Explorer). */
  ipcMain.handle('vault:reveal-in-explorer', (_event, payload): Promise<IpcResult<void>> => {
    return handleVaultRequest(async () => {
      const input = revealInExplorerPayloadSchema.parse(payload)
      const absolutePath = getCurrentVault().resolveAbsolutePath(input.relativePath)
      shell.showItemInFolder(absolutePath)
    })
  })

  /** Return the absolute path of a vault file (for "Copy path" actions). */
  ipcMain.handle('vault:resolve-absolute-path', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = revealInExplorerPayloadSchema.parse(payload)
      return getCurrentVault().resolveAbsolutePath(input.relativePath)
    })
  })
}

async function showOpenVaultDialog(window: BrowserWindow | null): Promise<OpenDialogReturnValue> {
  const options = {
    title: 'Open vault folder',
    properties: ['openDirectory']
  } satisfies OpenDialogOptions

  if (window) {
    return dialog.showOpenDialog(window, options)
  }

  return dialog.showOpenDialog(options)
}

async function handleVaultRequest<T>(operation: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return {
      ok: true,
      data: await operation()
    }
  } catch (error) {
    return {
      ok: false,
      error: toIpcError(error)
    }
  }
}

function toIpcError(error: unknown): IpcFailure['error'] {
  if (error instanceof z.ZodError) {
    return {
      code: 'VALIDATION_FAILED',
      message: error.issues.map((issue) => issue.message).join('; ')
    }
  }

  if (error instanceof Error) {
    return {
      code: 'VAULT_ERROR',
      message: error.message
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown vault error'
  }
}
