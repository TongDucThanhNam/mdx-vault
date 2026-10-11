/** The document dock is independent; only the graph's own navigator yields. */
export function shouldCollapseGraphNavigator(width: number): boolean {
  return width < 760
}

export function graphLabelFontSize(zoom: number): number {
  return Math.max(12, 11 / Math.max(0.15, zoom))
}

/** Pack disconnected components without changing their internal topology/layout. */
export function packGraphComponents(
  sizes: readonly { width: number; height: number }[],
  aspect: number
): { positions: Array<{ x: number; y: number }>; width: number; height: number } {
  const gap = 32
  const area = sizes.reduce((sum, size) => sum + (size.width + gap) * (size.height + gap), 0)
  const rowWidth = Math.max(220, ...sizes.map((size) => size.width), Math.sqrt(area * aspect))
  const positions: Array<{ x: number; y: number }> = []
  let x = 0
  let y = 0
  let rowHeight = 0
  let width = 0
  for (const size of sizes) {
    if (x > 0 && x + size.width > rowWidth) {
      x = 0
      y += rowHeight + gap
      rowHeight = 0
    }
    positions.push({ x, y })
    width = Math.max(width, x + size.width)
    x += size.width + gap
    rowHeight = Math.max(rowHeight, size.height)
  }
  return { positions, width, height: y + rowHeight }
}
