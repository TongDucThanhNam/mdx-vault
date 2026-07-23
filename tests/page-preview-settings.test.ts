import { describe, expect, test } from 'bun:test'

import { shouldOpenPagePreview } from '../src/renderer/src/preview/useWikilinkPreview'

describe('Page Preview settings gate', () => {
  test('defaults to direct intent, honors disable, and requires an explicit modifier', () => {
    expect(shouldOpenPagePreview({ enabled: true, requireModifier: false }, undefined)).toBe(true)
    expect(shouldOpenPagePreview({ enabled: false, requireModifier: false }, true)).toBe(false)
    expect(shouldOpenPagePreview({ enabled: true, requireModifier: true }, undefined)).toBe(false)
    expect(shouldOpenPagePreview({ enabled: true, requireModifier: true }, false)).toBe(false)
    expect(shouldOpenPagePreview({ enabled: true, requireModifier: true }, true)).toBe(true)
    expect(shouldOpenPagePreview({ enabled: true, requireModifier: true }, false, 'focus')).toBe(
      true
    )
    expect(shouldOpenPagePreview({ enabled: false, requireModifier: false }, false, 'focus')).toBe(
      false
    )
  })
})
