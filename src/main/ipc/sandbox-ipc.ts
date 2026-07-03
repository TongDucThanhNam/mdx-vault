import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'

import {
  sandboxDescribePayloadSchema,
  sandboxLoadPayloadSchema,
  sandboxRequestDataPayloadSchema,
  sandboxSetPermissionPayloadSchema,
  type SandboxDescriptor,
  type SandboxDocument
} from '../../shared/sandbox'
import { SandboxService } from '../services/sandbox-service'
import { getCurrentVault } from '../services/vault-session'
import type { IpcFailure, IpcResult } from './vault-ipc'

export function registerSandboxIpc(): void {
  ipcMain.handle(
    'sandbox:describe-html',
    (event, payload): Promise<IpcResult<SandboxDescriptor>> => {
      return handleSandboxRequest(event, async () => {
        const input = sandboxDescribePayloadSchema.parse(payload)
        return getSandboxService().describeHtml(input.src, input.notePath)
      })
    }
  )

  ipcMain.handle('sandbox:load-html', (event, payload): Promise<IpcResult<SandboxDocument>> => {
    return handleSandboxRequest(event, async () => {
      const input = sandboxLoadPayloadSchema.parse(payload)
      return getSandboxService().loadHtml(
        input.src,
        input.notePath,
        input.contentHash,
        input.instanceId
      )
    })
  })

  ipcMain.handle(
    'sandbox:describe-interactive',
    (event, payload): Promise<IpcResult<SandboxDescriptor>> => {
      return handleSandboxRequest(event, async () => {
        const input = sandboxDescribePayloadSchema.parse(payload)
        return getSandboxService().describeInteractive(input.src, input.notePath)
      })
    }
  )

  ipcMain.handle(
    'sandbox:load-interactive',
    (event, payload): Promise<IpcResult<SandboxDocument>> => {
      return handleSandboxRequest(event, async () => {
        const input = sandboxLoadPayloadSchema.parse(payload)
        return getSandboxService().loadInteractive(
          input.src,
          input.notePath,
          input.contentHash,
          input.instanceId,
          input.props
        )
      })
    }
  )

  ipcMain.handle(
    'sandbox:set-permission',
    (event, payload): Promise<IpcResult<SandboxDescriptor>> => {
      return handleSandboxRequest(event, async () => {
        const input = sandboxSetPermissionPayloadSchema.parse(payload)
        return getSandboxService().setPermission(input)
      })
    }
  )

  ipcMain.handle('sandbox:request-data', (event, payload): Promise<IpcResult<string>> => {
    return handleSandboxRequest(event, async () => {
      const input = sandboxRequestDataPayloadSchema.parse(payload)
      return getSandboxService().requestData(input)
    })
  })
}

async function handleSandboxRequest<T>(
  event: IpcMainInvokeEvent,
  operation: () => Promise<T>
): Promise<IpcResult<T>> {
  try {
    assertMainFrame(event)

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

function assertMainFrame(event: IpcMainInvokeEvent): void {
  if (event.senderFrame && event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Sandbox IPC is only available to the main renderer frame')
  }
}

function getSandboxService(): SandboxService {
  return new SandboxService(getCurrentVault())
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
      code: 'SANDBOX_ERROR',
      message: error.message
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown sandbox error'
  }
}
