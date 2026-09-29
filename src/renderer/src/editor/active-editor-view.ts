import type { EditorView } from '@codemirror/view'

let activeView: EditorView | null = null

/** Editors register only while mounted; Reading never imports CodeMirror. */
export function registerActiveEditorView(view: EditorView): () => void {
  activeView = view
  return () => {
    if (activeView === view) activeView = null
  }
}

export function getActiveEditorView(): EditorView | null {
  return activeView?.dom.isConnected ? activeView : null
}
