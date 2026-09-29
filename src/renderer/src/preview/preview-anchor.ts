export interface PreviewBlockPosition {
  offset: number
  top: number
}

/** Prefer the nearest block at or before the editor cursor. */
export function selectBlockForSourceOffset<T extends PreviewBlockPosition>(
  blocks: readonly T[],
  offset: number
): T | null {
  if (blocks.length === 0) return null
  let selected = blocks[0] ?? null
  for (const block of blocks) {
    if (block.offset > offset) break
    selected = block
  }
  return selected
}

/** The first visible block wins; when a block straddles the top, retain it. */
export function selectTopVisibleBlock<T extends PreviewBlockPosition>(
  blocks: readonly T[],
  top: number
): T | null {
  if (blocks.length === 0) return null
  let selected = blocks[0] ?? null
  for (const block of blocks) {
    if (block.top > top) break
    selected = block
  }
  return selected
}

export function sourceOffsetToLine(source: string, offset: number): number {
  let line = 1
  for (let index = 0; index < Math.min(offset, source.length); index += 1) {
    if (source.charCodeAt(index) === 10) line += 1
  }
  return line
}
