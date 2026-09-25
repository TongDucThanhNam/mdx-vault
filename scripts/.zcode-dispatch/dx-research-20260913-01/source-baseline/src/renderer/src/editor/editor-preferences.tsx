import { type ReactNode, useLayoutEffect, useMemo } from 'react'
import type { AppSettingsPatch, AppSettingsSnapshot } from '../../../shared/app-settings'
import {
  EditorAppearanceControlsContext,
  resolveSourceEditorPreferences,
  SOURCE_EDITOR_FONT_STACKS,
  SourceEditorPreferencesContext
} from './editor-preferences-context'

export function SourceEditorPreferencesProvider({
  settings,
  onChange,
  isPending,
  children
}: {
  settings: AppSettingsSnapshot
  onChange: (patch: AppSettingsPatch) => Promise<unknown>
  isPending: boolean
  children: ReactNode
}): React.JSX.Element {
  const preferences = useMemo(() => resolveSourceEditorPreferences(settings), [settings])
  const controls = useMemo(() => ({ update: onChange, pending: isPending }), [onChange, isPending])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.setProperty(
      '--editor-font-family',
      SOURCE_EDITOR_FONT_STACKS[preferences.fontFamily]
    )
    root.style.setProperty('--editor-font-size', `${preferences.fontSize}px`)
    root.style.setProperty('--editor-font-weight', String(preferences.fontWeight))
    root.style.setProperty('--editor-line-height', String(preferences.lineHeight))
    root.style.setProperty('--editor-tab-size', String(preferences.tabSize))
    root.style.setProperty('--editor-wrap-column', String(preferences.wrapColumn))
    root.dataset.editorFont = preferences.fontFamily

    return () => {
      root.style.removeProperty('--editor-font-family')
      root.style.removeProperty('--editor-font-size')
      root.style.removeProperty('--editor-font-weight')
      root.style.removeProperty('--editor-line-height')
      root.style.removeProperty('--editor-tab-size')
      root.style.removeProperty('--editor-wrap-column')
      delete root.dataset.editorFont
    }
  }, [preferences])

  return (
    <SourceEditorPreferencesContext.Provider value={preferences}>
      <EditorAppearanceControlsContext.Provider value={controls}>
        {children}
      </EditorAppearanceControlsContext.Provider>
    </SourceEditorPreferencesContext.Provider>
  )
}
