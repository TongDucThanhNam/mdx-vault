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
      'locale',
      'density',
      'uiScale',
      'fileTreeSort',
      'defaultNoteView',
      'editorFontSize',
      'editorFontFamily',
      'editorFontWeight',
      'editorLineHeight',
      'editorLigatures',
      'editorTabSize',
      'editorNoteWordWrap',
      'editorCodeWordWrap',
      'editorWrapColumn',
      'editorIndentGuides',
      'editorWhitespace',
      'editorRuler',
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
    expect(APP_SETTINGS_CATALOG.locale.defaultValue).toBe(DEFAULT_APP_SETTINGS_SNAPSHOT.locale)
    expect(APP_SETTINGS_CATALOG.density.defaultValue).toBe(DEFAULT_APP_SETTINGS_SNAPSHOT.density)
    expect(APP_SETTINGS_CATALOG.uiScale.defaultValue).toBe(DEFAULT_APP_SETTINGS_SNAPSHOT.uiScale)
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
    expect(APP_SETTINGS_CATALOG.locale.normalize('fr')).toBe('system')
    expect(APP_SETTINGS_CATALOG.density.normalize('dense')).toBe('comfortable')
    expect(APP_SETTINGS_CATALOG.uiScale.normalize(112)).toBe(110)
    expect(APP_SETTINGS_CATALOG.uiScale.normalize(500)).toBe(125)
    expect(APP_SETTINGS_CATALOG.fileTreeSort.normalize('size')).toBe('name')
    expect(APP_SETTINGS_CATALOG.defaultNoteView.normalize('split')).toBe('reading')
    expect(APP_SETTINGS_CATALOG.defaultNoteView.normalize('source')).toBe('source')
    expect(APP_SETTINGS_CATALOG.editorFontSize.normalize(8)).toBe(12)
    expect(APP_SETTINGS_CATALOG.editorFontSize.normalize(24)).toBe(20)
    expect(APP_SETTINGS_CATALOG.editorFontFamily.normalize('comic-sans')).toBe('jetbrains-mono')
    expect(APP_SETTINGS_CATALOG.editorFontFamily.normalize('jetbrains-mono')).toBe('jetbrains-mono')
    expect(APP_SETTINGS_CATALOG.editorFontFamily.normalize('maple-mono')).toBe('maple-mono')
    expect(APP_SETTINGS_CATALOG.editorFontWeight.normalize('bold')).toBe('regular')
    expect(APP_SETTINGS_CATALOG.editorLineHeight.normalize(0.5)).toBe(1.2)
    expect(APP_SETTINGS_CATALOG.editorLineHeight.normalize(2.5)).toBe(1.8)
    expect(APP_SETTINGS_CATALOG.editorTabSize.normalize('3')).toBe('2')
    expect(APP_SETTINGS_CATALOG.editorNoteWordWrap.normalize('column')).toBe('bounded')
    expect(APP_SETTINGS_CATALOG.editorWrapColumn.normalize(10)).toBe(60)
    expect(APP_SETTINGS_CATALOG.editorWrapColumn.normalize(300)).toBe(160)
    expect(APP_SETTINGS_CATALOG.editorWhitespace.normalize('selection')).toBe('none')
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
