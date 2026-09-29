import { describe, expect, test } from 'bun:test'
import {
  sandboxFrameHeight,
  sandboxIframeHeight,
  shouldApplySandboxHeight
} from '../src/renderer/src/preview/sandbox/sandbox-height'

describe('sandbox height reservation', () => {
  test('reserves 260px before the first resize, then respects reported content height', () => {
    expect(sandboxFrameHeight(null)).toBe(260)
    expect(sandboxIframeHeight(null)).toBe(40)
    expect(sandboxFrameHeight(12)).toBe(40)
    expect(sandboxFrameHeight(86)).toBe(86)
    expect(sandboxIframeHeight(86)).toBe(86)
    expect(sandboxFrameHeight(178.4)).toBe(179)
    expect(sandboxIframeHeight(178.4)).toBe(179)
    expect(sandboxFrameHeight(320)).toBe(320)
    expect(shouldApplySandboxHeight(null, 86)).toBe(true)
    expect(shouldApplySandboxHeight(86, 87)).toBe(false)
    expect(shouldApplySandboxHeight(86, 88)).toBe(true)
  })
})
