import { EditorView } from '@codemirror/view'

export function focusActiveDocument(): void {
  const editorElement = document.querySelector<HTMLElement>(
    '[data-document-surface="active"] .cm-editor, .cm-editor'
  )
  const editorView = editorElement ? EditorView.findFromDOM(editorElement) : null

  if (editorView) {
    editorView.focus()
    return
  }

  const documentSurface = document.querySelector<HTMLElement>(
    '[data-document-surface="active"], [data-document-surface]'
  )

  if (documentSurface) {
    documentSurface.focus()
    return
  }

  document.querySelector<HTMLElement>('#workspace')?.focus()
}

export function focusElementOrDocument(element: HTMLElement | null): void {
  if (isRestorableElement(element)) {
    element.focus()
    return
  }

  focusActiveDocument()
}

export function focusExplorer(): void {
  const explorer = document.querySelector<HTMLElement>('[aria-label="Vault explorer"]')
  const selectedRow = explorer?.querySelector<HTMLElement>('[data-item-selected="true"]')
  const tree = explorer?.querySelector<HTMLElement>('[role="tree"], [aria-label="Vault files"]')
  ;(selectedRow ?? tree ?? explorer)?.focus()
}

export function isExplorerFocused(): boolean {
  const explorer = document.querySelector<HTMLElement>('[aria-label="Vault explorer"]')
  return Boolean(explorer?.contains(document.activeElement))
}

function isRestorableElement(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected) {
    return false
  }

  if ('disabled' in element && element.disabled === true) {
    return false
  }

  return element.getAttribute('aria-disabled') !== 'true'
}
