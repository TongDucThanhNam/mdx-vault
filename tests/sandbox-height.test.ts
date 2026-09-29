import { describe, expect, test } from 'bun:test'
import {
  sandboxFrameHeight,
  sandboxIframeHeight
} from '../src/renderer/src/preview/sandbox/sandbox-height'

describe('sandbox height reservation', () => {
  test('reserves 260px before the first resize, then respects reported content height', () => {
    expect(sandboxFrameHeight(null)).toBe(260)
    expect(sandboxIframeHeight(null)).toBe(120)
    expect(sandboxFrameHeight(86)).toBe(120)
    expect(sandboxIframeHeight(86)).toBe(120)
    expect(sandboxFrameHeight(178.4)).toBe(179)
    expect(sandboxIframeHeight(178.4)).toBe(179)
    expect(sandboxFrameHeight(320)).toBe(320)
  })
})
