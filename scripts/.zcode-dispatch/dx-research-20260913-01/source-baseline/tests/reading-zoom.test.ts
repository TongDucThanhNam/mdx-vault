import { describe, expect, test } from 'bun:test'
import {
  accumulateReadingZoom,
  calculateReadingZoomAnchoredScroll,
  clampReadingZoom,
  MAX_READING_ZOOM,
  MIN_READING_ZOOM,
  normalizeReadingWheelDelta,
  stepReadingZoom
} from '../src/renderer/src/preview/reading-zoom'

describe('Reading preview zoom', () => {
  test('clamps every input to the supported browser-like range', () => {
    expect(clampReadingZoom(0.1)).toBe(MIN_READING_ZOOM)
    expect(clampReadingZoom(4)).toBe(MAX_READING_ZOOM)
    expect(clampReadingZoom(Number.NaN)).toBe(1)
  })

  test('uses continuous multiplicative wheel scaling', () => {
    expect(accumulateReadingZoom(1, -100)).toBeCloseTo(1.1618, 3)
    expect(accumulateReadingZoom(1, 100)).toBeCloseTo(0.8607, 3)
    expect(accumulateReadingZoom(MAX_READING_ZOOM, -240)).toBe(MAX_READING_ZOOM)
  })

  test('accumulates a wheel stream against the pending factor', () => {
    const afterFirstFrame = accumulateReadingZoom(1, -40)
    const afterSecondFrame = accumulateReadingZoom(afterFirstFrame, -60)

    expect(afterSecondFrame).toBeCloseTo(accumulateReadingZoom(1, -100), 8)
  })

  test('keeps the cursor-anchored content point stable when committing', () => {
    expect(
      calculateReadingZoomAnchoredScroll({
        scrollLeft: 100,
        scrollTop: 400,
        anchorX: 200,
        anchorY: 300,
        committedFactor: 1,
        pendingFactor: 2
      })
    ).toEqual({ left: 400, top: 1100 })

    expect(
      calculateReadingZoomAnchoredScroll({
        scrollLeft: 0,
        scrollTop: 0,
        anchorX: 200,
        anchorY: 300,
        committedFactor: 2,
        pendingFactor: 1
      })
    ).toEqual({ left: 0, top: 0 })
  })

  test('normalizes line and page deltas while bounding large jumps', () => {
    expect(normalizeReadingWheelDelta(2, 1, 800)).toBe(32)
    expect(normalizeReadingWheelDelta(2, 2, 800)).toBe(240)
    expect(normalizeReadingWheelDelta(-500, 0, 800)).toBe(-240)
  })

  test('steps keyboard zoom by ten percentage points', () => {
    expect(stepReadingZoom(1, 1)).toBe(1.1)
    expect(stepReadingZoom(1, -1)).toBe(0.9)
    expect(stepReadingZoom(MAX_READING_ZOOM, 1)).toBe(MAX_READING_ZOOM)
    expect(stepReadingZoom(MIN_READING_ZOOM, -1)).toBe(MIN_READING_ZOOM)
  })
})
