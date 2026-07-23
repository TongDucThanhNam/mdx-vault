import { randomUUID } from 'crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

import {
  APP_SETTINGS_CATALOG,
  type AppSettingsPatch,
  type AppSettingsSnapshot,
  type AppTheme,
  DEFAULT_APP_SETTINGS_SNAPSHOT,
  DEFAULT_WORKBENCH_SETTINGS,
  type DefaultNoteViewSetting,
  type FileTreeSortSetting,
  type KeymapOverrides,
  normalizeKeymapOverrides,
  type PagePreviewSettings,
  type WorkbenchSettings
} from '../../shared/app-settings'
import type { KeybindingPlatform } from '../../shared/workspace-actions'

export type {
  ActivateOnCloseSetting,
  AppSettingsPatch,
  AppSettingsSnapshot,
  AppTheme,
  DefaultNoteViewSetting,
  FileTreeSortSetting,
  KeymapOverrides,
  PagePreviewSettings,
  WhenClosingWithNoTabsSetting,
  WorkbenchSettings
} from '../../shared/app-settings'
export {
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_WORKBENCH_SETTINGS,
  MAX_EDITOR_FONT_SIZE,
  MAX_KEYMAP_ACTION_ID_LENGTH,
  MAX_KEYMAP_BINDING_LENGTH,
  MAX_KEYMAP_BINDINGS_PER_ACTION,
  MAX_KEYMAP_OVERRIDE_ACTIONS,
  MIN_EDITOR_FONT_SIZE
} from '../../shared/app-settings'

/**
 * App-level settings that live OUTSIDE the vault (in Electron's userData dir).
 *
 * This is deliberately separate from AiSettingsService, which stores secrets.
 * Only non-sensitive workbench preferences and the last-opened vault path are
 * accepted here. Every read and write rebuilds the persisted value from this
 * allowlist, so unknown and secret-looking fields can never be carried forward.
 */

const SETTINGS_FILENAME = 'app-settings.json'

export interface PersistedAppSettings {
  version: 5
  lastVaultPath: string | null
  theme: AppTheme
  fileTreeSort: FileTreeSortSetting
  defaultNoteView: DefaultNoteViewSetting
  editorFontSize: number
  pagePreview: PagePreviewSettings
  workbench: WorkbenchSettings
  keymapOverrides: KeymapOverrides
}

const DEFAULT_SETTINGS: Readonly<PersistedAppSettings> = {
  version: 5,
  lastVaultPath: null,
  theme: DEFAULT_APP_SETTINGS_SNAPSHOT.theme,
  fileTreeSort: DEFAULT_APP_SETTINGS_SNAPSHOT.fileTreeSort,
  defaultNoteView: DEFAULT_APP_SETTINGS_SNAPSHOT.defaultNoteView,
  editorFontSize: DEFAULT_APP_SETTINGS_SNAPSHOT.editorFontSize,
  pagePreview: DEFAULT_APP_SETTINGS_SNAPSHOT.pagePreview,
  workbench: DEFAULT_WORKBENCH_SETTINGS,
  keymapOverrides: {}
}

const CURRENT_KEYBINDING_PLATFORM: KeybindingPlatform =
  process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux'

export class AppSettingsService {
  private readonly filePath: string
  private mutationTail: Promise<void> = Promise.resolve()

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, SETTINGS_FILENAME)
  }

  async read(): Promise<PersistedAppSettings> {
    await this.mutationTail
    return this.readFromDisk()
  }

  async getSettings(): Promise<AppSettingsSnapshot> {
    return toSnapshot(await this.read())
  }

  async updateSettings(patch: AppSettingsPatch): Promise<AppSettingsSnapshot> {
    const persisted = await this.mutate((current) => applyPatch(current, patch))
    return toSnapshot(persisted)
  }

  async getLastVaultPath(): Promise<string | null> {
    const settings = await this.read()
    const path = settings.lastVaultPath

    if (!path) {
      return null
    }

    // Confirm the folder still exists before handing it back. If the user
    // moved/deleted it, we treat it as "no last vault".
    if (!(await directoryExists(path))) {
      return null
    }

    return path
  }

  async setLastVaultPath(vaultPath: string | null): Promise<void> {
    await this.mutate((settings) => ({ ...settings, lastVaultPath: vaultPath }))
  }

  async getTheme(): Promise<AppTheme> {
    return (await this.read()).theme
  }

  async setTheme(theme: AppTheme): Promise<void> {
    await this.updateSettings({ theme })
  }

  async getFileTreeSort(): Promise<FileTreeSortSetting> {
    return (await this.read()).fileTreeSort
  }

  async setFileTreeSort(fileTreeSort: FileTreeSortSetting): Promise<void> {
    await this.updateSettings({ fileTreeSort })
  }

  async getEditorFontSize(): Promise<number> {
    return (await this.read()).editorFontSize
  }

  async setEditorFontSize(editorFontSize: number): Promise<void> {
    await this.updateSettings({ editorFontSize })
  }

  private async readFromDisk(): Promise<PersistedAppSettings> {
    let raw: string
    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isNotFoundError(error)) {
        return clonePersistedSettings(DEFAULT_SETTINGS)
      }
      // Permission, path-shape, and device failures are persistence failures,
      // not evidence that the user has a valid default settings snapshot.
      throw error
    }

    try {
      return normalizePersistedSettings(JSON.parse(raw))
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error
      }
      // Invalid JSON is schema corruption rather than an unreadable backing
      // store. Normalize it without silently overwriting the profile.
      return clonePersistedSettings(DEFAULT_SETTINGS)
    }
  }

  private mutate(
    mutation: (settings: PersistedAppSettings) => PersistedAppSettings
  ): Promise<PersistedAppSettings> {
    const operation = this.mutationTail.then(async () => {
      const current = await this.readFromDisk()
      const next = normalizePersistedSettings(mutation(current))
      await this.write(next)
      return clonePersistedSettings(next)
    })

    // A rejected mutation is returned to its caller, but does not poison the
    // queue. Later mutations still start from the last snapshot actually on disk.
    this.mutationTail = operation.then(
      () => undefined,
      () => undefined
    )
    return operation
  }

  private async write(settings: PersistedAppSettings): Promise<void> {
    const tempPath = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`
    const serialized = `${JSON.stringify(settings, null, 2)}\n`

    await mkdir(dirname(this.filePath), { recursive: true })
    try {
      await writeFile(tempPath, serialized, 'utf8')
      await rename(tempPath, this.filePath)
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined)
      throw error
    }
  }
}

function applyPatch(settings: PersistedAppSettings, patch: AppSettingsPatch): PersistedAppSettings {
  return {
    ...settings,
    theme: patch.theme ?? settings.theme,
    fileTreeSort: patch.fileTreeSort ?? settings.fileTreeSort,
    defaultNoteView: patch.defaultNoteView ?? settings.defaultNoteView,
    editorFontSize:
      patch.editorFontSize === undefined
        ? settings.editorFontSize
        : APP_SETTINGS_CATALOG.editorFontSize.normalize(patch.editorFontSize),
    pagePreview: {
      enabled: patch.pagePreview?.enabled ?? settings.pagePreview.enabled,
      requireModifier: patch.pagePreview?.requireModifier ?? settings.pagePreview.requireModifier
    },
    workbench: {
      activateOnClose: patch.workbench?.activateOnClose ?? settings.workbench.activateOnClose,
      whenClosingWithNoTabs:
        patch.workbench?.whenClosingWithNoTabs ?? settings.workbench.whenClosingWithNoTabs
    },
    keymapOverrides:
      patch.keymapOverrides === undefined
        ? settings.keymapOverrides
        : normalizeKeymapOverrides(patch.keymapOverrides, CURRENT_KEYBINDING_PLATFORM)
  }
}

function normalizePersistedSettings(value: unknown): PersistedAppSettings {
  const parsed = isRecord(value) ? value : {}
  const workbench = isRecord(parsed.workbench) ? parsed.workbench : {}
  const pagePreview = isRecord(parsed.pagePreview) ? parsed.pagePreview : {}

  return {
    version: 5,
    lastVaultPath: typeof parsed.lastVaultPath === 'string' ? parsed.lastVaultPath : null,
    theme: APP_SETTINGS_CATALOG.theme.normalize(parsed.theme),
    fileTreeSort: APP_SETTINGS_CATALOG.fileTreeSort.normalize(parsed.fileTreeSort),
    defaultNoteView: APP_SETTINGS_CATALOG.defaultNoteView.normalize(parsed.defaultNoteView),
    editorFontSize: APP_SETTINGS_CATALOG.editorFontSize.normalize(parsed.editorFontSize),
    pagePreview: {
      enabled: APP_SETTINGS_CATALOG.pagePreviewEnabled.normalize(pagePreview.enabled),
      requireModifier: APP_SETTINGS_CATALOG.pagePreviewRequireModifier.normalize(
        pagePreview.requireModifier
      )
    },
    workbench: {
      activateOnClose: APP_SETTINGS_CATALOG.activateOnClose.normalize(workbench.activateOnClose),
      whenClosingWithNoTabs: APP_SETTINGS_CATALOG.whenClosingWithNoTabs.normalize(
        workbench.whenClosingWithNoTabs
      )
    },
    keymapOverrides: normalizeKeymapOverrides(parsed.keymapOverrides, CURRENT_KEYBINDING_PLATFORM)
  }
}

function toSnapshot(settings: PersistedAppSettings): AppSettingsSnapshot {
  return {
    version: 5,
    theme: settings.theme,
    fileTreeSort: settings.fileTreeSort,
    defaultNoteView: settings.defaultNoteView,
    editorFontSize: settings.editorFontSize,
    pagePreview: { ...settings.pagePreview },
    workbench: { ...settings.workbench },
    keymapOverrides: cloneKeymapOverrides(settings.keymapOverrides)
  }
}

function clonePersistedSettings(settings: Readonly<PersistedAppSettings>): PersistedAppSettings {
  return {
    version: 5,
    lastVaultPath: settings.lastVaultPath,
    theme: settings.theme,
    fileTreeSort: settings.fileTreeSort,
    defaultNoteView: settings.defaultNoteView,
    editorFontSize: settings.editorFontSize,
    pagePreview: { ...settings.pagePreview },
    workbench: { ...settings.workbench },
    keymapOverrides: cloneKeymapOverrides(settings.keymapOverrides)
  }
}

function cloneKeymapOverrides(overrides: Readonly<KeymapOverrides>): KeymapOverrides {
  return Object.fromEntries(
    Object.entries(overrides).map(([actionId, bindings]) => [actionId, [...bindings]])
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function directoryExists(target: string): Promise<boolean> {
  try {
    const stats = await stat(target)
    return stats.isDirectory()
  } catch (error) {
    if (isNotFoundError(error)) {
      return false
    }
    throw error
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}
