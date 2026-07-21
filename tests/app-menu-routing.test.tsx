import { describe, expect, test } from 'bun:test'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'

import type { CommandActionRegistry } from '../src/renderer/src/commands/actions'
import { AppMenuBar } from '../src/renderer/src/components/AppMenuBar'

describe('in-app menu action routing', () => {
  test('keeps Close Active Item available on macOS and dispatches the canonical action', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const dispatched: string[] = []
    const commandActions: CommandActionRegistry = {
      actions: [],
      dispatch: async (actionId) => {
        dispatched.push(actionId)
        return true
      },
      getAction: () => undefined,
      isEnabled: () => true
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { windowApi: { platform: 'darwin' } }
    })

    try {
      const menu = AppMenuBar({
        commandActions,
        selectedPath: null,
        viewMode: 'live',
        editorAvailable: false,
        isOpeningVault: false,
        isSaving: false,
        isDirty: false,
        leftPanelOpen: true,
        rightPanelOpen: true,
        aiPanelOpen: false,
        onRevealNote: () => undefined,
        onToggleRightPanel: () => undefined
      })
      const closeItem = findMenuItem(menu, 'Close Active Item')

      expect(closeItem).not.toBeNull()
      closeItem?.props.onSelect()
      expect(dispatched).toEqual(['workbench.close-item'])
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })
})

function findMenuItem(
  node: ReactNode,
  label: string
): ReactElement<{ label: string; onSelect: () => void }> | null {
  if (!isValidElement(node)) {
    return null
  }

  const props = node.props as { children?: ReactNode; label?: unknown; onSelect?: unknown }
  if (props.label === label && typeof props.onSelect === 'function') {
    return node as ReactElement<{ label: string; onSelect: () => void }>
  }

  for (const child of Children.toArray(props.children)) {
    const match = findMenuItem(child, label)
    if (match) {
      return match
    }
  }

  return null
}
