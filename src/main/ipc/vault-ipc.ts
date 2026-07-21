import {
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent,
  ipcMain,
  type OpenDialogOptions,
  type OpenDialogReturnValue,
  shell
} from 'electron'
import { z } from 'zod'

import type { RenamePlanPreview, RenameResult } from '../../shared/rename'
import type { AppSettingsService } from '../services/app-settings'
import { planVaultRename } from '../services/rename-service'
import type {
  NoteTemplate,
  TrashEntry,
  VaultFile,
  VaultInfo,
  VaultTreeFile
} from '../services/vault-service'
import { getCurrentIndex, getCurrentVault, openCurrentVault } from '../services/vault-session'

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
  onTreeChanged?: () => void
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
const readTextFilePayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const readImageFilePayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const probeFilePayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const writeFilePayloadSchema = z.object({
  relativePath: z.string().min(1),
  content: z.string()
})
const writeTextFilePayloadSchema = z.object({
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
  toRelativePath: z.string().min(1),
  updateLinks: z.boolean()
})
const planRenamePayloadSchema = z.object({
  fromRelativePath: z.string().min(1),
  toRelativePath: z.string().min(1)
})
const duplicateFilePayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const fileExistsPayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const renderTemplatePayloadSchema = z.object({
  relativePath: z.string().min(1),
  title: z.string().min(1)
})
const revealInExplorerPayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const saveAssetPayloadSchema = z.object({
  suggestedName: z.string().min(1),
  /** Base64-encoded image bytes (the renderer encodes from Blob.arrayBuffer). */
  base64: z.string().min(1)
})

export function registerVaultIpc(options: RegisterVaultIpcOptions = {}): void {
  registerVaultFileAccessIpc()

  ipcMain.handle('vault:open', (event, payload): Promise<IpcResult<OpenVaultResult>> => {
    return handleVaultRequest(async () => {
      emptyPayloadSchema.parse(payload)

      const window = BrowserWindow.fromWebContents(event.sender)
      const result = await showOpenVaultDialog(window)

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      const vaultPath = result.filePaths[0]
      const vault = await openCurrentVault(vaultPath, options.onIndexChanged, options.onTreeChanged)
      await options.appSettings?.setLastVaultPath(vaultPath)
      return vault.getInfo()
    })
  })

  ipcMain.handle('vault:open-path', (_event, payload): Promise<IpcResult<OpenVaultResult>> => {
    return handleVaultRequest(async () => {
      const input = openVaultPathPayloadSchema.parse(payload)
      const vault = await openCurrentVault(
        input.path,
        options.onIndexChanged,
        options.onTreeChanged
      )
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

  ipcMain.handle(
    'vault:list-tree-files',
    (_event, payload): Promise<IpcResult<VaultTreeFile[]>> => {
      return handleVaultRequest(async () => {
        emptyPayloadSchema.parse(payload)
        return getCurrentVault().listTreeFiles()
      })
    }
  )

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

  ipcMain.handle('vault:plan-rename', (_event, payload): Promise<IpcResult<RenamePlanPreview>> => {
    return handleVaultRequest(async () => {
      const input = planRenamePayloadSchema.parse(payload)
      const vault = getCurrentVault()
      const index = getCurrentIndex()
      const plan = await planVaultRename(vault, index, input.fromRelativePath, input.toRelativePath)

      return {
        oldRelativePath: plan.oldRelativePath,
        newRelativePath: plan.newRelativePath,
        affectedFiles: plan.files.map((file) => file.relativePath),
        linkCount: plan.linkCount,
        noteCount: plan.noteCount
      }
    })
  })

  /**
   * Transactional rename/move. When requested, incoming links are reparsed
   * immediately before apply; reindexing is part of the rollback boundary.
   */
  ipcMain.handle('vault:rename-file', (_event, payload): Promise<IpcResult<RenameResult>> => {
    return handleVaultRequest(async () => {
      const input = renameFilePayloadSchema.parse(payload)
      const vault = getCurrentVault()
      const index = getCurrentIndex()
      const plan = input.updateLinks
        ? await planVaultRename(vault, index, input.fromRelativePath, input.toRelativePath)
        : undefined

      return vault.renameFile(input.fromRelativePath, input.toRelativePath, {
        plan,
        onApplied: async (result) => {
          await index.reindexRename(
            input.fromRelativePath,
            result.newRelativePath,
            result.rewrittenFiles
          )
        },
        onRolledBack: async () => {
          await index.rebuild()
        }
      })
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

  ipcMain.handle('vault:file-exists', (_event, payload): Promise<IpcResult<boolean>> => {
    return handleVaultRequest(async () => {
      const input = fileExistsPayloadSchema.parse(payload)
      return getCurrentVault().exists(input.relativePath)
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

  ipcMain.handle('vault:list-templates', (_event, payload): Promise<IpcResult<NoteTemplate[]>> => {
    return handleVaultRequest(async () => {
      emptyPayloadSchema.parse(payload)
      return getCurrentVault().listTemplates()
    })
  })

  ipcMain.handle('vault:render-template', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = renderTemplatePayloadSchema.parse(payload)
      return getCurrentVault().renderTemplate(input.relativePath, input.title)
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

  /**
   * Persist a binary asset (image) under `<vault>/assets/`. The renderer
   * encodes the file bytes as base64 to avoid structuredClone overhead for
   * ArrayBuffer payloads through the context bridge. Returns the
   * vault-relative path so the editor can insert a markdown image reference.
   */
  ipcMain.handle('vault:save-asset', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = saveAssetPayloadSchema.parse(payload)
      const bytes = Buffer.from(input.base64, 'base64')
      return getCurrentVault().saveAsset(input.suggestedName, new Uint8Array(bytes))
    })
  })
}

export function registerVaultFileAccessIpc(
  getVault: typeof getCurrentVault = getCurrentVault
): void {
  ipcMain.handle('vault:read-text-file', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = readTextFilePayloadSchema.parse(payload)
      return getVault().readTextFile(input.relativePath)
    })
  })

  ipcMain.handle('vault:write-text-file', (_event, payload): Promise<IpcResult<void>> => {
    return handleVaultRequest(async () => {
      const input = writeTextFilePayloadSchema.parse(payload)
      await getVault().writeTextFile(input.relativePath, input.content)
    })
  })

  ipcMain.handle('vault:read-image-file', (_event, payload): Promise<IpcResult<string>> => {
    return handleVaultRequest(async () => {
      const input = readImageFilePayloadSchema.parse(payload)
      return getVault().readImageFile(input.relativePath)
    })
  })

  ipcMain.handle('vault:probe-file', (event, payload): Promise<IpcResult<void>> => {
    return handleVaultRequest(async () => {
      assertMainFrame(event)
      const input = probeFilePayloadSchema.parse(payload)
      await getVault().probeFile(input.relativePath)
    })
  })
}

function assertMainFrame(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Vault file access IPC is only available to the main renderer frame')
  }
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
