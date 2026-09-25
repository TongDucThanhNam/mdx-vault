import { BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import { z } from 'zod'

import type { IpcFailure, IpcResult } from './vault-ipc'

const emptyPayloadSchema = z.undefined()
const maximizeStateChangedChannel = 'window:maximize-state-changed'

export function registerWindowIpc(): void {
  ipcMain.handle('window:minimize', (event, payload): Promise<IpcResult<void>> => {
    return handleWindowRequest(event, payload, (window) => {
      window.minimize()
    })
  })

  ipcMain.handle('window:toggle-maximize', (event, payload): Promise<IpcResult<boolean>> => {
    return handleWindowRequest(event, payload, (window) => {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
      return window.isMaximized()
    })
  })

  ipcMain.handle('window:close', (event, payload): Promise<IpcResult<void>> => {
    return handleWindowRequest(event, payload, (window) => {
      setImmediate(() => {
        if (!window.isDestroyed()) {
          window.close()
        }
      })
    })
  })

  ipcMain.handle('window:is-maximized', (event, payload): Promise<IpcResult<boolean>> => {
    return handleWindowRequest(event, payload, (window) => window.isMaximized())
  })
}

export function registerWindowStateEvents(window: BrowserWindow): void {
  const publishMaximizeState = (): void => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send(maximizeStateChangedChannel, window.isMaximized())
    }
  }

  window.on('maximize', publishMaximizeState)
  window.on('unmaximize', publishMaximizeState)
}

async function handleWindowRequest<T>(
  event: IpcMainInvokeEvent,
  payload: unknown,
  operation: (window: BrowserWindow) => T
): Promise<IpcResult<T>> {
  try {
    emptyPayloadSchema.parse(payload)
    assertMainFrame(event)
    const window = BrowserWindow.fromWebContents(event.sender)

    if (!window || window.isDestroyed()) {
      throw new Error('Window is unavailable')
    }

    return {
      ok: true,
      data: operation(window)
    }
  } catch (error) {
    return {
      ok: false,
      error: toWindowIpcError(error)
    }
  }
}

function assertMainFrame(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Window IPC is only available to the main renderer frame')
  }
}

function toWindowIpcError(error: unknown): IpcFailure['error'] {
  if (error instanceof z.ZodError) {
    return {
      code: 'VALIDATION_FAILED',
      message: error.issues.map((issue) => issue.message).join('; ')
    }
  }

  if (error instanceof Error) {
    return {
      code: 'WINDOW_ERROR',
      message: error.message
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown window error'
  }
}
