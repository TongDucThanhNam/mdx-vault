import { getActiveEditorView } from './active-editor-view'

export async function runEditorPaletteAction(
  action: 'find' | 'replace' | 'highlight'
): Promise<boolean> {
  const view = getActiveEditorView()
  if (!view) return false
  if (action === 'find' || action === 'replace') {
    const panel = await import('./find-replace-panel')
    if (getActiveEditorView() !== view) return false
    return action === 'find' ? panel.openFindOnly(view) : panel.openReplace(view)
  }
  const { createMarkdownFormattingTransaction } = await import('./markdown-formatting')
  if (getActiveEditorView() !== view) return false
  view.dispatch(createMarkdownFormattingTransaction(view.state, 'highlight'))
  view.focus()
  return true
}
