import { describe, expect, test } from 'bun:test'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { resolveSourceEditorPreferences } from '../src/renderer/src/editor/editor-preferences-context'
import {
  createSourceEditorPreferenceExtensions,
  sourceDocumentKindForMdxDisplayMode
} from '../src/renderer/src/editor/source-editor-extensions'
import { DEFAULT_APP_SETTINGS_SNAPSHOT } from '../src/shared/app-settings'

describe('Source editor preferences', () => {
  test('resolves the persisted defaults into engine values', () => {
    expect(resolveSourceEditorPreferences(DEFAULT_APP_SETTINGS_SNAPSHOT)).toEqual({
      fontFamily: 'jetbrains-mono',
      fontSize: 15,
      fontWeight: 400,
      lineHeight: 1.6,
      ligatures: true,
      tabSize: 2,
      noteWordWrap: 'bounded',
      codeWordWrap: 'off',
      wrapColumn: 88,
      indentGuides: true,
      showWhitespace: false,
      showRuler: true
    })
  })

  test('keeps note wrapping bounded while code preserves horizontal structure', () => {
    const preferences = resolveSourceEditorPreferences(DEFAULT_APP_SETTINGS_SNAPSHOT)
    const noteState = EditorState.create({
      extensions: [createSourceEditorPreferenceExtensions('note', preferences)]
    })
    const codeState = EditorState.create({
      extensions: [createSourceEditorPreferenceExtensions('code', preferences)]
    })

    expect(noteState.facet(EditorState.tabSize)).toBe(2)
    expect(readAttributeClass(noteState, EditorView.editorAttributes)).toContain('cm-wrap-bounded')
    expect(readAttributeClass(noteState, EditorView.contentAttributes)).toContain('cm-lineWrapping')
    expect(readAttributeClass(codeState, EditorView.editorAttributes)).toContain('cm-wrap-off')
    expect(readAttributeClass(codeState, EditorView.contentAttributes)).not.toContain(
      'cm-lineWrapping'
    )
  })

  test('treats raw MDX Source as code and reserves note wrapping for Live mode', () => {
    expect(sourceDocumentKindForMdxDisplayMode('source')).toBe('code')
    expect(sourceDocumentKindForMdxDisplayMode('live')).toBe('note')
  })
})

function readAttributeClass(
  state: EditorState,
  facet: typeof EditorView.editorAttributes | typeof EditorView.contentAttributes
): string {
  return state
    .facet(facet)
    .map((attributes) => attributes.class ?? '')
    .join(' ')
}
