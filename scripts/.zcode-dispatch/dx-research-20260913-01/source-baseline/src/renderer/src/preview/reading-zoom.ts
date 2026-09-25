export const DEFAULT_READING_ZOOM = 1
export const MIN_READING_ZOOM = 0.5
export const MAX_READING_ZOOM = 3

const READING_ZOOM_STEP = 0.1
const WHEEL_ZOOM_SENSITIVITY = 0.0015
const WHEEL_LINE_HEIGHT = 16
const MAX_WHEEL_DELTA = 240

export function clampReadingZoom(factor: number): number {
  if (!Number.isFinite(factor)) {
    return DEFAULT_READING_ZOOM
  }

  return Math.min(MAX_READING_ZOOM, Math.max(MIN_READING_ZOOM, factor))
}

export function stepReadingZoom(factor: number, direction: -1 | 1): number {
  const steppedFactor = factor + direction * READING_ZOOM_STEP
  return clampReadingZoom(Math.round(steppedFactor * 100) / 100)
}

export function accumulateReadingZoom(pendingFactor: number, pixelDeltaY: number): number {
  return clampReadingZoom(pendingFactor * Math.exp(-pixelDeltaY * WHEEL_ZOOM_SENSITIVITY))
}

export function normalizeReadingWheelDelta(
  deltaY: number,
  deltaMode: number,
  pageHeight: number
): number {
  const pixelDelta =
    deltaMode === 1 ? deltaY * WHEEL_LINE_HEIGHT : deltaMode === 2 ? deltaY * pageHeight : deltaY

  return Math.min(MAX_WHEEL_DELTA, Math.max(-MAX_WHEEL_DELTA, pixelDelta))
}

interface ReadingZoomAnchorInput {
  scrollLeft: number
  scrollTop: number
  anchorX: number
  anchorY: number
  committedFactor: number
  pendingFactor: number
}

export interface ReadingZoomAnchoredScroll {
  left: number
  top: number
}

export function calculateReadingZoomAnchoredScroll({
  scrollLeft,
  scrollTop,
  anchorX,
  anchorY,
  committedFactor,
  pendingFactor
}: ReadingZoomAnchorInput): ReadingZoomAnchoredScroll {
  const scale = clampReadingZoom(pendingFactor) / clampReadingZoom(committedFactor)

  return {
    left: Math.max(0, (scrollLeft + anchorX) * scale - anchorX),
    top: Math.max(0, (scrollTop + anchorY) * scale - anchorY)
  }
}
