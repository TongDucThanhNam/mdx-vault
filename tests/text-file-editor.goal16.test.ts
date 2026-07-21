import { describe, expect, test } from 'bun:test'
import { EditorState } from '@codemirror/state'

import { readEditorDocument } from '../src/renderer/src/editor/editor-document'

describe('GOAL-16 text editor document handling', () => {
  test('preserves CRLF when reading CodeMirror state', () => {
    const content = 'name,value\r\nalpha,1\r\n'
    const state = EditorState.create({
      doc: content,
      extensions: [EditorState.lineSeparator.of('\r\n')]
    })

    expect(readEditorDocument(state)).toBe(content)
  })
})
