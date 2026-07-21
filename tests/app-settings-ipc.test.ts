import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { AppSettingsPatch, AppSettingsSnapshot } from '../src/main/services/app-settings'

type IpcResult = {
  ok: boolean
  data?: unknown
  error?: { code: string; message: string }
}

type IpcHandler = (event: unknown, payload: unknown) => Promise<IpcResult>

const ipcHandlers = new Map<string, IpcHandler>()

mock.module('electron', () => ({
  BrowserWindow: { fromWebContents: () => null },
  dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => {
      ipcHandlers.set(channel, handler)
    }
  },
  shell: { showItemInFolder: () => undefined }
}))

const { registerAppSettingsIpc } = await import('../src/main/ipc/app-settings-ipc')

beforeEach(() => {
  ipcHandlers.clear()
})

describe('app settings IPC', () => {
  test('returns persisted snapshots for valid get and update requests', async () => {
    let snapshot = createSnapshot()
    const service = {
      getSettings: async () => cloneSnapshot(snapshot),
      updateSettings: async (patch: AppSettingsPatch) => {
        snapshot = applyFakePatch(snapshot, patch)
        return cloneSnapshot(snapshot)
      }
    }
    registerAppSettingsIpc(service)

    const getResult = await requireHandler('app-settings:get')(mainFrameEvent(), undefined)
    expect(getResult.ok).toBe(true)
    expect((getResult.data as AppSettingsSnapshot).theme).toBe('system')
    expect('lastVaultPath' in (getResult.data as AppSettingsSnapshot)).toBe(false)
    expect(ipcHandlers.has('app-settings:get-path')).toBe(false)

    const updateResult = await requireHandler('app-settings:update')(mainFrameEvent(), {
      theme: 'dark',
      workbench: { activateOnClose: 'right' },
      keymapOverrides: { 'file.open': ['Mod+O'] }
    })

    expect(updateResult.ok).toBe(true)
    expect((updateResult.data as AppSettingsSnapshot).theme).toBe('dark')
    expect((updateResult.data as AppSettingsSnapshot).workbench.activateOnClose).toBe('right')
    expect((updateResult.data as AppSettingsSnapshot).keymapOverrides['file.open'][0]).toBe('Mod+O')
  })

  test('rejects malformed and oversized payloads before mutation', async () => {
    let mutationCount = 0
    const service = {
      getSettings: async () => createSnapshot(),
      updateSettings: async () => {
        mutationCount += 1
        return createSnapshot()
      }
    }
    registerAppSettingsIpc(service)
    const update = requireHandler('app-settings:update')

    for (const payload of [
      { editorFontSize: 100 },
      { workbench: { activateOnClose: 'newest' } },
      { keymapOverrides: { 'file.open': 'Mod+P' } },
      { theme: 'dark', unexpected: true },
      { apiKey: 'must-never-cross-this-boundary' },
      {
        keymapOverrides: Object.fromEntries(
          Array.from({ length: 129 }, (_, index) => [`action.${index}`, []])
        )
      }
    ]) {
      const result = await update(mainFrameEvent(), payload)
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_FAILED')
    }

    expect(mutationCount).toBe(0)
  })

  test('rejects missing and child-frame callers on every registered channel', async () => {
    const service = {
      getSettings: async () => createSnapshot(),
      updateSettings: async () => createSnapshot()
    }
    registerAppSettingsIpc(service)

    const payloads: Record<string, unknown> = {
      'app-settings:get': undefined,
      'app-settings:update': {},
      'app:get-theme': undefined,
      'app:set-theme': 'dark',
      'app:get-file-tree-sort': undefined,
      'app:set-file-tree-sort': 'name',
      'app:get-editor-font-size': undefined,
      'app:set-editor-font-size': 14
    }

    for (const [channel, payload] of Object.entries(payloads)) {
      for (const event of [{ sender: { mainFrame: {} } }, childFrameEvent()]) {
        const result = await requireHandler(channel)(event, payload)
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('MAIN_FRAME_REQUIRED')
      }
    }
  })

  test('surfaces persistence errors and does not manufacture an optimistic snapshot', async () => {
    const service = {
      getSettings: async () => createSnapshot(),
      updateSettings: async () => {
        throw new Error('EACCES: C:\\Users\\private\\app-settings.json')
      }
    }
    registerAppSettingsIpc(service)

    const result = await requireHandler('app-settings:update')(mainFrameEvent(), {
      theme: 'dark'
    })

    expect(result.ok).toBe(false)
    expect(result.data).toBe(undefined)
    expect(result.error?.code).toBe('APP_SETTINGS_ERROR')
    expect(result.error?.message).toBe('App settings storage is unavailable')
    expect(result.error?.message).not.toContain('C:\\Users\\private')
  })

  test('surfaces settings read errors without manufacturing a default snapshot', async () => {
    const service = {
      getSettings: async () => {
        throw new Error('EACCES: C:\\Users\\private\\app-settings.json')
      },
      updateSettings: async () => createSnapshot()
    }
    registerAppSettingsIpc(service)

    const result = await requireHandler('app-settings:get')(mainFrameEvent(), undefined)

    expect(result.ok).toBe(false)
    expect(result.data).toBe(undefined)
    expect(result.error?.code).toBe('APP_SETTINGS_ERROR')
    expect(result.error?.message).toBe('App settings storage is unavailable')
    expect(result.error?.message).not.toContain('C:\\Users\\private')
  })

  test('keeps compatibility channels typed and snapshot-backed', async () => {
    let snapshot = createSnapshot()
    const service = {
      getSettings: async () => cloneSnapshot(snapshot),
      updateSettings: async (patch: AppSettingsPatch) => {
        snapshot = applyFakePatch(snapshot, patch)
        return cloneSnapshot(snapshot)
      }
    }
    registerAppSettingsIpc(service)

    const setTheme = await requireHandler('app:set-theme')(mainFrameEvent(), 'light')
    const invalidTheme = await requireHandler('app:set-theme')(mainFrameEvent(), 'sepia')
    const setSort = await requireHandler('app:set-file-tree-sort')(
      mainFrameEvent(),
      'modified-desc'
    )
    const setFont = await requireHandler('app:set-editor-font-size')(mainFrameEvent(), 18)

    expect(setTheme.data).toBe('light')
    expect(invalidTheme.error?.code).toBe('VALIDATION_FAILED')
    expect(setSort.data).toBe('modified-desc')
    expect(setFont.data).toBe(18)
  })
})

function requireHandler(channel: string): IpcHandler {
  const handler = ipcHandlers.get(channel)
  if (!handler) {
    throw new Error(`IPC handler was not registered: ${channel}`)
  }
  return handler
}

function mainFrameEvent(): unknown {
  const mainFrame = {}
  return { senderFrame: mainFrame, sender: { mainFrame } }
}

function childFrameEvent(): unknown {
  return { senderFrame: {}, sender: { mainFrame: {} } }
}

function createSnapshot(): AppSettingsSnapshot {
  return {
    version: 3,
    theme: 'system',
    fileTreeSort: 'name',
    editorFontSize: 13.5,
    workbench: {
      activateOnClose: 'history',
      whenClosingWithNoTabs: 'keep_window_open'
    },
    keymapOverrides: {}
  }
}

function cloneSnapshot(snapshot: AppSettingsSnapshot): AppSettingsSnapshot {
  return {
    ...snapshot,
    workbench: { ...snapshot.workbench },
    keymapOverrides: Object.fromEntries(
      Object.entries(snapshot.keymapOverrides).map(([id, bindings]) => [id, [...bindings]])
    )
  }
}

function applyFakePatch(
  snapshot: AppSettingsSnapshot,
  patch: AppSettingsPatch
): AppSettingsSnapshot {
  return {
    ...snapshot,
    ...patch,
    workbench: { ...snapshot.workbench, ...patch.workbench },
    keymapOverrides:
      patch.keymapOverrides === undefined
        ? snapshot.keymapOverrides
        : cloneSnapshot({ ...snapshot, keymapOverrides: patch.keymapOverrides }).keymapOverrides
  }
}
