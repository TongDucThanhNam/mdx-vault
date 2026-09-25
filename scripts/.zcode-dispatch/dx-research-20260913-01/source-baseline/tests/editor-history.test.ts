import { describe, expect, test } from 'bun:test'
import { redo, undo } from '@codemirror/commands'
import { EditorState, Transaction, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { sourceEditorSetup } from '../src/renderer/src/editor/source-editor-setup'

describe('CodeMirror editing history', () => {
  test('owned source editor setup preserves both undo and redo', () => {
    let state = EditorState.create({
      doc: 'alpha',
      extensions: [sourceEditorSetup]
    })
    const commandTarget = {
      get state() {
        return state
      },
      dispatch(input: Transaction | TransactionSpec) {
        state = input instanceof Transaction ? input.state : state.update(input).state
      }
    } as unknown as EditorView

    state = state.update({
      changes: { from: state.doc.length, insert: ' beta' },
      annotations: Transaction.userEvent.of('input.type')
    }).state
    expect(state.doc.toString()).toBe('alpha beta')

    expect(undo(commandTarget)).toBe(true)
    expect(state.doc.toString()).toBe('alpha')

    expect(redo(commandTarget)).toBe(true)
    expect(state.doc.toString()).toBe('alpha beta')
  })
})
