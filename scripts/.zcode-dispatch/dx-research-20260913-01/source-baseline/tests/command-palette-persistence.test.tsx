import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { CommandAction } from '../src/renderer/src/commands/actions'
import { CommandPalette } from '../src/renderer/src/commands/CommandPalette'

const STORAGE_KEY = 'mdx-vault.command-palette.v1'

describe('command palette persistence migration', () => {
  test('loads legacy action IDs as canonical pinned and recent commands without dropping current IDs', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    let persistedState = JSON.stringify({
      pinnedActionIds: ['note.open', 'workbench.close-item'],
      recentActionIds: []
    })

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => (key === STORAGE_KEY ? persistedState : null),
          setItem: () => undefined
        }
      }
    })

    try {
      const pinnedMarkup = renderPalette()
      const openIndex = pinnedMarkup.indexOf('Open File')
      const closeIndex = pinnedMarkup.indexOf('Close Active Item')

      expect(openIndex).toBeGreaterThan(-1)
      expect(closeIndex).toBeGreaterThan(openIndex)
      expect(getCommandMarkup(pinnedMarkup, 'Open File')).toContain('Pinned')
      expect(getCommandMarkup(pinnedMarkup, 'Close Active Item')).toContain('Pinned')

      persistedState = JSON.stringify({
        pinnedActionIds: [],
        recentActionIds: ['note.open', 'file.open', 'workbench.reopen-closed']
      })

      const recentMarkup = renderPalette()
      const recentOpenIndex = recentMarkup.indexOf('Open File')
      const reopenIndex = recentMarkup.indexOf('Reopen Closed Item')

      expect(recentOpenIndex).toBeGreaterThan(-1)
      expect(reopenIndex).toBeGreaterThan(recentOpenIndex)
      expect(getCommandMarkup(recentMarkup, 'Open File')).toContain('Recent')
      expect(getCommandMarkup(recentMarkup, 'Reopen Closed Item')).toContain('Recent')
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow)
      } else {
        Reflect.deleteProperty(globalThis, 'window')
      }
    }
  })
})

function renderPalette(): string {
  return renderToStaticMarkup(
    <CommandPalette
      open={true}
      actions={COMMANDS}
      onOpenChange={() => undefined}
      onComplete={() => undefined}
      onError={() => undefined}
    />
  )
}

function getCommandMarkup(markup: string, title: string): string {
  const titleIndex = markup.indexOf(title)
  const rowEnd = markup.indexOf('</div>', titleIndex)
  return markup.slice(titleIndex, rowEnd)
}

const COMMANDS: CommandAction[] = [
  {
    id: 'workbench.reopen-closed',
    title: 'Reopen Closed Item',
    description: 'Reopen the most recently closed item.',
    category: 'Workbench',
    disabled: false,
    run: () => true
  },
  {
    id: 'workbench.close-item',
    title: 'Close Active Item',
    description: 'Close the active item.',
    category: 'Workbench',
    disabled: false,
    run: () => true
  },
  {
    id: 'file.open',
    title: 'Open File',
    description: 'Open a file.',
    category: 'File',
    disabled: false,
    run: () => true
  }
]
