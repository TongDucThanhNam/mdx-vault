import { EditorView } from '@codemirror/view'
import { openFindOnly, openReplace } from './find-replace-panel'
import { createMarkdownFormattingTransaction } from './markdown-formatting'

export function runEditorPaletteAction(action: 'find' | 'replace' | 'highlight'): boolean {
  const host = Array.from(
    document.querySelectorAll<HTMLElement>('[data-document-surface] .cm-editor')
  ).find((element) => element.getClientRects().length > 0)
  const view = host ? EditorView.findFromDOM(host) : null
  if (!view) return false
  if (action === 'find') return openFindOnly(view)
  if (action === 'replace') return openReplace(view)
  view.dispatch(createMarkdownFormattingTransaction(view.state, 'highlight'))
  view.focus()
  return true
}
