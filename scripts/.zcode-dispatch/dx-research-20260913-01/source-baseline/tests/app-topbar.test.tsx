import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { CommandActionRegistry } from '../src/renderer/src/commands/actions'
import { AppTopBar } from '../src/renderer/src/components/AppTopBar'
import { openVaultFromTitlebar } from '../src/renderer/src/components/titlebar-actions'
import { I18nProvider } from '../src/renderer/src/i18n/I18nProvider'

describe('GOAL-30 compact titlebar', () => {
  test('rests as one main-menu trigger beside the active vault selector', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { windowApi: { platform: 'darwin' } }
    })

    try {
      const markup = renderToStaticMarkup(
        createElement(
          I18nProvider,
          { locale: 'en' },
          createElement(AppTopBar, {
            vaultName: 'mdx_terasumi',
            selectedPath: null,
            viewMode: 'source',
            commandActions: createRegistry(),
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
        )
      )

      expect(markup).toContain('aria-label="Main menu"')
      expect(markup).toContain('aria-label="Switch vault: mdx_terasumi"')
      expect(markup).toContain('mdx_terasumi')
      expect(markup).not.toContain('mdx vault')
      expect(markup).not.toContain('>File<')
      expect(markup).not.toContain('>Edit<')
      expect(markup).not.toContain('>View<')
      expect(markup).not.toContain('>Go<')
      expect(markup).not.toContain('>Window<')
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })

  test('routes the vault selector through the canonical vault action', async () => {
    const dispatched: string[] = []
    const commandActions = createRegistry(async (actionId) => {
      dispatched.push(actionId)
      return true
    })

    expect(await openVaultFromTitlebar(commandActions)).toBe(true)
    expect(dispatched).toEqual(['vault.open'])
  })
})

function createRegistry(
  dispatch: CommandActionRegistry['dispatch'] = async () => true
): CommandActionRegistry {
  return {
    actions: [],
    dispatch,
    getAction: () => undefined,
    isEnabled: () => true
  }
}
