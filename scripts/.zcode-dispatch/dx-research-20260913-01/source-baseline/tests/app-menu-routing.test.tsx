import { describe, expect, test } from 'bun:test'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'

import type { CommandAction, CommandActionRegistry } from '../src/renderer/src/commands/actions'
import { AppMenuBar } from '../src/renderer/src/components/AppMenuBar'
import {
  formatKeyBinding,
  getEffectiveBindings,
  type KeymapOverrides
} from '../src/shared/keybindings'

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

  test('shows the effective custom binding and hides the shortcut when the action is unbound', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { windowApi: { platform: 'win32' } }
    })

    try {
      const customMenu = createMenu(createFileOpenRegistry({ 'file.open': ['Alt+O'] }))
      expect(findMenuItem(customMenu, 'Open File…')?.props.shortcut).toBe('Alt+O')

      const unboundMenu = createMenu(createFileOpenRegistry({ 'file.open': [] }))
      expect(findMenuItem(unboundMenu, 'Open File…')?.props.shortcut).toBeUndefined()
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  test('routes Global Graph through the shared action registry', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const dispatched: string[] = []
    const graphAction: CommandAction = {
      id: 'graph.open-global',
      title: 'Open Global Graph',
      description: 'Open the graph.',
      category: 'Navigation',
      hotkeys: [],
      disabled: false,
      run: () => undefined
    }
    const commandActions: CommandActionRegistry = {
      actions: [graphAction],
      dispatch: async (actionId) => {
        dispatched.push(actionId)
        return true
      },
      getAction: (actionId) => (actionId === graphAction.id ? graphAction : undefined),
      isEnabled: () => true
    }
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { windowApi: { platform: 'win32' } }
    })

    try {
      const graphItem = findMenuItem(createMenu(commandActions), 'Open Global Graph')
      expect(graphItem?.props.disabled).toBe(false)
      graphItem?.props.onSelect()
      expect(dispatched).toEqual(['graph.open-global'])
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })
})

function createFileOpenRegistry(overrides: KeymapOverrides): CommandActionRegistry {
  const hotkeys = getEffectiveBindings('file.open', 'win32', overrides)
    .map((binding) => formatKeyBinding(binding, 'win32'))
    .filter((binding): binding is string => binding !== null)
  const action: CommandAction = {
    id: 'file.open',
    title: 'Open File…',
    description: 'Open a file from the vault.',
    category: 'Files',
    hotkeys,
    run: () => undefined
  }

  return {
    actions: [action],
    dispatch: async () => true,
    getAction: (actionId) => (actionId === action.id ? action : undefined),
    isEnabled: () => true
  }
}

function createMenu(commandActions: CommandActionRegistry): ReactElement {
  return AppMenuBar({
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
}

function findMenuItem(
  node: ReactNode,
  label: string
): ReactElement<{
  label: string
  shortcut?: string
  disabled?: boolean
  onSelect: () => void
}> | null {
  if (!isValidElement(node)) {
    return null
  }

  const props = node.props as { children?: ReactNode; label?: unknown; onSelect?: unknown }
  if (props.label === label && typeof props.onSelect === 'function') {
    return node as ReactElement<{
      label: string
      shortcut?: string
      disabled?: boolean
      onSelect: () => void
    }>
  }

  for (const child of Children.toArray(props.children)) {
    const match = findMenuItem(child, label)
    if (match) {
      return match
    }
  }

  return null
}
