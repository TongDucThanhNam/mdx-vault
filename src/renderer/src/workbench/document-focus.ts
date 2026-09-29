import { EditorView } from '@codemirror/view'

export function focusActiveDocument(): void {
  const readingSurface = document.querySelector<HTMLElement>(
    '[data-document-surface="active"][data-reading-surface="active"]'
  )
  if (readingSurface) {
    readingSurface.focus()
    return
  }
  const editorElement = document.querySelector<HTMLElement>(
    '[data-document-surface="active"] .cm-editor'
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

/** Called after React has committed a mode change, not while the old surface is mounted. */
export function focusAfterViewModeSwitch(
  previousMode: string | null,
  nextMode: string,
  focus: () => void = focusActiveDocument
): void {
  if (previousMode !== null && previousMode !== nextMode) focus()
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
  const firstRow = explorer?.querySelector<HTMLElement>('[role="treeitem"]')
  ;(selectedRow ?? firstRow ?? explorer)?.focus()
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
