import { EditorView } from '@codemirror/view'

export interface EditorViewSnapshot {
  anchor: number
  head: number
  scrollTop: number
  scrollLeft: number
}

export function captureActiveEditorView(): EditorViewSnapshot | null {
  const view = findActiveEditorView()

  if (!view) {
    return null
  }

  return {
    anchor: view.state.selection.main.anchor,
    head: view.state.selection.main.head,
    scrollTop: view.scrollDOM.scrollTop,
    scrollLeft: view.scrollDOM.scrollLeft
  }
}

export function restoreActiveEditorView(snapshot: EditorViewSnapshot | null): boolean {
  const view = findActiveEditorView()

  if (!view || !snapshot) {
    return false
  }

  const restored = clampEditorViewSnapshot(snapshot, view.state.doc.length)
  view.dispatch({ selection: { anchor: restored.anchor, head: restored.head } })
  const restoredState = view.state
  view.requestMeasure({
    read: () => null,
    write: () => {
      if (view.state !== restoredState || view.composing) return
      view.scrollDOM.scrollTop = restored.scrollTop
      view.scrollDOM.scrollLeft = restored.scrollLeft
    }
  })
  return true
}

export function clampEditorViewSnapshot(
  snapshot: EditorViewSnapshot,
  documentLength: number
): EditorViewSnapshot {
  const maximumPosition = Math.max(0, documentLength)

  return {
    anchor: clamp(snapshot.anchor, 0, maximumPosition),
    head: clamp(snapshot.head, 0, maximumPosition),
    scrollTop: Math.max(0, snapshot.scrollTop),
    scrollLeft: Math.max(0, snapshot.scrollLeft)
  }
}

function findActiveEditorView(): EditorView | null {
  const editorElement = document.querySelector<HTMLElement>(
    '[data-document-surface="active"] .cm-editor, .cm-editor'
  )
  return editorElement ? EditorView.findFromDOM(editorElement) : null
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
