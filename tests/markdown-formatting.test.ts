import { describe, expect, test } from 'bun:test'
import { EditorState } from '@codemirror/state'
import {
  createMarkdownFormattingTransaction,
  type MarkdownFormat
} from '../src/renderer/src/editor/markdown-formatting'

function format(
  doc: string,
  anchor: number,
  head: number,
  markdownFormat: MarkdownFormat
): EditorState {
  const state = EditorState.create({
    doc,
    selection: { anchor, head }
  })
  return state.update(createMarkdownFormattingTransaction(state, markdownFormat)).state
}

describe('keyboard-first Markdown formatting', () => {
  test('wraps a selection and keeps the source text selected', () => {
    const state = format('alpha', 0, 5, 'bold')

    expect(state.doc.toString()).toBe('**alpha**')
    expect(state.selection.main).toMatchObject({ anchor: 2, head: 7 })
  })

  test('toggles surrounding markers without needing to select the markers', () => {
    const wrapped = format('alpha', 0, 5, 'highlight')
    const unwrapped = wrapped.update(
      createMarkdownFormattingTransaction(wrapped, 'highlight')
    ).state

    expect(wrapped.doc.toString()).toBe('==alpha==')
    expect(unwrapped.doc.toString()).toBe('alpha')
    expect(unwrapped.selection.main).toMatchObject({ anchor: 0, head: 5 })
  })

  test('inserts an empty formatting pair with the cursor between its markers', () => {
    const state = format('alpha ', 6, 6, 'inline-code')

    expect(state.doc.toString()).toBe('alpha ``')
    expect(state.selection.main).toMatchObject({ anchor: 7, head: 7 })
  })

  test('does not mistake bold markers for an italic toggle', () => {
    const state = format('**alpha**', 2, 7, 'italic')

    expect(state.doc.toString()).toBe('***alpha***')
    expect(state.selection.main).toMatchObject({ anchor: 3, head: 8 })
  })
})
