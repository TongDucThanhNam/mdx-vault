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
      locale: 'vi',
      density: 'compact',
      uiScale: 115,
      showFileExtensions: true,
      defaultNoteView: 'source',
      editorFontFamily: 'ibm-plex-mono',
      editorFontWeight: 'medium',
      editorLineHeight: 1.5,
      editorLigatures: false,
      editorTabSize: '4',
      editorNoteWordWrap: 'viewport',
      editorCodeWordWrap: 'bounded',
      editorWrapColumn: 96,
      editorIndentGuides: false,
      editorWhitespace: 'all',
      editorRuler: false,
      pagePreview: { enabled: false, requireModifier: true },
      workbench: { activateOnClose: 'right' },
      keymapOverrides: { 'file.open': ['Mod+O'] }
    })

    expect(updateResult.ok).toBe(true)
    expect((updateResult.data as AppSettingsSnapshot).theme).toBe('dark')
    expect((updateResult.data as AppSettingsSnapshot).locale).toBe('vi')
    expect((updateResult.data as AppSettingsSnapshot).density).toBe('compact')
    expect((updateResult.data as AppSettingsSnapshot).uiScale).toBe(115)
    expect((updateResult.data as AppSettingsSnapshot).showFileExtensions).toBe(true)
    expect((updateResult.data as AppSettingsSnapshot).defaultNoteView).toBe('source')
    expect((updateResult.data as AppSettingsSnapshot).editorFontFamily).toBe('ibm-plex-mono')
    expect((updateResult.data as AppSettingsSnapshot).editorWrapColumn).toBe(96)
    expect((updateResult.data as AppSettingsSnapshot).pagePreview).toEqual({
      enabled: false,
      requireModifier: true
    })
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
      { editorFontFamily: 'papyrus' },
      { editorFontWeight: 'bold' },
      { editorLineHeight: 4 },
      { editorLigatures: 'yes' },
      { editorTabSize: '3' },
      { editorNoteWordWrap: 'column' },
      { editorCodeWordWrap: true },
      { editorWrapColumn: 12 },
      { editorWhitespace: 'selection' },
      { locale: 'fr' },
      { density: 'dense' },
      { uiScale: 111 },
      { uiScale: 130 },
      { showFileExtensions: 'yes' },
      { defaultNoteView: 'split' },
      { pagePreview: { enabled: 'yes' } },
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
    version: 6,
    theme: 'system',
    locale: 'system',
    density: 'comfortable',
    uiScale: 100,
    fileTreeSort: 'name',
    showFileExtensions: false,
    defaultNoteView: 'reading',
    editorFontSize: 14,
    editorFontFamily: 'maple-mono',
    editorFontWeight: 'regular',
    editorLineHeight: 1.45,
    editorLigatures: true,
    editorTabSize: '2',
    editorNoteWordWrap: 'bounded',
    editorCodeWordWrap: 'off',
    editorWrapColumn: 88,
    editorIndentGuides: true,
    editorWhitespace: 'none',
    editorRuler: true,
    pagePreview: { enabled: true, requireModifier: false },
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
    pagePreview: { ...snapshot.pagePreview },
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
    pagePreview: { ...snapshot.pagePreview, ...patch.pagePreview },
    keymapOverrides:
      patch.keymapOverrides === undefined
        ? snapshot.keymapOverrides
        : cloneSnapshot({ ...snapshot, keymapOverrides: patch.keymapOverrides }).keymapOverrides
  }
}
