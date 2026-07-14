import { mkdir, readFile, rename, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

/**
 * App-level settings that live OUTSIDE the vault (in Electron's userData dir).
 *
 * This is deliberately separate from {@link AiSettingsService}, which is
 * vault-scoped and stores secrets. Here we only persist non-sensitive UI
 * preferences and the last-opened vault path so the app can reopen it on
 * startup. No note content, no API keys, no secrets — ever.
 */

const SETTINGS_FILENAME = 'app-settings.json'

export type FileTreeSortSetting = 'name' | 'modified-desc' | 'created-desc'
export type AppTheme = 'light' | 'dark' | 'system'

export interface PersistedAppSettings {
  version: 2
  lastVaultPath: string | null
  theme: AppTheme
  fileTreeSort: FileTreeSortSetting
  editorFontSize: number
}

export const MIN_EDITOR_FONT_SIZE = 12
export const MAX_EDITOR_FONT_SIZE = 20
export const DEFAULT_EDITOR_FONT_SIZE = 13.5

const DEFAULT_SETTINGS: PersistedAppSettings = {
  version: 2,
  lastVaultPath: null,
  theme: 'system',
  fileTreeSort: 'name',
  editorFontSize: DEFAULT_EDITOR_FONT_SIZE
}

export class AppSettingsService {
  private readonly filePath: string

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, SETTINGS_FILENAME)
  }

  async read(): Promise<PersistedAppSettings> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PersistedAppSettings>
      return {
        version: 2,
        lastVaultPath: typeof parsed.lastVaultPath === 'string' ? parsed.lastVaultPath : null,
        theme: normalizeTheme(parsed.theme),
        fileTreeSort: normalizeFileTreeSort(parsed.fileTreeSort),
        editorFontSize: normalizeEditorFontSize(parsed.editorFontSize)
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return { ...DEFAULT_SETTINGS }
      }
      // Corrupt file: reset to defaults rather than crash. Never throw on read.
      return { ...DEFAULT_SETTINGS }
    }
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
    const settings = await this.read()
    await this.write({ ...settings, lastVaultPath: vaultPath })
  }

  async getTheme(): Promise<AppTheme> {
    const settings = await this.read()
    return settings.theme
  }

  async setTheme(theme: AppTheme): Promise<void> {
    const settings = await this.read()
    await this.write({ ...settings, theme })
  }

  async getFileTreeSort(): Promise<FileTreeSortSetting> {
    const settings = await this.read()
    return settings.fileTreeSort
  }

  async setFileTreeSort(sort: FileTreeSortSetting): Promise<void> {
    const settings = await this.read()
    await this.write({ ...settings, fileTreeSort: sort })
  }

  async getEditorFontSize(): Promise<number> {
    const settings = await this.read()
    return settings.editorFontSize
  }

  async setEditorFontSize(fontSize: number): Promise<void> {
    const settings = await this.read()
    await this.write({ ...settings, editorFontSize: normalizeEditorFontSize(fontSize) })
  }

  private async write(settings: PersistedAppSettings): Promise<void> {
    const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`
    const serialized = `${JSON.stringify(settings, null, 2)}\n`

    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(tempPath, serialized, 'utf8')
    await rename(tempPath, this.filePath)
  }
}

function normalizeTheme(value: unknown): AppTheme {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }
  return 'system'
}

function normalizeFileTreeSort(value: unknown): FileTreeSortSetting {
  if (value === 'name' || value === 'modified-desc' || value === 'created-desc') {
    return value
  }
  return 'name'
}

function normalizeEditorFontSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_EDITOR_FONT_SIZE
  }

  return Math.min(MAX_EDITOR_FONT_SIZE, Math.max(MIN_EDITOR_FONT_SIZE, value))
}

async function directoryExists(target: string): Promise<boolean> {
  try {
    const stats = await stat(target)
    return stats.isDirectory()
  } catch {
    return false
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
