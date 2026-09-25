import type { EditorView } from '@codemirror/view'

export interface EditorSelectionSnapshot {
  /** UTF-16 document offset where the primary selection starts. */
  from: number
  /** UTF-16 document offset where the primary selection ends. */
  to: number
  /** UTF-16 document offset of the primary cursor head. */
  head: number
  /** 1-based line containing the primary cursor head. */
  headLine: number
  /** 0-based column containing the primary cursor head. */
  headColumn: number
  /** True when the selection is non-empty. */
  hasSelection: boolean
  /** 1-based line where the selection starts. */
  startLine: number
  /** 0-based column where the selection starts. */
  startColumn: number
  /** 1-based line where the selection ends. */
  endLine: number
  /** 0-based column where the selection ends. */
  endColumn: number
  /** Exact text inside the primary selection. */
  text: string
}

export function buildEditorSelectionSnapshot(
  view: Pick<EditorView, 'state'>
): EditorSelectionSnapshot {
  const selection = view.state.selection.main
  const startLineInfo = view.state.doc.lineAt(selection.from)
  const endLineInfo = view.state.doc.lineAt(selection.to)
  const headLineInfo = view.state.doc.lineAt(selection.head)

  return {
    from: selection.from,
    to: selection.to,
    head: selection.head,
    headLine: headLineInfo.number,
    headColumn: Math.max(0, selection.head - headLineInfo.from),
    hasSelection: !selection.empty,
    startLine: startLineInfo.number,
    startColumn: Math.max(0, selection.from - startLineInfo.from),
    endLine: endLineInfo.number,
    endColumn: Math.max(0, selection.to - endLineInfo.from),
    text: view.state.sliceDoc(selection.from, selection.to)
  }
}
