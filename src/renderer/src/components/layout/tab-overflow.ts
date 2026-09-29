export interface TabSpan {
  id: string
  start: number
  end: number
}

export function tabVisibleRange(
  spans: readonly TabSpan[],
  scrollLeft: number,
  viewportWidth: number
): {
  first: number
  last: number
} {
  const first = spans.findIndex((span) => span.end > scrollLeft + 1)
  if (first < 0) return { first: -1, last: -1 }
  let last = first
  while (last + 1 < spans.length && spans[last + 1]!.start < scrollLeft + viewportWidth - 1) last++
  return { first, last }
}

/** Nearest-edge target without moving the document's vertical scroll. */
export function tabScrollTarget(span: TabSpan, scrollLeft: number, viewportWidth: number): number {
  if (span.start < scrollLeft) return Math.max(0, span.start)
  if (span.end > scrollLeft + viewportWidth) return Math.max(0, span.end - viewportWidth)
  return scrollLeft
}

export function tabOverflowEdges(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number
): {
  left: boolean
  right: boolean
} {
  return { left: scrollLeft > 1, right: scrollLeft + clientWidth < scrollWidth - 1 }
}
