const PREVIEW_WIDTH = 420
const PREVIEW_MAX_HEIGHT = 480
const VIEWPORT_GUTTER = 12
const ANCHOR_GAP = 12

export interface AnchorRect {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

export function resolveWikilinkPreviewPosition(
  anchorRect: AnchorRect,
  viewport: { width: number; height: number }
): { left: number; top: number; width: number } {
  const availableWidth = Math.max(0, viewport.width - VIEWPORT_GUTTER * 2)
  const width = Math.min(PREVIEW_WIDTH, availableWidth)
  const idealLeft = anchorRect.left + anchorRect.width / 2 - width / 2
  const left = clamp(idealLeft, VIEWPORT_GUTTER, viewport.width - width - VIEWPORT_GUTTER)
  const aboveTop = anchorRect.top - PREVIEW_MAX_HEIGHT - ANCHOR_GAP
  const belowTop = anchorRect.bottom + ANCHOR_GAP
  const maxTop = Math.max(VIEWPORT_GUTTER, viewport.height - PREVIEW_MAX_HEIGHT - VIEWPORT_GUTTER)
  const top =
    aboveTop >= VIEWPORT_GUTTER
      ? aboveTop
      : clamp(belowTop, VIEWPORT_GUTTER, Math.max(VIEWPORT_GUTTER, maxTop))

  return { left, top, width }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
