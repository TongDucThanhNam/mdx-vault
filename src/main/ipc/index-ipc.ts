import { ipcMain } from 'electron'
import { z } from 'zod'

import { getCurrentIndex } from '../services/vault-session'
import type { BacklinkResult, IndexedNoteSummary, SearchResult } from '../services/db-service'
import type { IpcFailure, IpcResult } from './vault-ipc'

interface RegisterIndexIpcOptions {
  onIndexChanged?: () => void
}

const emptyPayloadSchema = z.undefined()
const searchPayloadSchema = z.object({
  query: z.string(),
  limit: z.number().int().min(1).max(100).optional()
})
const backlinksPayloadSchema = z.object({
  relativePath: z.string().min(1)
})

export function registerIndexIpc(options: RegisterIndexIpcOptions = {}): void {
  ipcMain.handle('index:search', (_event, payload): Promise<IpcResult<SearchResult[]>> => {
    return handleIndexRequest(async () => {
      const input = searchPayloadSchema.parse(payload)
      return getCurrentIndex().database.search(input.query, input.limit ?? 30)
    })
  })

  ipcMain.handle('index:backlinks', (_event, payload): Promise<IpcResult<BacklinkResult[]>> => {
    return handleIndexRequest(async () => {
      const input = backlinksPayloadSchema.parse(payload)
      return getCurrentIndex().database.getBacklinks(input.relativePath)
    })
  })

  ipcMain.handle('index:notes', (_event, payload): Promise<IpcResult<IndexedNoteSummary[]>> => {
    return handleIndexRequest(async () => {
      emptyPayloadSchema.parse(payload)
      return getCurrentIndex().database.listNotes()
    })
  })

  ipcMain.handle('index:rebuild', (_event, payload): Promise<IpcResult<void>> => {
    return handleIndexRequest(async () => {
      emptyPayloadSchema.parse(payload)
      await getCurrentIndex().rebuild()
      options.onIndexChanged?.()
    })
  })
}

async function handleIndexRequest<T>(operation: () => Promise<T>): Promise<IpcResult<T>> {
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
      code: 'INDEX_ERROR',
      message: error.message
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown index error'
  }
}
