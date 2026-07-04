import { BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import { z } from 'zod'

import {
  AI_ERROR_CODES,
  aiSaveSettingsInputSchema,
  assistantApplyPatchInputSchema,
  assistantChatCancelInputSchema,
  assistantChatStartInputSchema,
  patchOperationSchema,
  type AiPublicSettings,
  type AssistantApplyPatchOutput,
  type AssistantChatStartOutput,
  type AssistantEvent,
  type PatchOperation
} from '../../shared/ai'
import { AiSettingsService } from '../services/ai-settings'
import {
  ALLOWED_PATCH_OPERATIONS,
  cancelChat,
  findAction,
  indexedNoteExists,
  startChat
} from '../services/ai-tanstack-adapter'
import { applyAllOperations } from '../services/ai-patch-engine'
import type { IpcFailure, IpcResult } from './vault-ipc'
import { getCurrentVault } from '../services/vault-session'

const AI_PUSH_CHANNEL = 'ai:event'

const aiEventEnvelopeSchema = z
  .object({
    sessionId: z.string().min(1),
    event: z.unknown()
  })
  .strict()

const getSettingsPayloadSchema = z.undefined()
const clearApiKeyPayloadSchema = z.undefined()

export function registerAiIpc(): void {
  ipcMain.handle('ai:get-settings', (_event, payload): Promise<IpcResult<AiPublicSettings>> => {
    return handleAiRequest(async () => {
      getSettingsPayloadSchema.parse(payload)
      const service = new AiSettingsService(getCurrentVault())
      return service.get()
    })
  })

  ipcMain.handle('ai:save-settings', (_event, payload): Promise<IpcResult<AiPublicSettings>> => {
    return handleAiRequest(async () => {
      const input = aiSaveSettingsInputSchema.parse(payload)
      const service = new AiSettingsService(getCurrentVault())
      return service.save(input)
    })
  })

  ipcMain.handle('ai:clear-api-key', (_event, payload): Promise<IpcResult<AiPublicSettings>> => {
    return handleAiRequest(async () => {
      clearApiKeyPayloadSchema.parse(payload)
      const service = new AiSettingsService(getCurrentVault())
      return service.clearApiKey()
    })
  })

  ipcMain.handle(
    'ai:chat-start',
    (event, payload): Promise<IpcResult<AssistantChatStartOutput>> => {
      return handleAiRequest(async () => {
        assertMainFrame(event)
        const input = assistantChatStartInputSchema.parse(payload)
        const action = findAction(input.actionId)
        if (!action) {
          throw new Error(`Unknown action: ${input.actionId}`)
        }
        const sessionId = pushChatStream(input.context, action, input.userMessage)
        return { sessionId }
      })
    }
  )

  ipcMain.handle(
    'ai:chat-cancel',
    (_event, payload): Promise<IpcResult<{ ok: boolean; reason?: string }>> => {
      return handleAiRequest(async () => {
        const input = assistantChatCancelInputSchema.parse(payload)
        return cancelChat(input.sessionId)
      })
    }
  )

  ipcMain.handle(
    'ai:apply-patch',
    (_event, payload): Promise<IpcResult<AssistantApplyPatchOutput>> => {
      return handleAiRequest(async () => {
        const input = assistantApplyPatchInputSchema.parse(payload)
        return validateAndApply(input.noteRelativePath, input.operations)
      })
    }
  )

  ipcMain.handle(
    'ai:allowed-patch-kinds',
    (): Promise<IpcResult<ReadonlyArray<PatchOperation['kind']>>> => {
      return handleAiRequest(async () => ALLOWED_PATCH_OPERATIONS)
    }
  )
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function pushChatStream(
  context: import('../../shared/ai').AssistantContext,
  action: import('../services/ai-system-prompt').ActionDescriptor,
  userMessage: string
): string {
  const result = startChat(
    (envelope) => {
      const parsed = aiEventEnvelopeSchema.safeParse(envelope)
      if (!parsed.success) {
        return
      }
      broadcastAssistantEvent(parsed.data.sessionId, parsed.data.event as AssistantEvent)
    },
    {
      context,
      action,
      userMessage
    }
  )

  return result.sessionId
}

function broadcastAssistantEvent(sessionId: string, event: AssistantEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(AI_PUSH_CHANNEL, { sessionId, event })
    }
  }
}

async function validateAndApply(
  noteRelativePath: string,
  operations: PatchOperation[]
): Promise<AssistantApplyPatchOutput> {
  const vault = getCurrentVault()

  if (!indexedNoteExists(noteRelativePath)) {
    throw new Error(`Cannot apply patches: note "${noteRelativePath}" is not in the index.`)
  }

  const currentContent = await vault.readFile(noteRelativePath)
  // Round-trip through the engine so any drift / structural issues are caught
  // here, in main, with a clear error code, instead of in the renderer.
  const finalApplied = applyAllOperations(currentContent, operations)

  const results: AssistantApplyPatchOutput['results'] = []

  if (finalApplied.kind === 'componentDraft') {
    results.push({ kind: 'componentDraft', files: finalApplied.files })
  } else {
    results.push({ kind: 'textPatch', resultText: finalApplied.text })
  }

  // For multi-op proposals that contain a draft *and* note edits we still
  // want both — extend to a richer output shape if the goal ever broadens.
  // Today we collapse to a single outcome per apply call.
  if (results.length !== 1) {
    throw new Error(
      `Validation produced ${results.length} results for ${operations.length} operations.`
    )
  }

  return { results }
}

function assertMainFrame(event: IpcMainInvokeEvent): void {
  if (event.senderFrame && event.senderFrame !== event.sender.mainFrame) {
    throw new Error('AI IPC is only available to the main renderer frame')
  }
}

async function handleAiRequest<T>(operation: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await operation() }
  } catch (error) {
    return { ok: false, error: toIpcError(error) }
  }
}

function toIpcError(error: unknown): IpcFailure['error'] {
  if (error instanceof z.ZodError) {
    return {
      code: AI_ERROR_CODES.VALIDATION_FAILED,
      message: error.issues
        .map((issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`)
        .join('; ')
    }
  }

  if (error instanceof Error) {
    return {
      code: 'AI_ERROR',
      message: error.message
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown AI error'
  }
}

/** Marker for grep-able review: this is the only file the renderer talks
 *  to for AI behaviour. Every other AI file is an implementation detail
 *  behind `AssistantRuntime`. */
export const AI_IPC_MARKER = 'mdx-vault-ai-ipc:v1'

export { patchOperationSchema }
