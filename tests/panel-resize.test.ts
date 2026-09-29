import { describe, expect, test } from 'bun:test'
import { reducePanelResizeKey } from '../src/renderer/src/components/layout/panel-resize'

describe('panel separator keyboard policy', () => {
  test('arrows resize towards the panel side, with shift acceleration', () => {
    expect(reducePanelResizeKey('leftPanelWidth', 15.5, 'ArrowRight', false)).toBe(16)
    expect(reducePanelResizeKey('rightPanelWidth', 18, 'ArrowLeft', true)).toBe(20)
    expect(reducePanelResizeKey('aiPanelWidth', 16, 'ArrowRight', false)).toBe(16)
  })
  test('enter resets and unrelated keys do nothing', () => {
    expect(reducePanelResizeKey('leftPanelWidth', 22, 'Enter', false)).toBe(15.5)
    expect(reducePanelResizeKey('leftPanelWidth', 22, 'Escape', false)).toBeNull()
  })
})
