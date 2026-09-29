import { expect, test } from 'bun:test'
import type { EditorView } from '@codemirror/view'
import {
  getActiveEditorView,
  registerActiveEditorView
} from '../src/renderer/src/editor/active-editor-view'

test('active editor registry ignores stale cleanup and disconnected views', () => {
  const first = { dom: { isConnected: true } } as EditorView
  const secondDom = { isConnected: true }
  const second = { dom: secondDom } as EditorView
  const releaseFirst = registerActiveEditorView(first)
  const releaseSecond = registerActiveEditorView(second)
  releaseFirst()
  expect(getActiveEditorView()).toBe(second)
  secondDom.isConnected = false
  expect(getActiveEditorView()).toBeNull()
  releaseSecond()
  expect(getActiveEditorView()).toBeNull()
})
