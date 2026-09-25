import { type IpcMainInvokeEvent, ipcMain } from 'electron'
import { z } from 'zod'

import {
  type SandboxAuthoringProofResult,
  type SandboxDescriptor,
  type SandboxDocument,
  sandboxAuthoringProofLoadPayloadSchema,
  sandboxDescribePayloadSchema,
  sandboxLoadPayloadSchema,
  sandboxRequestDataPayloadSchema,
  sandboxSetPermissionPayloadSchema
} from '../../shared/sandbox'
import { InteractiveCompileError, SandboxService } from '../services/sandbox-service'
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

  ipcMain.handle(
    'sandbox:load-authoring-proof',
    (event, payload): Promise<IpcResult<SandboxAuthoringProofResult>> => {
      return handleSandboxRequest(event, async () => {
        const input = sandboxAuthoringProofLoadPayloadSchema.parse(payload)
        try {
          const document = await getSandboxService().loadAuthoringProof(
            input.projectRoot,
            input.instanceId,
            input.props
          )
          return { status: 'ready', document: await createFrameDocument(document) }
        } catch (error) {
          if (error instanceof InteractiveCompileError) {
            return { status: 'issues', diagnostics: error.diagnostics }
          }
          return {
            status: 'issues',
            diagnostics: [
              {
                source: getAuthoringIssueSource(error),
                severity: 'error',
                code: 'PROOF_LOAD_FAILED',
                message: getSafeAuthoringIssueMessage(error),
                relativePath: null,
                from: null,
                to: null,
                line: null,
                column: null
              }
            ]
          }
        }
      })
    }
  )

  ipcMain.handle('sandbox:load-html', (event, payload): Promise<IpcResult<SandboxDocument>> => {
    return handleSandboxRequest(event, async () => {
      const input = sandboxLoadPayloadSchema.parse(payload)
      const document = await getSandboxService().loadHtml(
        input.src,
        input.notePath,
        input.contentHash,
        input.instanceId
      )
      return await createFrameDocument(document)
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
        const document = await getSandboxService().loadInteractive(
          input.src,
          input.notePath,
          input.contentHash,
          input.instanceId,
          input.props
        )
        return await createFrameDocument(document)
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

async function createFrameDocument(
  document: Awaited<ReturnType<SandboxService['loadHtml']>>
): Promise<SandboxDocument> {
  const { srcDoc, ...metadata } = document
  const { publishSandboxDocument } = await import('../services/sandbox-document-protocol')
  return {
    ...metadata,
    documentUrl: publishSandboxDocument(srcDoc)
  }
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
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
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
    if (error.message.includes('main renderer frame')) {
      return {
        code: 'MAIN_FRAME_REQUIRED',
        message: error.message
      }
    }
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

function getAuthoringIssueSource(error: unknown): 'manifest' | 'props' | 'project' {
  const message = error instanceof Error ? error.message : ''
  return message.includes('manifest') ? 'manifest' : message.includes('prop') ? 'props' : 'project'
}

function getSafeAuthoringIssueMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Authoring proof could not be prepared'
  return /^[\w\s"'().,:;/-]{1,2048}$/.test(message)
    ? message
    : 'Authoring proof could not be prepared'
}
