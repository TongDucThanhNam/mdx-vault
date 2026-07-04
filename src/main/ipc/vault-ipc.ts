import {
  BrowserWindow,
  dialog,
  ipcMain,
  type OpenDialogOptions,
  type OpenDialogReturnValue
} from 'electron'
import { z } from 'zod'

import type { VaultInfo, VaultFile } from '../services/vault-service'
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
