import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  AppSettingsService,
  DEFAULT_EDITOR_FONT_SIZE,
  MAX_KEYMAP_BINDINGS_PER_ACTION
} from './app-settings'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: unknown): void
  toEqual(expected: unknown): void
  toContain(expected: string): void
  toHaveLength(expected: number): void
  not: { toContain(expected: string): void }
}

describe('AppSettingsService v3', () => {
  test('migrates a v1 settings file losslessly and supplies v3 workbench defaults', async () => {
    await withSettingsDirectory(async (root) => {
      await writeSettings(root, {
        version: 1,
        lastVaultPath: 'C:\\notes',
        theme: 'dark',
        fileTreeSort: 'modified-desc'
      })

      const settings = await new AppSettingsService(root).read()

      expect(settings.version).toBe(3)
      expect(settings.lastVaultPath).toBe('C:\\notes')
      expect(settings.theme).toBe('dark')
      expect(settings.fileTreeSort).toBe('modified-desc')
      expect(settings.editorFontSize).toBe(DEFAULT_EDITOR_FONT_SIZE)
      expect(settings.workbench).toEqual({
        activateOnClose: 'history',
        whenClosingWithNoTabs: 'keep_window_open'
      })
      expect(settings.keymapOverrides).toEqual({})
    })
  })

  test('migrates every v2 field to v3 without changing its value', async () => {
    await withSettingsDirectory(async (root) => {
      await writeSettings(root, {
        version: 2,
        lastVaultPath: 'D:\\vault',
        theme: 'light',
        fileTreeSort: 'created-desc',
        editorFontSize: 18.5
      })

      const settings = await new AppSettingsService(root).read()

      expect(settings.version).toBe(3)
      expect(settings.lastVaultPath).toBe('D:\\vault')
      expect(settings.theme).toBe('light')
      expect(settings.fileTreeSort).toBe('created-desc')
      expect(settings.editorFontSize).toBe(18.5)
    })
  })

  test('returns clean v3 defaults for missing, corrupt, and non-object JSON', async () => {
    await withSettingsDirectory(async (root) => {
      const service = new AppSettingsService(root)
      expect((await service.read()).version).toBe(3)

      await writeFile(join(root, 'app-settings.json'), '{not-json', 'utf8')
      const corrupt = await service.read()
      expect(corrupt.theme).toBe('system')
      expect(corrupt.workbench.activateOnClose).toBe('history')

      await writeFile(join(root, 'app-settings.json'), 'null', 'utf8')
      const nonObject = await service.read()
      expect(nonObject.fileTreeSort).toBe('name')
      expect(nonObject.keymapOverrides).toEqual({})
    })
  })

  test('normalizes invalid fields and clamps finite font sizes to 12–20', async () => {
    await withSettingsDirectory(async (root) => {
      const service = new AppSettingsService(root)

      await writeSettings(root, {
        version: 3,
        theme: 'neon',
        fileTreeSort: 'size',
        editorFontSize: 'large',
        workbench: {
          activateOnClose: 'newest',
          whenClosingWithNoTabs: 'quit_app'
        }
      })
      const invalid = await service.read()
      expect(invalid.theme).toBe('system')
      expect(invalid.fileTreeSort).toBe('name')
      expect(invalid.editorFontSize).toBe(DEFAULT_EDITOR_FONT_SIZE)
      expect(invalid.workbench.activateOnClose).toBe('history')
      expect(invalid.workbench.whenClosingWithNoTabs).toBe('keep_window_open')

      await writeSettings(root, { version: 3, editorFontSize: 8 })
      expect((await service.read()).editorFontSize).toBe(12)

      await writeSettings(root, { version: 3, editorFontSize: 24 })
      expect((await service.read()).editorFontSize).toBe(20)
    })
  })

  test('bounds, canonicalizes, deduplicates, and filters persisted keymap overrides', async () => {
    await withSettingsDirectory(async (root) => {
      const alternatives = 'ABCDEFGHIJ'.split('').map((key) => `Mod+Alt+${key}`)
      await writeSettings(root, {
        version: 3,
        keymapOverrides: {
          'note.open': [' Mod+O ', 'Mod+O'],
          'command-palette.toggle': alternatives,
          'unknown.action': ['Mod+U'],
          'workbench.close-item': ['Mod+R', 'F12', 'Mod', 'P', 'Mod+K Mod+P']
        }
      })

      const settings = await new AppSettingsService(root).read()

      expect(settings.keymapOverrides['note.open']).toBe(undefined)
      expect(settings.keymapOverrides['unknown.action']).toBe(undefined)
      expect(settings.keymapOverrides['file.open']).toEqual(['Mod+O'])
      expect(settings.keymapOverrides['command-palette.toggle']).toHaveLength(
        MAX_KEYMAP_BINDINGS_PER_ACTION
      )
      expect(settings.keymapOverrides['command-palette.toggle'][0]).toBe('Mod+Alt+A')
      expect(settings.keymapOverrides['workbench.close-item']).toBe(undefined)
    })
  })

  test('preserves an explicit unbind while missing action IDs continue to mean defaults', async () => {
    await withSettingsDirectory(async (root) => {
      const service = new AppSettingsService(root)
      const snapshot = await service.updateSettings({
        keymapOverrides: { 'file.open': [] }
      })

      expect(snapshot.keymapOverrides).toEqual({ 'file.open': [] })
      expect('workbench.close-item' in snapshot.keymapOverrides).toBe(false)
    })
  })

  test('atomically round-trips an allowlisted snapshot and strips unknown or secret fields', async () => {
    await withSettingsDirectory(async (root) => {
      await writeSettings(root, {
        version: 2,
        lastVaultPath: null,
        theme: 'light',
        fileTreeSort: 'created-desc',
        editorFontSize: 14,
        apiKey: 'must-not-survive',
        token: 'also-secret',
        unknown: { nested: true }
      })
      const service = new AppSettingsService(root)

      const snapshot = await service.updateSettings({
        theme: 'dark',
        fileTreeSort: 'modified-desc',
        editorFontSize: 18.5,
        workbench: {
          activateOnClose: 'left',
          whenClosingWithNoTabs: 'close_window'
        }
      })

      const persisted = await readFile(join(root, 'app-settings.json'), 'utf8')
      const files = await readdir(root)
      expect(snapshot.version).toBe(3)
      expect(snapshot.theme).toBe('dark')
      expect(snapshot.workbench.activateOnClose).toBe('left')
      expect('lastVaultPath' in snapshot).toBe(false)
      expect(persisted).toContain('"version": 3')
      expect(persisted).not.toContain('apiKey')
      expect(persisted).not.toContain('must-not-survive')
      expect(persisted).not.toContain('also-secret')
      expect(persisted).not.toContain('unknown')
      expect(files).toEqual(['app-settings.json'])
    })
  })

  test('serializes concurrent mutations without losing independent values', async () => {
    await withSettingsDirectory(async (root) => {
      const service = new AppSettingsService(root)

      await Promise.all([
        service.setTheme('dark'),
        service.setFileTreeSort('modified-desc'),
        service.setEditorFontSize(17),
        service.setLastVaultPath(root),
        service.updateSettings({ workbench: { activateOnClose: 'right' } }),
        service.updateSettings({
          workbench: { whenClosingWithNoTabs: 'close_window' }
        }),
        service.updateSettings({ keymapOverrides: { 'file.open': ['Mod+O'] } })
      ])

      const settings = await service.read()
      expect(settings.theme).toBe('dark')
      expect(settings.fileTreeSort).toBe('modified-desc')
      expect(settings.editorFontSize).toBe(17)
      expect(settings.lastVaultPath).toBe(root)
      expect(settings.workbench).toEqual({
        activateOnClose: 'right',
        whenClosingWithNoTabs: 'close_window'
      })
      expect(settings.keymapOverrides).toEqual({ 'file.open': ['Mod+O'] })
    })
  })

  test('surfaces unreadable settings storage instead of manufacturing defaults', async () => {
    const base = await mkdtemp(join(tmpdir(), 'mdx-vault-app-settings-failure-'))
    await mkdir(join(base, 'app-settings.json'))
    const service = new AppSettingsService(base)

    try {
      let rejected = false
      try {
        await service.updateSettings({ theme: 'dark' })
      } catch {
        rejected = true
      }
      expect(rejected).toBe(true)

      let readRejected = false
      try {
        await service.getSettings()
      } catch {
        readRejected = true
      }
      expect(readRejected).toBe(true)
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  test('surfaces last-vault stat errors other than a missing path', async () => {
    await withSettingsDirectory(async (root) => {
      const service = new AppSettingsService(root)
      await service.setLastVaultPath(`${root}\0invalid-vault`)

      let rejected = false
      try {
        await service.getLastVaultPath()
      } catch {
        rejected = true
      }
      expect(rejected).toBe(true)
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
