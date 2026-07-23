import { describe, expect, test } from 'bun:test'
import {
  APP_SETTINGS_CATALOG,
  APP_SETTINGS_DEFINITIONS,
  appSettingSearchText,
  DEFAULT_APP_SETTINGS_SNAPSHOT,
  normalizeKeymapOverrides
} from '../src/shared/app-settings'

describe('non-secret app settings catalog', () => {
  test('defines every renderer-visible setting with reset and searchable metadata', () => {
    expect(APP_SETTINGS_DEFINITIONS.map((definition) => definition.key)).toEqual([
      'theme',
      'fileTreeSort',
      'defaultNoteView',
      'editorFontSize',
      'pagePreview.enabled',
      'pagePreview.requireModifier',
      'workbench.activateOnClose',
      'workbench.whenClosingWithNoTabs',
      'keymapOverrides'
    ])
    expect(APP_SETTINGS_CATALOG.activateOnClose.defaultValue).toBe(
      DEFAULT_APP_SETTINGS_SNAPSHOT.workbench.activateOnClose
    )
    expect(APP_SETTINGS_CATALOG.whenClosingWithNoTabs.defaultValue).toBe(
      DEFAULT_APP_SETTINGS_SNAPSHOT.workbench.whenClosingWithNoTabs
    )
    expect(APP_SETTINGS_CATALOG.defaultNoteView.defaultValue).toBe(
      DEFAULT_APP_SETTINGS_SNAPSHOT.defaultNoteView
    )
    expect(DEFAULT_APP_SETTINGS_SNAPSHOT.pagePreview).toEqual({
      enabled: true,
      requireModifier: false
    })

    const searchable = appSettingSearchText(APP_SETTINGS_DEFINITIONS)
    expect(searchable).toContain('workbench.activateOnClose')
    expect(searchable).toContain('Default view for new tabs')
    expect(searchable).toContain('Close window')
    expect(searchable).toContain('single-keystroke')
    expect(searchable).toContain('modifier')
  })

  test('catalog normalizers apply typed defaults and editor bounds', () => {
    expect(APP_SETTINGS_CATALOG.theme.normalize('neon')).toBe('system')
    expect(APP_SETTINGS_CATALOG.fileTreeSort.normalize('size')).toBe('name')
    expect(APP_SETTINGS_CATALOG.defaultNoteView.normalize('split')).toBe('reading')
    expect(APP_SETTINGS_CATALOG.defaultNoteView.normalize('source')).toBe('source')
    expect(APP_SETTINGS_CATALOG.editorFontSize.normalize(8)).toBe(12)
    expect(APP_SETTINGS_CATALOG.editorFontSize.normalize(24)).toBe(20)
    expect(APP_SETTINGS_CATALOG.pagePreviewEnabled.normalize('yes')).toBe(true)
    expect(APP_SETTINGS_CATALOG.pagePreviewRequireModifier.normalize('yes')).toBe(false)
    expect(APP_SETTINGS_CATALOG.activateOnClose.normalize('newest')).toBe('history')
    expect(APP_SETTINGS_CATALOG.whenClosingWithNoTabs.normalize('quit')).toBe('keep_window_open')
  })

  test('keymap normalization applies stable IDs, bounds, and platform reserved policy', () => {
    expect(
      normalizeKeymapOverrides(
        {
          'note.open': [' Mod+O ', 'Mod+O'],
          'settings.open': ['F12'],
          'unknown.action': ['Mod+U']
        },
        'win32'
      )
    ).toEqual({ 'file.open': ['Mod+O'] })

    expect(normalizeKeymapOverrides({ 'settings.open': ['Cmd+Q'] }, 'darwin')).toEqual({})
  })
})
