import {
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent,
  ipcMain,
  type SaveDialogOptions,
  type SaveDialogReturnValue
} from 'electron'
import { z } from 'zod'

import {
  type ExportMode,
  type ExportPickTargetResult,
  type ExportProgressEvent,
  type ExportRunPayload,
  type ExportRunResult,
  type ExportScanResult,
  exportPickTargetPayloadSchema,
  exportRunPayloadSchema,
  exportScanResultSchema
} from '../../shared/export'
import { SandboxExportBridge } from '../services/export-sandbox-bridge'
import { ExportError, ExportService } from '../services/export-service'
import { getCurrentSandboxService } from '../services/sandbox-session'
import { getCurrentVault } from '../services/vault-session'
import type { IpcFailure, IpcResult } from './vault-ipc'

const EXPORT_SCAN_PAYLOAD_SCHEMA = z.object({ noteRelativePath: z.string().min(1) }).strict()
const EXPORT_SCAN_RESULT_SCHEMA = exportScanResultSchema

export function registerExportIpc(): void {
  ipcMain.handle('export:scan', (event, payload): Promise<IpcResult<ExportScanResult>> => {
    return handleExportRequest(event, async () => {
      const input = EXPORT_SCAN_PAYLOAD_SCHEMA.parse(payload)
      const service = getExportService()
      const result = await service.scan(input.noteRelativePath)
      return EXPORT_SCAN_RESULT_SCHEMA.parse(result)
    })
  })

  ipcMain.handle(
    'export:pick-target',
    (event, payload): Promise<IpcResult<ExportPickTargetResult | null>> => {
      return handleExportRequest(event, async () => {
        const input = exportPickTargetPayloadSchema.parse(payload)
        const window = BrowserWindow.fromWebContents(event.sender)
        return showSaveDialog(window, input.mode, input.defaultFileName)
      })
    }
  )

  ipcMain.handle('export:run', (event, payload): Promise<IpcResult<ExportRunResult>> => {
    return handleExportRequest(event, async () => {
      const input = exportRunPayloadSchema.parse(payload)
      const service = getExportService()
      return runWithProgress(event, input, service)
    })
  })
}

async function runWithProgress(
  event: Parameters<Parameters<typeof ipcMain.handle>[1]>[0],
  payload: ExportRunPayload,
  service: ExportService
): Promise<ExportRunResult> {
  const emit = (progress: ExportProgressEvent): void => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('export:progress', progress)
    }
  }

  return service.run(payload, emit)
}

function getExportService(): ExportService {
  return new ExportService(getCurrentVault(), new SandboxExportBridge(getCurrentSandboxService()))
}

async function showSaveDialog(
  window: BrowserWindow | null,
  mode: ExportMode,
  defaultFileName: string
): Promise<ExportPickTargetResult | null> {
  const options = {
    title: mode === 'static' ? 'Export as Static HTML' : 'Export as Interactive HTML',
    defaultPath: defaultFileName,
    filters: [{ name: 'HTML', extensions: ['html', 'htm'] }]
  } satisfies SaveDialogOptions

  let result: SaveDialogReturnValue

  if (window) {
    result = await dialog.showSaveDialog(window, options)
  } else {
    result = await dialog.showSaveDialog(options)
  }

  if (result.canceled || !result.filePath) {
    return null
  }

  return { absolutePath: result.filePath }
}

async function handleExportRequest<T>(
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
    throw new ExportIpcError(
      'MAIN_FRAME_REQUIRED',
      'Export is only available to the main renderer frame'
    )
  }
}

class ExportIpcError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'ExportIpcError'
  }
}

function toIpcError(error: unknown): IpcFailure['error'] {
  if (error instanceof ExportIpcError) {
    return { code: error.code, message: error.message }
  }
  if (error instanceof z.ZodError) {
    return {
      code: 'VALIDATION_FAILED',
      message: error.issues.map((issue) => issue.message).join('; ')
    }
  }

  if (error instanceof ExportError) {
    return {
      code: error.code,
      message: error.message
    }
  }

  if (error instanceof Error) {
    return {
      code: 'EXPORT_ERROR',
      message: 'Export could not be completed safely.'
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown export error'
  }
}
