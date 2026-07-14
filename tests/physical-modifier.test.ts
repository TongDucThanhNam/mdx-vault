import { describe, expect, test } from 'bun:test'
import {
  PhysicalZoomModifierTracker,
  shouldHandleReadingWheelZoom
} from '../src/renderer/src/input/physical-modifier'

describe('physical zoom modifier tracking', () => {
  test('distinguishes synthesized pinch wheels from physical Ctrl+wheel', () => {
    expect(
      shouldHandleReadingWheelZoom({
        ctrlKey: true,
        metaKey: false,
        isDarwin: false,
        physicalModifierDown: false
      })
    ).toBe(false)

    expect(
      shouldHandleReadingWheelZoom({
        ctrlKey: true,
        metaKey: false,
        isDarwin: false,
        physicalModifierDown: true
      })
    ).toBe(true)
  })

  test('tracks Control everywhere and Meta only on Darwin', () => {
    const windowsTracker = new PhysicalZoomModifierTracker(false)
    windowsTracker.keyDown('Meta')
    expect(windowsTracker.isDown()).toBe(false)
    windowsTracker.keyDown('Control')
    expect(windowsTracker.isDown()).toBe(true)
    windowsTracker.keyUp('Control')
    expect(windowsTracker.isDown()).toBe(false)

    const darwinTracker = new PhysicalZoomModifierTracker(true)
    darwinTracker.keyDown('Meta')
    expect(darwinTracker.isDown()).toBe(true)
    darwinTracker.keyUp('Meta')
    expect(darwinTracker.isDown()).toBe(false)
  })

  test('reset clears potentially stuck modifier state', () => {
    const tracker = new PhysicalZoomModifierTracker(true)
    tracker.keyDown('Control')
    tracker.keyDown('Meta')
    tracker.reset()

    expect(tracker.isDown()).toBe(false)
  })
})
