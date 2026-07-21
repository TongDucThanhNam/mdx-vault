import { describe, expect, test } from 'bun:test'
import {
  deriveKeyboardContexts,
  type KeyboardContextState
} from '../src/renderer/src/input/keyboard-context'

const BASE_STATE: KeyboardContextState = {
  activeSurface: null,
  dialogOpen: false,
  keyRecorderActive: false,
  mruSwitchActive: false
}

describe('global keyboard context derivation', () => {
  test('keeps an active MRU session in Workspace when its aria-modal surface owns focus', () => {
    expect(deriveKeyboardContexts({ ...BASE_STATE, mruSwitchActive: true }, 'Dialog')).toEqual([
      'Workspace'
    ])
  })

  test('keeps focused input ownership inside Settings, pickers, and dialogs', () => {
    expect(deriveKeyboardContexts({ ...BASE_STATE, activeSurface: 'settings' }, 'Input')).toEqual([
      'Input',
      'Settings',
      'Workspace'
    ])
    expect(
      deriveKeyboardContexts({ ...BASE_STATE, activeSurface: 'file-finder' }, 'Input')
    ).toEqual(['Input', 'Picker', 'Workspace'])
    expect(deriveKeyboardContexts({ ...BASE_STATE, dialogOpen: true }, 'Input')).toEqual([
      'Input',
      'Dialog',
      'Workspace'
    ])
  })

  test('classifies a nested conflict confirmation as Dialog after recording stops', () => {
    expect(deriveKeyboardContexts({ ...BASE_STATE, activeSurface: 'settings' }, 'Dialog')).toEqual([
      'Dialog',
      'Settings',
      'Workspace'
    ])
    expect(
      deriveKeyboardContexts(
        { ...BASE_STATE, activeSurface: 'settings', keyRecorderActive: true },
        'Dialog'
      )
    ).toEqual(['KeyRecorder', 'Workspace'])
  })
})
