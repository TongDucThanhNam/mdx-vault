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

describe('AppSettingsService v6', () => {
  test('migrates a v1 settings file losslessly and supplies current defaults', async () => {
    await withSettingsDirectory(async (root) => {
      await writeSettings(root, {
        version: 1,
        lastVaultPath: 'C:\\notes',
        theme: 'dark',
        fileTreeSort: 'modified-desc'
      })

      const settings = await new AppSettingsService(root).read()

      expect(settings.version).toBe(6)
      expect(settings.lastVaultPath).toBe('C:\\notes')
      expect(settings.theme).toBe('dark')
      expect(settings.fileTreeSort).toBe('modified-desc')
      expect(settings.defaultNoteView).toBe('reading')
      expect(settings.editorFontSize).toBe(DEFAULT_EDITOR_FONT_SIZE)
      expect(settings.locale).toBe('system')
      expect(settings.density).toBe('comfortable')
      expect(settings.uiScale).toBe(100)
      expect(settings.pagePreview).toEqual({ enabled: true, requireModifier: false })
      expect(settings.workbench).toEqual({
        activateOnClose: 'history',
        whenClosingWithNoTabs: 'keep_window_open'
      })
      expect(settings.keymapOverrides).toEqual({})
    })
  })

  test('migrates every v2 field to v6 without changing its value', async () => {
    await withSettingsDirectory(async (root) => {
      await writeSettings(root, {
        version: 2,
        lastVaultPath: 'D:\\vault',
        theme: 'light',
        fileTreeSort: 'created-desc',
        editorFontSize: 18.5
      })

      const settings = await new AppSettingsService(root).read()

      expect(settings.version).toBe(6)
      expect(settings.lastVaultPath).toBe('D:\\vault')
      expect(settings.theme).toBe('light')
      expect(settings.fileTreeSort).toBe('created-desc')
      expect(settings.editorFontSize).toBe(18.5)
      expect(settings.defaultNoteView).toBe('reading')
    })
  })

  test('migrates v4 page-preview defaults and preserves explicit v5 values', async () => {
    await withSettingsDirectory(async (root) => {
      await writeSettings(root, {
        version: 4,
        theme: 'dark',
        defaultNoteView: 'live'
      })
      const service = new AppSettingsService(root)
      expect((await service.read()).pagePreview).toEqual({
        enabled: true,
        requireModifier: false
      })

      await writeSettings(root, {
        version: 5,
        pagePreview: { enabled: false, requireModifier: true }
      })
      expect((await service.read()).pagePreview).toEqual({
        enabled: false,
        requireModifier: true
      })
    })
  })

  test('migrates v5 interface defaults and preserves explicit v6 preferences', async () => {
    await withSettingsDirectory(async (root) => {
      await writeSettings(root, { version: 5, theme: 'dark' })
      const service = new AppSettingsService(root)
      const migrated = await service.read()
      expect(migrated.version).toBe(6)
      expect(migrated.locale).toBe('system')
      expect(migrated.density).toBe('comfortable')
      expect(migrated.uiScale).toBe(100)

      await writeSettings(root, {
        version: 6,
        locale: 'vi',
        density: 'compact',
        uiScale: 115
      })
      const explicit = await service.read()
      expect(explicit.locale).toBe('vi')
      expect(explicit.density).toBe('compact')
      expect(explicit.uiScale).toBe(115)
    })
  })

  test('returns clean v6 defaults for missing, corrupt, and non-object JSON', async () => {
    await withSettingsDirectory(async (root) => {
      const service = new AppSettingsService(root)
      expect((await service.read()).version).toBe(6)

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
        defaultNoteView: 'split',
        editorFontSize: 'large',
        locale: 'fr',
        density: 'dense',
        uiScale: 111,
        workbench: {
          activateOnClose: 'newest',
          whenClosingWithNoTabs: 'quit_app'
        }
      })
      const invalid = await service.read()
      expect(invalid.theme).toBe('system')
      expect(invalid.fileTreeSort).toBe('name')
      expect(invalid.defaultNoteView).toBe('reading')
      expect(invalid.editorFontSize).toBe(DEFAULT_EDITOR_FONT_SIZE)
      expect(invalid.locale).toBe('system')
      expect(invalid.density).toBe('comfortable')
      expect(invalid.uiScale).toBe(110)
      expect(invalid.workbench.activateOnClose).toBe('history')
      expect(invalid.workbench.whenClosingWithNoTabs).toBe('keep_window_open')
      expect(invalid.pagePreview).toEqual({ enabled: true, requireModifier: false })

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
        defaultNoteView: 'source',
        editorFontSize: 18.5,
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
        locale: 'vi',
        density: 'compact',
        uiScale: 115,
        pagePreview: {
          enabled: false,
          requireModifier: true
        },
        workbench: {
          activateOnClose: 'left',
          whenClosingWithNoTabs: 'close_window'
        }
      })

      const persisted = await readFile(join(root, 'app-settings.json'), 'utf8')
      const files = await readdir(root)
      expect(snapshot.version).toBe(6)
      expect(snapshot.theme).toBe('dark')
      expect(snapshot.locale).toBe('vi')
      expect(snapshot.density).toBe('compact')
      expect(snapshot.uiScale).toBe(115)
      expect(snapshot.defaultNoteView).toBe('source')
      expect(snapshot.editorFontFamily).toBe('ibm-plex-mono')
      expect(snapshot.editorFontWeight).toBe('medium')
      expect(snapshot.editorLineHeight).toBe(1.5)
      expect(snapshot.editorLigatures).toBe(false)
      expect(snapshot.editorTabSize).toBe('4')
      expect(snapshot.editorNoteWordWrap).toBe('viewport')
      expect(snapshot.editorCodeWordWrap).toBe('bounded')
      expect(snapshot.editorWrapColumn).toBe(96)
      expect(snapshot.editorIndentGuides).toBe(false)
      expect(snapshot.editorWhitespace).toBe('all')
      expect(snapshot.editorRuler).toBe(false)
      expect(snapshot.workbench.activateOnClose).toBe('left')
      expect(snapshot.pagePreview).toEqual({ enabled: false, requireModifier: true })
      expect('lastVaultPath' in snapshot).toBe(false)
      expect(persisted).toContain('"version": 6')
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
        service.updateSettings({ locale: 'vi' }),
        service.updateSettings({ density: 'compact', uiScale: 120 }),
        service.setFileTreeSort('modified-desc'),
        service.setEditorFontSize(17),
        service.updateSettings({ defaultNoteView: 'live' }),
        service.updateSettings({ pagePreview: { requireModifier: true } }),
        service.setLastVaultPath(root),
        service.updateSettings({ workbench: { activateOnClose: 'right' } }),
        service.updateSettings({
          workbench: { whenClosingWithNoTabs: 'close_window' }
        }),
        service.updateSettings({ keymapOverrides: { 'file.open': ['Mod+O'] } })
      ])

      const settings = await service.read()
      expect(settings.theme).toBe('dark')
      expect(settings.locale).toBe('vi')
      expect(settings.density).toBe('compact')
      expect(settings.uiScale).toBe(120)
      expect(settings.fileTreeSort).toBe('modified-desc')
      expect(settings.editorFontSize).toBe(17)
      expect(settings.defaultNoteView).toBe('live')
      expect(settings.pagePreview).toEqual({ enabled: true, requireModifier: true })
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
