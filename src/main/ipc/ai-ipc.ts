import { BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron'
import { z } from 'zod'

import {
  AI_ERROR_CODES,
  type AiPublicSettings,
  type AssistantApplyPatchOutput,
  type AssistantChatStartOutput,
  type AssistantEvent,
  aiSaveSettingsInputSchema,
  assistantApplyPatchInputSchema,
  assistantApprovePatchInputSchema,
  assistantChatCancelInputSchema,
  assistantChatStartInputSchema,
  type PatchOperation,
  patchOperationSchema
} from '../../shared/ai'
import { applyAllOperations } from '../services/ai-patch-engine'
import { AiSettingsService } from '../services/ai-settings'
import { getCurrentIndex, getCurrentVault } from '../services/vault-session'
import type { IpcFailure, IpcResult } from './vault-ipc'

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
  ipcMain.handle('ai:get-settings', (event, payload): Promise<IpcResult<AiPublicSettings>> => {
    return handleAiRequest(async () => {
      assertMainFrame(event)
      getSettingsPayloadSchema.parse(payload)
      const service = new AiSettingsService(getCurrentVault())
      return service.get()
    })
  })

  ipcMain.handle('ai:save-settings', (event, payload): Promise<IpcResult<AiPublicSettings>> => {
    return handleAiRequest(async () => {
      assertMainFrame(event)
      const input = aiSaveSettingsInputSchema.parse(payload)
      const service = new AiSettingsService(getCurrentVault())
      return service.save(input)
    })
  })

  ipcMain.handle('ai:clear-api-key', (event, payload): Promise<IpcResult<AiPublicSettings>> => {
    return handleAiRequest(async () => {
      assertMainFrame(event)
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
        const { findAction, startChat } = await import('../services/ai-tanstack-adapter')
        const action = findAction(input.actionId)
        if (!action) {
          throw new Error(`Unknown action: ${input.actionId}`)
        }
        const sessionId = pushChatStream(input.context, action, input.userMessage, startChat)
        return { sessionId }
      })
    }
  )

  ipcMain.handle(
    'ai:chat-cancel',
    (event, payload): Promise<IpcResult<{ ok: boolean; reason?: string }>> => {
      return handleAiRequest(async () => {
        assertMainFrame(event)
        const input = assistantChatCancelInputSchema.parse(payload)
        const { cancelChat } = await import('../services/ai-tanstack-adapter')
        return cancelChat(input.sessionId)
      })
    }
  )

  ipcMain.handle(
    'ai:apply-patch',
    (event, payload): Promise<IpcResult<AssistantApplyPatchOutput>> => {
      return handleAiRequest(async () => {
        assertMainFrame(event)
        const input = assistantApplyPatchInputSchema.parse(payload)
        return validateAndApply(input.noteRelativePath, input.operations)
      })
    }
  )

  ipcMain.handle(
    'ai:approve-patch',
    (event, payload): Promise<IpcResult<{ writtenPaths: string[] }>> => {
      return handleAiRequest(async () => {
        assertMainFrame(event)
        const input = assistantApprovePatchInputSchema.parse(payload)
        if (!indexedNoteExists(input.noteRelativePath)) {
          throw new Error(
            `Cannot approve patches: note "${input.noteRelativePath}" is not indexed.`
          )
        }
        const { approveAiPatch } = await import('../services/ai-approval-service')
        return approveAiPatch(getCurrentVault(), input.noteRelativePath, input.operations)
      })
    }
  )

  ipcMain.handle(
    'ai:allowed-patch-kinds',
    (event): Promise<IpcResult<ReadonlyArray<PatchOperation['kind']>>> => {
      return handleAiRequest(async () => {
        assertMainFrame(event)
        return ['textPatch', 'interactiveInsert', 'componentDraft'] as const
      })
    }
  )
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function pushChatStream(
  context: import('../../shared/ai').AssistantContext,
  action: import('../services/ai-system-prompt').ActionDescriptor,
  userMessage: string,
  startChat: typeof import('../services/ai-tanstack-adapter').startChat
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

function indexedNoteExists(relativePath: string): boolean {
  try {
    return getCurrentIndex()
      .database.listNotes()
      .some((note) => note.relativePath === relativePath)
  } catch {
    return false
  }
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

  if (finalApplied.text !== currentContent) {
    results.push({ kind: 'textPatch', resultText: finalApplied.text })
  }
  if (finalApplied.files.length > 0) {
    results.push({ kind: 'componentDraft', files: finalApplied.files })
  }
  if (results.length === 0) throw new Error('Patch proposal produced no changes')

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
