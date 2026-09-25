import { createContext, useContext } from 'react'
import type {
  AppSettingsPatch,
  AppSettingsSnapshot,
  EditorFontFamilySetting,
  EditorWordWrapSetting
} from '../../../shared/app-settings'
import { DEFAULT_APP_SETTINGS_SNAPSHOT } from '../../../shared/app-settings'

export interface SourceEditorPreferences {
  fontFamily: EditorFontFamilySetting
  fontSize: number
  fontWeight: 400 | 500
  lineHeight: number
  ligatures: boolean
  tabSize: number
  noteWordWrap: EditorWordWrapSetting
  codeWordWrap: EditorWordWrapSetting
  wrapColumn: number
  indentGuides: boolean
  showWhitespace: boolean
  showRuler: boolean
}

export const SOURCE_EDITOR_FONT_STACKS: Readonly<Record<EditorFontFamilySetting, string>> = {
  'jetbrains-mono': "'JetBrains Mono', 'IBM Plex Mono', 'Cascadia Mono', ui-monospace, monospace",
  'maple-mono': "'Maple Mono', 'IBM Plex Mono', 'Cascadia Mono', ui-monospace, monospace",
  'ibm-plex-mono': "'IBM Plex Mono', 'Cascadia Mono', ui-monospace, monospace",
  'system-mono': "'Cascadia Mono', 'SFMono-Regular', Consolas, ui-monospace, monospace"
}

export const DEFAULT_SOURCE_EDITOR_PREFERENCES = resolveSourceEditorPreferences(
  DEFAULT_APP_SETTINGS_SNAPSHOT
)

export const SourceEditorPreferencesContext = createContext<SourceEditorPreferences>(
  DEFAULT_SOURCE_EDITOR_PREFERENCES
)

export const EditorAppearanceControlsContext = createContext<{
  update: (patch: AppSettingsPatch) => Promise<unknown>
  pending: boolean
} | null>(null)

export function useSourceEditorPreferences(): SourceEditorPreferences {
  return useContext(SourceEditorPreferencesContext)
}

export function resolveSourceEditorPreferences(
  settings: AppSettingsSnapshot
): SourceEditorPreferences {
  return {
    fontFamily: settings.editorFontFamily,
    fontSize: settings.editorFontSize,
    fontWeight: settings.editorFontWeight === 'medium' ? 500 : 400,
    lineHeight: settings.editorLineHeight,
    ligatures: settings.editorLigatures,
    tabSize: Number(settings.editorTabSize),
    noteWordWrap: settings.editorNoteWordWrap,
    codeWordWrap: settings.editorCodeWordWrap,
    wrapColumn: settings.editorWrapColumn,
    indentGuides: settings.editorIndentGuides,
    showWhitespace: settings.editorWhitespace === 'all',
    showRuler: settings.editorRuler
  }
}
