const PLACEHOLDER_HEIGHT = 260
const MIN_REPORTED_HEIGHT = 40

/** Hold a stable slot until the first validated resize; then respect the island. */
export function sandboxFrameHeight(reportedHeight: number | null): number {
  return reportedHeight === null
    ? PLACEHOLDER_HEIGHT
    : Math.max(MIN_REPORTED_HEIGHT, Math.ceil(reportedHeight))
}

/** Do not let the reserved wrapper inflate the iframe's first height report. */
export function sandboxIframeHeight(reportedHeight: number | null): number {
  return reportedHeight === null ? MIN_REPORTED_HEIGHT : sandboxFrameHeight(reportedHeight)
}

/** Suppress sub-pixel ResizeObserver feedback after rounding to a CSS pixel. */
export function shouldApplySandboxHeight(previous: number | null, next: number): boolean {
  return previous === null || Math.abs(sandboxFrameHeight(previous) - sandboxFrameHeight(next)) > 1
}
