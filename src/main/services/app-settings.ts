import { app } from 'electron'
import { mkdir, readFile, rename, writeFile, stat } from 'fs/promises'
import { join, dirname } from 'path'

/**
 * App-level settings that live OUTSIDE the vault (in Electron's userData dir).
 *
 * This is deliberately separate from {@link AiSettingsService}, which is
 * vault-scoped and stores secrets. Here we only persist non-sensitive UI
 * preferences and the last-opened vault path so the app can reopen it on
 * startup. No note content, no API keys, no secrets — ever.
 */

const SETTINGS_FILENAME = 'app-settings.json'

interface PersistedAppSettings {
  version: 1
  lastVaultPath: string | null
  theme: 'light' | 'dark' | 'system'
}

const DEFAULT_SETTINGS: PersistedAppSettings = {
  version: 1,
  lastVaultPath: null,
  theme: 'system'
}

export class AppSettingsService {
  private readonly filePath: string

  constructor() {
    this.filePath = join(app.getPath('userData'), SETTINGS_FILENAME)
  }

  async read(): Promise<PersistedAppSettings> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PersistedAppSettings>
      return {
        version: 1,
        lastVaultPath: typeof parsed.lastVaultPath === 'string' ? parsed.lastVaultPath : null,
        theme: normalizeTheme(parsed.theme)
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

  async getTheme(): Promise<'light' | 'dark' | 'system'> {
    const settings = await this.read()
    return settings.theme
  }

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    const settings = await this.read()
    await this.write({ ...settings, theme })
  }

  private async write(settings: PersistedAppSettings): Promise<void> {
    const tempPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`
    const serialized = `${JSON.stringify(settings, null, 2)}\n`

    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(tempPath, serialized, 'utf8')
    await rename(tempPath, this.filePath)
  }
}

function normalizeTheme(value: unknown): 'light' | 'dark' | 'system' {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }
  return 'system'
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
