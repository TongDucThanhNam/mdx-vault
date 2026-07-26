import { type IpcMainInvokeEvent, ipcMain } from 'electron'
import { z } from 'zod'

import {
  type InteractiveCreateResult,
  interactiveCreatePayloadSchema,
  interactiveCreateResultSchema
} from '../../shared/interactive-authoring'
import {
  InteractiveAuthoringError,
  InteractiveAuthoringService
} from '../services/interactive-authoring-service'
import { getCurrentIndex, getCurrentVault } from '../services/vault-session'
import type { IpcFailure, IpcResult } from './vault-ipc'

type InteractiveCreateService = Pick<InteractiveAuthoringService, 'create'>

interface RegisterInteractiveAuthoringIpcOptions {
  createService?: () => InteractiveCreateService
  onTreeChanged?: () => void
}

export function registerInteractiveAuthoringIpc(
  options: RegisterInteractiveAuthoringIpcOptions = {}
): void {
  ipcMain.handle(
    'interactive:create',
    (event, payload): Promise<IpcResult<InteractiveCreateResult>> =>
      handleInteractiveRequest(event, payload, interactiveCreatePayloadSchema, async (input) => {
        const service = options.createService?.() ?? createDefaultService(options.onTreeChanged)
        const result = await service.create(input)
        return interactiveCreateResultSchema.parse(result)
      })
  )
}

function createDefaultService(onTreeChanged?: () => void): InteractiveAuthoringService {
  return new InteractiveAuthoringService(getCurrentVault(), {
    finalize: async (result) => {
      await getCurrentIndex().indexFile(result.noteRelativePath)
      onTreeChanged?.()
    }
  })
}

async function handleInteractiveRequest<TPayload, TResult>(
  event: IpcMainInvokeEvent,
  payload: unknown,
  schema: z.ZodType<TPayload>,
  operation: (payload: TPayload) => Promise<TResult>
): Promise<IpcResult<TResult>> {
  try {
    assertMainFrame(event)
    const input = schema.parse(payload)
    return {
      ok: true,
      data: await operation(input)
    }
  } catch (error) {
    return {
      ok: false,
      error: toInteractiveIpcError(error)
    }
  }
}

function assertMainFrame(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new InteractiveAuthoringError(
      'INVALID_REQUEST',
      'Interactive authoring IPC is only available to the main renderer frame'
    )
  }
}

function toInteractiveIpcError(error: unknown): IpcFailure['error'] {
  if (error instanceof z.ZodError) {
    return {
      code: 'VALIDATION_FAILED',
      message: error.issues.map((issue) => issue.message).join('; ')
    }
  }

  if (error instanceof InteractiveAuthoringError) {
    if (error.message.includes('main renderer frame')) {
      return {
        code: 'MAIN_FRAME_REQUIRED',
        message: error.message
      }
    }
    if (error.code === 'TRANSACTION_FAILED' || error.code === 'ROLLBACK_FAILED') {
      return {
        code: error.code,
        message: 'Interactive creation could not be committed safely'
      }
    }
    return {
      code: error.code,
      message: error.message
    }
  }

  return {
    code: 'INTERACTIVE_CREATE_FAILED',
    message: 'Interactive creation failed'
  }
}
