import { describe, expect, test } from 'bun:test'
import {
  CLOSE_ACTIVE_ITEM_ACTION_ID,
  getWindowShortcutPolicy,
  type NativeMenuItemSpec,
  WINDOW_SHORTCUT_WATCHER_OPTIONS
} from '../src/main/window-shortcut-policy'
import { getReservedKeyBindingReason } from '../src/shared/keybindings'
import { getDefaultBindings } from '../src/shared/workspace-actions'

function flattenRoles(items: readonly NativeMenuItemSpec[]): string[] {
  return items.flatMap((item) => {
    if (item.kind === 'role') return [item.role]
    if (item.kind === 'submenu') return flattenRoles(item.items)
    return []
  })
}

describe('native window shortcut policy', () => {
  test('keeps toolkit dev/reload guards while allowing renderer reading zoom chords', () => {
    expect(WINDOW_SHORTCUT_WATCHER_OPTIONS).toEqual({
      escToCloseWindow: false,
      zoom: true
    })
  })

  test('reserves the physical key families consumed by the toolkit watcher', () => {
    expect(getReservedKeyBindingReason('Ctrl+Alt+R', 'win32')?.code).toBe('reload')
    expect(getReservedKeyBindingReason('Ctrl+R', 'darwin')?.code).toBe('reload')
    expect(getReservedKeyBindingReason('Ctrl+Shift+I', 'darwin')?.code).toBe('devtools')
    expect(getReservedKeyBindingReason('Shift+F12', 'win32')?.code).toBe('devtools')
  })

  test('removes the application menu on Windows and Linux so it cannot steal workbench chords', () => {
    for (const platform of ['win32', 'linux'] as const) {
      const policy = getWindowShortcutPolicy(platform)
      expect(policy.applicationMenu).toEqual({ kind: 'none' })
      expect(policy.rendererCloseAction).toMatchObject({
        id: CLOSE_ACTIVE_ITEM_ACTION_ID,
        bindings: ['Mod+W', 'Ctrl+F4']
      })
      expect(policy.rendererCloseAction.bindings).toEqual(
        getDefaultBindings(CLOSE_ACTIVE_ITEM_ACTION_ID, platform)
      )
    }
  })

  test('retains standard macOS application/edit/window roles but installs no native close role', () => {
    const menu = getWindowShortcutPolicy('darwin').applicationMenu
    expect(menu.kind).toBe('template')
    if (menu.kind !== 'template') return

    const roles = flattenRoles(menu.items)
    expect(roles).toContain('appMenu')
    expect(roles).toContain('editMenu')
    expect(roles).toContain('minimize')
    expect(roles).toContain('zoom')
    expect(roles).toContain('front')
    expect(roles).not.toContain('close')
    expect(roles).not.toContain('closeWindow')
  })

  test('routes Cmd+W only to the registered Close Active Item action', () => {
    const policy = getWindowShortcutPolicy('darwin')
    expect(policy.rendererCloseAction).toMatchObject({
      id: CLOSE_ACTIVE_ITEM_ACTION_ID,
      bindings: ['Mod+W']
    })
    expect(policy.rendererCloseAction.bindings).toEqual(
      getDefaultBindings(CLOSE_ACTIVE_ITEM_ACTION_ID, 'darwin')
    )
    expect(policy.nativeChords).toContainEqual({
      binding: 'Cmd+W',
      code: 'native-window-close',
      message: 'Cmd+W is reserved for Close Active Item so it cannot close the native window.',
      disposition: 'renderer-routed',
      routedActionId: CLOSE_ACTIVE_ITEM_ACTION_ID
    })
    expect(getReservedKeyBindingReason('Cmd+W', 'darwin')).not.toBeNull()
    expect(getReservedKeyBindingReason('Cmd+W', 'darwin', CLOSE_ACTIVE_ITEM_ACTION_ID)).toBeNull()
  })

  test('expresses development, reload, OS-close, and macOS app-menu ownership explicitly', () => {
    for (const platform of ['win32', 'linux', 'darwin'] as const) {
      const nativeReserved = getWindowShortcutPolicy(platform).nativeChords.filter(
        (entry) => entry.disposition === 'native-reserved'
      )
      expect(nativeReserved).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ binding: 'F12', code: 'devtools' }),
          expect.objectContaining({ binding: 'Mod+R', code: 'reload' })
        ])
      )
    }

    for (const platform of ['win32', 'linux'] as const) {
      expect(getWindowShortcutPolicy(platform).nativeChords).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            binding: 'Alt+F4',
            code: 'native-window-close',
            disposition: 'native-reserved'
          })
        ])
      )
    }

    expect(getWindowShortcutPolicy('darwin').nativeChords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ binding: 'Cmd+Q', code: 'quit-application' }),
        expect.objectContaining({ binding: 'Cmd+H', code: 'hide-application' }),
        expect.objectContaining({ binding: 'Cmd+M', code: 'minimize-window' }),
        expect.objectContaining({ binding: 'Cmd+Z', code: 'native-edit' }),
        expect.objectContaining({ binding: 'Cmd+Shift+Z', code: 'native-edit' }),
        expect.objectContaining({ binding: 'Cmd+X', code: 'native-edit' }),
        expect.objectContaining({ binding: 'Cmd+C', code: 'native-edit' }),
        expect.objectContaining({ binding: 'Cmd+V', code: 'native-edit' }),
        expect.objectContaining({ binding: 'Cmd+Shift+V', code: 'native-edit' }),
        expect.objectContaining({ binding: 'Cmd+A', code: 'native-edit' })
      ])
    )
  })

  test('treats other Unix Electron targets like Linux instead of enabling a macOS menu', () => {
    expect(getWindowShortcutPolicy('freebsd')).toMatchObject({
      platform: 'linux',
      applicationMenu: { kind: 'none' }
    })
  })
})
