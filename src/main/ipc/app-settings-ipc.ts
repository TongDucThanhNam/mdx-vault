import { type IpcMainInvokeEvent, ipcMain } from 'electron'
import { z } from 'zod'
import {
  ACTIVATE_ON_CLOSE_VALUES,
  APP_THEME_VALUES,
  FILE_TREE_SORT_VALUES,
  WHEN_CLOSING_WITH_NO_TABS_VALUES
} from '../../shared/app-settings'
import type {
  AppSettingsPatch,
  AppSettingsService,
  AppSettingsSnapshot,
  AppTheme,
  FileTreeSortSetting
} from '../services/app-settings'
import {
  MAX_EDITOR_FONT_SIZE,
  MAX_KEYMAP_ACTION_ID_LENGTH,
  MAX_KEYMAP_BINDING_LENGTH,
  MAX_KEYMAP_BINDINGS_PER_ACTION,
  MAX_KEYMAP_OVERRIDE_ACTIONS,
  MIN_EDITOR_FONT_SIZE
} from '../services/app-settings'
import type { IpcFailure, IpcResult } from './vault-ipc'

const emptyPayloadSchema = z.undefined()
const themeSchema = z.enum(APP_THEME_VALUES)
const fileTreeSortSchema = z.enum(FILE_TREE_SORT_VALUES)
const editorFontSizeSchema = z.number().finite().min(MIN_EDITOR_FONT_SIZE).max(MAX_EDITOR_FONT_SIZE)
const actionIdSchema = z.string().trim().min(1).max(MAX_KEYMAP_ACTION_ID_LENGTH)
const keyBindingSchema = z.string().trim().min(1).max(MAX_KEYMAP_BINDING_LENGTH)
const keymapOverridesSchema = z
  .record(actionIdSchema, z.array(keyBindingSchema).max(MAX_KEYMAP_BINDINGS_PER_ACTION))
  .refine((overrides) => Object.keys(overrides).length <= MAX_KEYMAP_OVERRIDE_ACTIONS, {
    message: `Keymap overrides may contain at most ${MAX_KEYMAP_OVERRIDE_ACTIONS} actions`
  })
const workbenchPatchSchema = z
  .object({
    activateOnClose: z.enum(ACTIVATE_ON_CLOSE_VALUES).optional(),
    whenClosingWithNoTabs: z.enum(WHEN_CLOSING_WITH_NO_TABS_VALUES).optional()
  })
  .strict()
const appSettingsPatchSchema: z.ZodType<AppSettingsPatch> = z
  .object({
    theme: themeSchema.optional(),
    fileTreeSort: fileTreeSortSchema.optional(),
    editorFontSize: editorFontSizeSchema.optional(),
    workbench: workbenchPatchSchema.optional(),
    keymapOverrides: keymapOverridesSchema.optional()
  })
  .strict()

type AppSettingsIpcService = Pick<AppSettingsService, 'getSettings' | 'updateSettings'>

export function registerAppSettingsIpc(appSettings: AppSettingsIpcService): void {
  ipcMain.handle(
    'app-settings:get',
    (event, payload): Promise<IpcResult<AppSettingsSnapshot>> =>
      handleAppSettingsRequest(event, payload, emptyPayloadSchema, () => appSettings.getSettings())
  )

  ipcMain.handle(
    'app-settings:update',
    (event, payload): Promise<IpcResult<AppSettingsSnapshot>> =>
      handleAppSettingsRequest(event, payload, appSettingsPatchSchema, (patch) =>
        appSettings.updateSettings(patch)
      )
  )

  // Compatibility channels keep existing renderer hooks working while all
  // persistence now flows through the same serialized snapshot mutation.
  ipcMain.handle(
    'app:get-theme',
    (event, payload): Promise<IpcResult<AppTheme>> =>
      handleAppSettingsRequest(event, payload, emptyPayloadSchema, async () => {
        return (await appSettings.getSettings()).theme
      })
  )

  ipcMain.handle(
    'app:set-theme',
    (event, payload): Promise<IpcResult<AppTheme>> =>
      handleAppSettingsRequest(event, payload, themeSchema, async (theme) => {
        return (await appSettings.updateSettings({ theme })).theme
      })
  )

  ipcMain.handle(
    'app:get-file-tree-sort',
    (event, payload): Promise<IpcResult<FileTreeSortSetting>> =>
      handleAppSettingsRequest(event, payload, emptyPayloadSchema, async () => {
        return (await appSettings.getSettings()).fileTreeSort
      })
  )

  ipcMain.handle(
    'app:set-file-tree-sort',
    (event, payload): Promise<IpcResult<FileTreeSortSetting>> =>
      handleAppSettingsRequest(event, payload, fileTreeSortSchema, async (fileTreeSort) => {
        return (await appSettings.updateSettings({ fileTreeSort })).fileTreeSort
      })
  )

  ipcMain.handle(
    'app:get-editor-font-size',
    (event, payload): Promise<IpcResult<number>> =>
      handleAppSettingsRequest(event, payload, emptyPayloadSchema, async () => {
        return (await appSettings.getSettings()).editorFontSize
      })
  )

  ipcMain.handle(
    'app:set-editor-font-size',
    (event, payload): Promise<IpcResult<number>> =>
      handleAppSettingsRequest(event, payload, editorFontSizeSchema, async (editorFontSize) => {
        return (await appSettings.updateSettings({ editorFontSize })).editorFontSize
      })
  )
}

async function handleAppSettingsRequest<TPayload, TResult>(
  event: IpcMainInvokeEvent,
  payload: unknown,
  schema: z.ZodType<TPayload>,
  operation: (payload: TPayload) => TResult | Promise<TResult>
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
      error: toAppSettingsIpcError(error)
    }
  }
}

function assertMainFrame(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new AppSettingsIpcError(
      'MAIN_FRAME_REQUIRED',
      'App settings IPC is only available to the main renderer frame'
    )
  }
}

class AppSettingsIpcError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AppSettingsIpcError'
  }
}

function toAppSettingsIpcError(error: unknown): IpcFailure['error'] {
  if (error instanceof z.ZodError) {
    return {
      code: 'VALIDATION_FAILED',
      message: error.issues.map((issue) => issue.message).join('; ')
    }
  }

  if (error instanceof AppSettingsIpcError) {
    return {
      code: error.code,
      message: error.message
    }
  }

  if (error instanceof Error) {
    return {
      code: 'APP_SETTINGS_ERROR',
      // Filesystem errors can include the absolute userData/settings path.
      // Keep storage failures visible without exposing that path.
      message: 'App settings storage is unavailable'
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Unknown app settings error'
  }
}
