import { type IpcMainInvokeEvent, ipcMain } from 'electron'
import { z } from 'zod'

import type { BookmarkManifest } from '../../shared/bookmarks'
import { bookmarkManifestSchema } from '../services/bookmark-service'
import { getCurrentBookmarks } from '../services/vault-session'
import type { IpcFailure, IpcResult } from './vault-ipc'

const savePayloadSchema = z.object({
  manifest: bookmarkManifestSchema,
  expectedRevision: z.number().int().nonnegative()
})

export function registerBookmarkIpc(): void {
  ipcMain.handle(
    'bookmarks:get',
    (event, payload): Promise<IpcResult<BookmarkManifest>> =>
      handleBookmarkRequest(event, async () => {
        z.undefined().parse(payload)
        return bookmarkManifestSchema.parse(await getCurrentBookmarks().load()) as BookmarkManifest
      })
  )

  ipcMain.handle(
    'bookmarks:save',
    (event, payload): Promise<IpcResult<BookmarkManifest>> =>
      handleBookmarkRequest(event, async () => {
        const input = savePayloadSchema.parse(payload)
        return getCurrentBookmarks().save(
          input.manifest as BookmarkManifest,
          input.expectedRevision
        )
      })
  )
}

async function handleBookmarkRequest<T>(
  event: IpcMainInvokeEvent,
  operation: () => Promise<T>
): Promise<IpcResult<T>> {
  try {
    assertMainFrame(event)
    return { ok: true, data: await operation() }
  } catch (error) {
    return { ok: false, error: toIpcError(error) }
  }
}

function assertMainFrame(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Bookmarks are only available to the main application frame')
  }
}

function toIpcError(error: unknown): IpcFailure['error'] {
  if (error instanceof z.ZodError) {
    return { code: 'VALIDATION_ERROR', message: 'Invalid bookmark request' }
  }
  return {
    code: 'BOOKMARK_ERROR',
    message: error instanceof Error ? error.message : 'Bookmark operation failed'
  }
}
