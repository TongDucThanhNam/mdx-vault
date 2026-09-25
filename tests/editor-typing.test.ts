import { describe, expect, test } from 'bun:test'
import { indentLess, insertNewlineAndIndent, undo } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import {
  EditorSelection,
  EditorState,
  StateEffect,
  Transaction,
  type TransactionSpec
} from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { insertSoftTab } from '../src/renderer/src/editor/editor-keymap'
import { DEFAULT_SOURCE_EDITOR_PREFERENCES } from '../src/renderer/src/editor/editor-preferences-context'
import { createSourceEditorPreferenceExtensions } from '../src/renderer/src/editor/source-editor-extensions'
import { sourceEditorSetup } from '../src/renderer/src/editor/source-editor-setup'

function editor(doc: string, selection: EditorSelection, tabSize = 4): EditorView {
  let state = EditorState.create({
    doc,
    selection,
    extensions: [
      sourceEditorSetup,
      javascript(),
      createSourceEditorPreferenceExtensions('code', {
        ...DEFAULT_SOURCE_EDITOR_PREFERENCES,
        tabSize
      })
    ]
  })
  return {
    get state() {
      return state
    },
    dispatch(input: Transaction | TransactionSpec) {
      state = input instanceof Transaction ? input.state : state.update(input).state
    }
  } as EditorView
}

describe('editor typing', () => {
  test('Tab inserts spaces at the caret, reaches the next stop, and undoes once', () => {
    const view = editor('alpha beta', EditorSelection.single(5))
    insertSoftTab(view)
    expect(view.state.doc.toString()).toBe('alpha    beta')
    expect(view.state.selection.main.head).toBe(8)
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('alpha beta')
    expect(view.state.selection.main.head).toBe(5)
  })

  test('Enter inside brackets uses the chosen indentation unit, not the default two', () => {
    const view = editor('function greet() {}', EditorSelection.single(18))
    insertNewlineAndIndent(view)
    expect(view.state.doc.toString()).toBe('function greet() {\n    \n}')
    expect(view.state.selection.main.head).toBe(23)
  })

  test('selected lines indent together by the chosen unit', () => {
    const view = editor('alpha\nbeta', EditorSelection.single(0, 10), 8)
    insertSoftTab(view)
    expect(view.state.doc.toString()).toBe('        alpha\n        beta')
    undo(view)
    expect(view.state.doc.toString()).toBe('alpha\nbeta')
  })

  test('multiple carets advance independently without changing the existing tab character', () => {
    const view = editor(
      'a\n\tb',
      EditorSelection.create([EditorSelection.cursor(1), EditorSelection.cursor(4)])
    )
    insertSoftTab(view)
    expect(view.state.doc.toString()).toBe('a   \n\tb   ')
    expect(view.state.selection.ranges.map((range) => range.head)).toEqual([4, 10])
    undo(view)
    expect(view.state.doc.toString()).toBe('a\n\tb')
  })

  test('Shift+Tab reverses a selected-line indent, and read-only buffers stay untouched', () => {
    const view = editor('    alpha\n    beta', EditorSelection.single(0, 18))
    expect(indentLess(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('alpha\nbeta')
    view.dispatch({ effects: StateEffect.appendConfig.of(EditorState.readOnly.of(true)) })
    expect(insertSoftTab(view)).toBe(false)
    expect(view.state.doc.toString()).toBe('alpha\nbeta')
  })
})
