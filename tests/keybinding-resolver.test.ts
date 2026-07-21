import { describe, expect, test } from 'bun:test'
import {
  actionContextsOverlap,
  assignKeyBinding,
  findKeyBindingConflicts,
  formatKeyBinding,
  getEffectiveBindings,
  getKeyBindingSignature,
  getReservedKeyBindingReason,
  type KeyEventLike,
  type KeymapOverrides,
  keyBindingFromEvent,
  matchesKeyBinding,
  normalizeKeyBinding,
  removeKeyBinding,
  resetKeymapOverride,
  resolveKeyBinding,
  unbindAction,
  validateUserKeyBinding
} from '../src/shared/keybindings'
import type { KeybindingPlatform } from '../src/shared/workspace-actions'

function keyEvent(key: string, input: Partial<KeyEventLike> = {}): KeyEventLike {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    ...input
  }
}

describe('keybinding normalization and platform matching', () => {
  test('normalizes aliases, order, casing, and shifted punctuation', () => {
    expect(normalizeKeyBinding('shift+control+p')).toEqual({
      ok: true,
      binding: 'Ctrl+Shift+P'
    })
    expect(normalizeKeyBinding('command+option+Enter')).toEqual({
      ok: true,
      binding: 'Cmd+Alt+Enter'
    })
    expect(normalizeKeyBinding('Mod+Shift+]')).toEqual({ ok: true, binding: 'Mod+}' })
    expect(normalizeKeyBinding('mod+,')).toEqual({ ok: true, binding: 'Mod+,' })
  })

  test('rejects multi-stroke, modifier-only, duplicate, ambiguous, and unknown chords', () => {
    expect(normalizeKeyBinding('Ctrl+K Ctrl+P')).toMatchObject({
      ok: false,
      code: 'multi-stroke'
    })
    expect(normalizeKeyBinding('Ctrl')).toMatchObject({ ok: false, code: 'modifier-only' })
    expect(normalizeKeyBinding('Ctrl+Ctrl+P')).toMatchObject({
      ok: false,
      code: 'duplicate-modifier'
    })
    expect(normalizeKeyBinding('Mod+Ctrl+P')).toMatchObject({
      ok: false,
      code: 'ambiguous-modifier'
    })
    expect(normalizeKeyBinding('Hyper+P')).toMatchObject({
      ok: false,
      code: 'unknown-modifier'
    })
  })

  test('maps Mod to the platform primary modifier for both display and exact matching', () => {
    expect(formatKeyBinding('Mod+Shift+P', 'win32')).toBe('Ctrl+Shift+P')
    expect(formatKeyBinding('Mod+Shift+P', 'linux')).toBe('Ctrl+Shift+P')
    expect(formatKeyBinding('Mod+Shift+P', 'darwin')).toBe('Cmd+Shift+P')

    expect(matchesKeyBinding(keyEvent('p', { ctrlKey: true }), 'Mod+P', 'win32')).toBe(true)
    expect(matchesKeyBinding(keyEvent('p', { ctrlKey: true }), 'Mod+P', 'darwin')).toBe(false)
    expect(matchesKeyBinding(keyEvent('p', { metaKey: true }), 'Mod+P', 'darwin')).toBe(true)
  })

  test('requires an exact modifier set', () => {
    expect(
      matchesKeyBinding(keyEvent('p', { ctrlKey: true, shiftKey: true }), 'Mod+P', 'win32')
    ).toBe(false)
    expect(
      matchesKeyBinding(keyEvent('p', { ctrlKey: true, altKey: true }), 'Mod+P', 'win32')
    ).toBe(false)
    expect(matchesKeyBinding(keyEvent('p', { ctrlKey: true }), 'Mod+Shift+P', 'win32')).toBe(false)
  })

  test('matches and records macOS shifted-brace defaults without displaying an extra Shift', () => {
    const event = keyEvent('}', { metaKey: true, shiftKey: true })
    expect(matchesKeyBinding(event, 'Mod+}', 'darwin')).toBe(true)
    expect(formatKeyBinding('Mod+}', 'darwin')).toBe('Cmd+}')
    expect(keyBindingFromEvent(event, 'darwin')).toBe('Mod+}')
  })

  test('records Space and Plus using unambiguous canonical key names', () => {
    expect(keyBindingFromEvent(keyEvent(' ', { ctrlKey: true }), 'win32')).toBe('Mod+Space')
    expect(keyBindingFromEvent(keyEvent('+', { ctrlKey: true, shiftKey: true }), 'win32')).toBe(
      'Mod+Plus'
    )
    expect(
      matchesKeyBinding(keyEvent('+', { ctrlKey: true, shiftKey: true }), 'Mod+Plus', 'win32')
    ).toBe(true)
  })

  test('uses one effective signature for logical and physical equivalents', () => {
    expect(getKeyBindingSignature('Mod+P', 'win32')).toBe(getKeyBindingSignature('Ctrl+P', 'win32'))
    expect(getKeyBindingSignature('Mod+P', 'darwin')).toBe(
      getKeyBindingSignature('Cmd+P', 'darwin')
    )
    expect(getKeyBindingSignature('Ctrl+P', 'darwin')).not.toBe(
      getKeyBindingSignature('Cmd+P', 'darwin')
    )
  })
})

describe('keybinding resolution', () => {
  test('chooses the lower, more-specific active context', () => {
    const overrides: KeymapOverrides = {
      'file.open': ['Mod+K'],
      'insert.date': ['Mod+K']
    }
    const event = keyEvent('k', { ctrlKey: true })

    expect(
      resolveKeyBinding(event, {
        platform: 'win32',
        activeContexts: ['Editor', 'Workspace'],
        overrides
      })
    ).toMatchObject({ kind: 'dispatch', actionId: 'insert.date', preventDefault: true })

    expect(
      resolveKeyBinding(event, {
        platform: 'win32',
        activeContexts: ['Workspace'],
        overrides
      })
    ).toMatchObject({ kind: 'dispatch', actionId: 'file.open', preventDefault: true })
  })

  test('blocks background workbench actions in picker, settings, and dialog contexts', () => {
    const event = keyEvent('p', { ctrlKey: true })
    for (const context of ['Picker', 'Settings', 'Dialog'] as const) {
      expect(
        resolveKeyBinding(event, { platform: 'win32', activeContexts: [context] })
      ).toMatchObject({
        kind: 'guard',
        reason: 'modal-context',
        actionIds: ['file.open'],
        preventDefault: true
      })
    }
  })

  test('swallows modal Ctrl/Cmd+P and Ctrl/Cmd+W even when their actions are unbound or rebound', () => {
    const cases = [
      ['win32', keyEvent('p', { ctrlKey: true }), 'file.open'],
      ['win32', keyEvent('w', { ctrlKey: true }), 'workbench.close-item'],
      ['darwin', keyEvent('p', { metaKey: true }), 'file.open'],
      ['darwin', keyEvent('w', { metaKey: true }), 'workbench.close-item']
    ] as const

    for (const [platform, event, actionId] of cases) {
      for (const context of ['Picker', 'Settings', 'Dialog'] as const) {
        for (const overrides of [
          { [actionId]: [] },
          { [actionId]: [actionId === 'file.open' ? 'Alt+P' : 'Alt+W'] }
        ]) {
          expect(
            resolveKeyBinding(event, { platform, activeContexts: [context], overrides })
          ).toEqual({
            kind: 'guard',
            reason: 'modal-context',
            actionIds: [actionId],
            preventDefault: true
          })
        }
      }
    }
  })

  test('suspends ordinary dispatch while the key recorder owns focus', () => {
    expect(
      resolveKeyBinding(keyEvent('k', { ctrlKey: true }), {
        platform: 'win32',
        activeContexts: ['KeyRecorder', 'Settings']
      })
    ).toEqual({
      kind: 'guard',
      reason: 'key-recorder',
      actionIds: [],
      preventDefault: true
    })
  })

  test('leaves editing chords with inputs unless an explicit editor action owns them', () => {
    expect(
      resolveKeyBinding(keyEvent('v', { ctrlKey: true }), {
        platform: 'win32',
        activeContexts: ['Input', 'Workspace'],
        overrides: { 'file.open': ['Mod+V'] }
      })
    ).toEqual({ kind: 'none', reason: 'editor-owned', preventDefault: false })

    expect(
      resolveKeyBinding(keyEvent('v', { ctrlKey: true, shiftKey: true }), {
        platform: 'win32',
        activeContexts: ['Editor', 'Workspace']
      })
    ).toEqual({ kind: 'none', reason: 'no-match', preventDefault: false })

    expect(
      resolveKeyBinding(keyEvent('s', { ctrlKey: true }), {
        platform: 'win32',
        activeContexts: ['Input', 'Workspace']
      })
    ).toMatchObject({ kind: 'dispatch', actionId: 'file.save' })

    expect(
      resolveKeyBinding(keyEvent('v', { ctrlKey: true }), {
        platform: 'win32',
        activeContexts: ['Input', 'Settings'],
        overrides: { 'file.open': ['Mod+V'] }
      })
    ).toEqual({ kind: 'none', reason: 'editor-owned', preventDefault: false })
  })

  test('preserves editor and input navigation against arbitrary Workspace overrides', () => {
    const events = [
      keyEvent('ArrowLeft'),
      keyEvent('ArrowRight', { shiftKey: true }),
      keyEvent('Home'),
      keyEvent('End', { ctrlKey: true }),
      keyEvent('Backspace'),
      keyEvent('Delete', { altKey: true }),
      keyEvent('Enter'),
      keyEvent('Tab'),
      keyEvent('Tab', { shiftKey: true })
    ]

    for (const context of ['Editor', 'Input'] as const) {
      for (const event of events) {
        const binding = keyBindingFromEvent(event, 'win32')
        expect(binding).not.toBeNull()
        expect(
          resolveKeyBinding(event, {
            platform: 'win32',
            activeContexts: [context, 'Workspace'],
            overrides: { 'file.open': binding ? [binding] : [] }
          })
        ).toEqual({ kind: 'none', reason: 'editor-owned', preventDefault: false })
      }
    }
  })

  test('allows only the intended Ctrl+Tab workbench actions through editor ownership', () => {
    expect(
      resolveKeyBinding(keyEvent('Tab', { ctrlKey: true, repeat: true }), {
        platform: 'win32',
        activeContexts: ['Editor', 'Workspace']
      })
    ).toMatchObject({ kind: 'dispatch', actionId: 'workbench.mru-next' })

    expect(
      resolveKeyBinding(keyEvent('Tab', { ctrlKey: true }), {
        platform: 'win32',
        activeContexts: ['Editor', 'Workspace'],
        overrides: {
          'file.open': ['Ctrl+Tab'],
          'workbench.mru-next': []
        }
      })
    ).toEqual({ kind: 'none', reason: 'editor-owned', preventDefault: false })
  })

  test('leaves conflict-dialog focus and activation keys to native controls', () => {
    const cases = [
      [keyEvent('Tab'), 'Tab'],
      [keyEvent('Tab', { shiftKey: true }), 'Shift+Tab'],
      [keyEvent('Enter'), 'Enter'],
      [keyEvent(' '), 'Space']
    ] as const

    for (const [event, binding] of cases) {
      expect(
        resolveKeyBinding(event, {
          platform: 'win32',
          activeContexts: ['Dialog', 'Settings', 'Workspace'],
          overrides: { 'file.open': [binding] }
        })
      ).toEqual({ kind: 'none', reason: 'focused-control', preventDefault: false })
    }
  })

  test('ignores composition and guards unsafe repeats without dispatching', () => {
    expect(
      resolveKeyBinding(keyEvent('p', { ctrlKey: true, isComposing: true }), {
        platform: 'win32'
      })
    ).toEqual({ kind: 'none', reason: 'composition', preventDefault: false })

    expect(
      resolveKeyBinding(keyEvent('p', { ctrlKey: true, repeat: true }), {
        platform: 'win32'
      })
    ).toMatchObject({ kind: 'guard', reason: 'repeat', actionIds: ['file.open'] })

    expect(
      resolveKeyBinding(keyEvent('Tab', { ctrlKey: true, repeat: true }), {
        platform: 'win32'
      })
    ).toMatchObject({ kind: 'dispatch', actionId: 'workbench.mru-next' })
  })

  test('guards disabled application chords and does not prevent unmatched native behavior', () => {
    expect(
      resolveKeyBinding(keyEvent('p', { ctrlKey: true }), {
        platform: 'win32',
        isActionEnabled: () => false
      })
    ).toMatchObject({ kind: 'guard', reason: 'disabled', preventDefault: true })

    expect(resolveKeyBinding(keyEvent('g'), { platform: 'win32' })).toEqual({
      kind: 'none',
      reason: 'no-match',
      preventDefault: false
    })
  })

  test('guards corrupt same-context collisions instead of choosing silently', () => {
    const resolution = resolveKeyBinding(keyEvent('k', { ctrlKey: true }), {
      platform: 'win32',
      overrides: { 'file.open': ['Mod+K'], 'note.new': ['Mod+K'] }
    })
    expect(resolution).toMatchObject({
      kind: 'guard',
      reason: 'conflict',
      actionIds: ['note.new', 'file.open'],
      preventDefault: true
    })
  })
})

describe('keymap overrides and conflicts', () => {
  test('distinguishes missing defaults, explicit unbind, and reset', () => {
    expect(getEffectiveBindings('file.open', 'win32', {})).toEqual(['Mod+P'])
    expect(getEffectiveBindings('note.open', 'win32', { 'note.open': ['Alt+P'] })).toEqual([
      'Alt+P'
    ])

    const unbound = unbindAction({}, 'file.open')
    expect(getEffectiveBindings('file.open', 'win32', unbound)).toEqual([])

    const reset = resetKeymapOverride(unbound, 'note.open')
    expect(getEffectiveBindings('file.open', 'win32', reset)).toEqual(['Mod+P'])
    expect(reset).not.toHaveProperty('note.open')
    expect(reset).not.toHaveProperty('file.open')

    const migratedUnbind = unbindAction({ 'note.open': ['Alt+P'] }, 'note.open')
    expect(migratedUnbind).toEqual({ 'file.open': [] })
  })

  test('supports multiple alternatives, dedupes physical equivalents, and removes one chord', () => {
    const overrides = {
      'file.open': ['Mod+P', 'Ctrl+P', 'Alt+P']
    }
    expect(getEffectiveBindings('file.open', 'win32', overrides)).toEqual(['Mod+P', 'Alt+P'])
    expect(
      getEffectiveBindings(
        'file.open',
        'win32',
        removeKeyBinding(overrides, 'file.open', 'Ctrl+P', 'win32')
      )
    ).toEqual(['Alt+P'])
  })

  test('reports collisions and replaces the displaced binding atomically when confirmed', () => {
    const rejected = assignKeyBinding({}, 'note.new', 'Ctrl+P', 'win32')
    expect(rejected).toMatchObject({
      ok: false,
      code: 'conflict',
      conflicts: [{ actionId: 'file.open', binding: 'Mod+P' }]
    })

    const replaced = assignKeyBinding({}, 'note.new', 'Ctrl+P', 'win32', {
      replaceConflicts: true
    })
    expect(replaced.ok).toBe(true)
    if (!replaced.ok) return

    expect(replaced.displacedActionIds).toEqual(['file.open'])
    expect(getEffectiveBindings('file.open', 'win32', replaced.overrides)).toEqual([])
    expect(getEffectiveBindings('note.new', 'win32', replaced.overrides)).toEqual([
      'Mod+N',
      'Ctrl+P'
    ])
    expect(
      resolveKeyBinding(keyEvent('p', { ctrlKey: true }), {
        platform: 'win32',
        overrides: replaced.overrides
      })
    ).toMatchObject({ kind: 'dispatch', actionId: 'note.new' })
  })

  test('does not report collisions between disjoint fixed contexts', () => {
    expect(actionContextsOverlap('Workspace', 'Editor')).toBe(true)
    expect(actionContextsOverlap('Editor', 'Input')).toBe(true)
    expect(actionContextsOverlap('Editor', 'Explorer')).toBe(false)
    expect(actionContextsOverlap('Workspace', 'Dialog')).toBe(false)

    expect(findKeyBindingConflicts('insert.date', 'Mod+K', 'win32', {})).toEqual([])
  })
})

describe('reserved and recorder chord policy', () => {
  test('rejects Electron development and reload chords on every platform', () => {
    for (const platform of ['win32', 'linux', 'darwin'] as const) {
      expect(getReservedKeyBindingReason('F12', platform)?.code).toBe('devtools')
      expect(getReservedKeyBindingReason('Mod+R', platform)?.code).toBe('reload')
      expect(getReservedKeyBindingReason('Mod+Shift+R', platform)?.code).toBe('reload')
    }
  })

  test('rejects every physical modifier family consumed by electron-toolkit', () => {
    const cases = [
      ['Ctrl+Alt+R', 'win32', 'reload'],
      ['Ctrl+R', 'darwin', 'reload'],
      ['Ctrl+Shift+I', 'darwin', 'devtools'],
      ['Shift+F12', 'win32', 'devtools']
    ] as const

    for (const [binding, platform, code] of cases) {
      expect(getReservedKeyBindingReason(binding, platform)?.code).toBe(code)
      expect(validateUserKeyBinding(binding, platform, 'file.open')).toMatchObject({
        ok: false,
        code: 'reserved',
        reserved: { code }
      })
    }
  })

  test('rejects platform-native close, quit, hide, and minimize chords', () => {
    expect(getReservedKeyBindingReason('Alt+F4', 'win32')?.code).toBe('native-window-close')
    expect(getReservedKeyBindingReason('Cmd+Q', 'darwin')?.code).toBe('quit-application')
    expect(getReservedKeyBindingReason('Cmd+H', 'darwin')?.code).toBe('hide-application')
    expect(getReservedKeyBindingReason('Cmd+Alt+H', 'darwin')?.code).toBe('hide-application')
    expect(getReservedKeyBindingReason('Cmd+M', 'darwin')?.code).toBe('minimize-window')
  })

  test('reserves every macOS Edit-menu chord against arbitrary application actions', () => {
    for (const binding of [
      'Cmd+Z',
      'Cmd+Shift+Z',
      'Cmd+X',
      'Cmd+C',
      'Cmd+V',
      'Cmd+Shift+V',
      'Cmd+A'
    ]) {
      expect(getReservedKeyBindingReason(binding, 'darwin')?.code).toBe('native-edit')
      expect(validateUserKeyBinding(binding, 'darwin', 'file.open')).toMatchObject({
        ok: false,
        code: 'reserved',
        reserved: { code: 'native-edit' }
      })
    }
  })

  test('allows Cmd+W only for the routed Close Active Item action', () => {
    expect(getReservedKeyBindingReason('Cmd+W', 'darwin')?.code).toBe('native-window-close')
    expect(getReservedKeyBindingReason('Cmd+W', 'darwin', 'file.open')?.code).toBe(
      'native-window-close'
    )
    expect(getReservedKeyBindingReason('Cmd+W', 'darwin', 'workbench.close-item')).toBeNull()
  })

  test('rejects recorder controls and unsafe unmodified printable keys with clear reasons', () => {
    expect(validateUserKeyBinding('P', 'win32')).toMatchObject({
      ok: false,
      code: 'unsafe-unmodified-printable'
    })
    expect(validateUserKeyBinding('Shift+P', 'win32')).toMatchObject({
      ok: false,
      code: 'unsafe-unmodified-printable'
    })
    expect(validateUserKeyBinding('Escape', 'win32')).toMatchObject({
      ok: false,
      code: 'recorder-control'
    })
    expect(validateUserKeyBinding('Shift', 'win32')).toMatchObject({
      ok: false,
      code: 'modifier-only'
    })
    expect(validateUserKeyBinding('F12', 'win32')).toMatchObject({
      ok: false,
      code: 'reserved',
      reserved: { code: 'devtools' }
    })
    expect(validateUserKeyBinding('F1', 'win32')).toEqual({ ok: true, binding: 'F1' })
  })

  test('records primary modifiers portably on all supported platforms', () => {
    const cases: Array<[KeybindingPlatform, KeyEventLike, string]> = [
      ['win32', keyEvent('p', { ctrlKey: true }), 'Mod+P'],
      ['linux', keyEvent('p', { ctrlKey: true }), 'Mod+P'],
      ['darwin', keyEvent('p', { metaKey: true }), 'Mod+P'],
      ['darwin', keyEvent('Tab', { ctrlKey: true }), 'Ctrl+Tab']
    ]
    for (const [platform, event, expected] of cases) {
      expect(keyBindingFromEvent(event, platform)).toBe(expected)
    }
  })
})
