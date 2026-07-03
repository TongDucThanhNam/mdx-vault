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
}

const emptyPayloadSchema = z.undefined()
const readFilePayloadSchema = z.object({
  relativePath: z.string().min(1)
})
const writeFilePayloadSchema = z.object({
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

      const vault = await openCurrentVault(result.filePaths[0], options.onIndexChanged)
      return vault.getInfo()
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

  ipcMain.handle('vault:write-file', (_event, payload): Promise<IpcResult<void>> => {
    return handleVaultRequest(async () => {
      const input = writeFilePayloadSchema.parse(payload)
      await getCurrentVault().writeFile(input.relativePath, input.content)
      await getCurrentIndex().indexFile(input.relativePath)
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
