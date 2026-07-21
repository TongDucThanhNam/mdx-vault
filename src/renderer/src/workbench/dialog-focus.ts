import type { KeyboardEvent } from 'react'

const TABBABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

/**
 * Keeps keyboard focus inside the custom workbench overlays. Radix-backed
 * dialogs already provide this behavior; finder/palette/search surfaces use
 * this small shared guard so their listbox implementations can remain native.
 */
export function containDialogTabKey(
  event: KeyboardEvent<HTMLElement>,
  container: HTMLElement
): void {
  if (event.key !== 'Tab' || event.defaultPrevented) {
    return
  }

  const tabbableElements = Array.from(
    container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)
  ).filter(isTabbable)
  const activeElement = document.activeElement

  if (tabbableElements.length === 0) {
    event.preventDefault()
    if (!(activeElement instanceof Node) || !container.contains(activeElement)) {
      container.focus({ preventScroll: true })
    }
    return
  }

  const first = tabbableElements[0]
  const last = tabbableElements[tabbableElements.length - 1]
  const focusIsInside = activeElement instanceof Node && container.contains(activeElement)

  if (!focusIsInside || (event.shiftKey && activeElement === first)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
    return
  }

  if (!event.shiftKey && activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function isTabbable(element: HTMLElement): boolean {
  return (
    element.tabIndex >= 0 &&
    element.getAttribute('aria-hidden') !== 'true' &&
    !element.closest('[hidden], [inert]')
  )
}
