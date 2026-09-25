import { describe, expect, test } from 'bun:test'
import { EditorState } from '@codemirror/state'
import { buildEditorSelectionSnapshot } from '../src/renderer/src/editor/editor-selection'

describe('shared editor selection telemetry', () => {
  test('reports the primary head line and column independently from selection direction', () => {
    const state = EditorState.create({
      doc: 'one\ntwo\nthree',
      selection: { anchor: 10, head: 5 }
    })

    expect(buildEditorSelectionSnapshot({ state })).toEqual({
      from: 5,
      to: 10,
      head: 5,
      headLine: 2,
      headColumn: 1,
      hasSelection: true,
      startLine: 2,
      startColumn: 1,
      endLine: 3,
      endColumn: 2,
      text: 'wo\nth'
    })
  })
})
