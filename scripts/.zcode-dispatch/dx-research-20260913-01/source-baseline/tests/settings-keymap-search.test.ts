import { describe, expect, test } from 'bun:test'
import {
  actionMatchesKeymapQuery,
  keymapMatchesQuery
} from '../src/renderer/src/settings/keymap-search'
import { getWorkspaceActionDefinition } from '../src/shared/workspace-actions'

describe('Settings keymap search', () => {
  test('matches action names, categories, and multi-term descriptions', () => {
    expect(keymapMatchesQuery('open file', 'win32', {})).toBe(true)
    expect(keymapMatchesQuery('workbench close', 'win32', {})).toBe(true)
    expect(keymapMatchesQuery('navigation explorer', 'win32', {})).toBe(true)
  })

  test('matches effective platform labels', () => {
    expect(keymapMatchesQuery('Ctrl+P', 'win32', {})).toBe(true)
    expect(keymapMatchesQuery('Cmd+P', 'darwin', {})).toBe(true)
  })

  test('searches the live override snapshot, including custom bindings', () => {
    const overrides = { 'file.open': ['Mod+Alt+O'] }
    const fileOpen = getWorkspaceActionDefinition('file.open')!

    expect(keymapMatchesQuery('Ctrl+Alt+O', 'win32', overrides)).toBe(true)
    expect(actionMatchesKeymapQuery(fileOpen, 'ctrl+p', 'win32', overrides)).toBe(false)
  })
})
