import type { EditorState } from '@codemirror/state'

export function readEditorDocument(state: EditorState): string {
  return state.sliceDoc()
}
