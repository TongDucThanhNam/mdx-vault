import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { AppSettingsService, DEFAULT_EDITOR_FONT_SIZE } from './app-settings'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
  toContain(expected: string): void
  not: { toContain(expected: string): void }
}

describe('AppSettingsService v2', () => {
  test('migrates a v1 settings file with the default editor font size', async () => {
    await withSettingsDirectory(async (root) => {
      await writeSettings(root, {
        version: 1,
        lastVaultPath: 'C:\\notes',
        theme: 'dark',
        fileTreeSort: 'modified-desc'
      })

      const settings = await new AppSettingsService(root).read()

      expect(settings.version).toBe(2)
      expect(settings.lastVaultPath).toBe('C:\\notes')
      expect(settings.theme).toBe('dark')
      expect(settings.fileTreeSort).toBe('modified-desc')
      expect(settings.editorFontSize).toBe(DEFAULT_EDITOR_FONT_SIZE)
    })
  })

  test('returns v2 defaults for corrupt JSON without throwing', async () => {
    await withSettingsDirectory(async (root) => {
      await writeFile(join(root, 'app-settings.json'), '{not-json', 'utf8')

      const settings = await new AppSettingsService(root).read()

      expect(settings.version).toBe(2)
      expect(settings.lastVaultPath).toBe(null)
      expect(settings.theme).toBe('system')
      expect(settings.fileTreeSort).toBe('name')
      expect(settings.editorFontSize).toBe(DEFAULT_EDITOR_FONT_SIZE)
    })
  })

  test('normalizes invalid font sizes and clamps finite numbers to 12–20', async () => {
    await withSettingsDirectory(async (root) => {
      const service = new AppSettingsService(root)

      await writeSettings(root, { version: 2, editorFontSize: 'large' })
      expect((await service.read()).editorFontSize).toBe(DEFAULT_EDITOR_FONT_SIZE)

      await writeSettings(root, { version: 2, editorFontSize: 8 })
      expect((await service.read()).editorFontSize).toBe(12)

      await writeSettings(root, { version: 2, editorFontSize: 24 })
      expect((await service.read()).editorFontSize).toBe(20)

      await writeSettings(root, { version: 2, editorFontSize: 16.5 })
      expect((await service.read()).editorFontSize).toBe(16.5)
    })
  })

  test('round-trips v2 settings and never carries unknown secret fields forward', async () => {
    await withSettingsDirectory(async (root) => {
      await writeSettings(root, {
        version: 2,
        lastVaultPath: null,
        theme: 'light',
        fileTreeSort: 'created-desc',
        editorFontSize: 14,
        apiKey: 'must-not-survive'
      })
      const service = new AppSettingsService(root)

      await service.setTheme('dark')
      await service.setFileTreeSort('modified-desc')
      await service.setEditorFontSize(18.5)

      const settings = await service.read()
      const persisted = await readFile(join(root, 'app-settings.json'), 'utf8')

      expect(settings.version).toBe(2)
      expect(settings.theme).toBe('dark')
      expect(settings.fileTreeSort).toBe('modified-desc')
      expect(settings.editorFontSize).toBe(18.5)
      expect(persisted).toContain('"editorFontSize": 18.5')
      expect(persisted).not.toContain('apiKey')
      expect(persisted).not.toContain('must-not-survive')
    })
  })
})

async function withSettingsDirectory(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'mdx-vault-app-settings-'))
  try {
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function writeSettings(root: string, value: Record<string, unknown>): Promise<void> {
  await writeFile(join(root, 'app-settings.json'), JSON.stringify(value), 'utf8')
}
