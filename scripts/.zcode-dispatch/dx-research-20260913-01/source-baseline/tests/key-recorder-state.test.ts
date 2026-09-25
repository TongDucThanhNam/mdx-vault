import { describe, expect, test } from 'bun:test'
import { isKeyRecorderCapturing } from '../src/renderer/src/settings/key-recorder-state'

describe('key recorder global ownership', () => {
  test('owns global keys only while listening for a chord', () => {
    expect(isKeyRecorderCapturing(null)).toBe(false)
    expect(isKeyRecorderCapturing({ conflicts: [] })).toBe(true)
  })

  test('releases global keys while the keyboard-operable conflict confirmation is shown', () => {
    expect(isKeyRecorderCapturing({ conflicts: [{ actionId: 'file.open' }] })).toBe(false)
  })
})
