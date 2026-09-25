import type { NoteHeadingResult } from '@/vault/types'

export interface OutlineConnectorPoint {
  depth: number
  top: number
}

const OUTLINE_DEPTH_STEP = 10
const OUTLINE_RAIL_INSET = 6

export function resolveActiveHeadingFromOffset(
  headings: readonly NoteHeadingResult[],
  sourceOffset: number
): string | null {
  if (headings.length === 0) return null

  let activeId = headings[0].id
  for (const heading of headings) {
    if (heading.sourceFrom > sourceOffset) break
    activeId = heading.id
  }
  return activeId
}

export function resolveAvailableHeadingId(
  headings: readonly NoteHeadingResult[],
  candidateId: string | null
): string | null {
  if (headings.length === 0) return null
  return candidateId && headings.some((heading) => heading.id === candidateId)
    ? candidateId
    : headings[0].id
}

export function resolveActiveHeadingFromViewport(
  headings: readonly { id: string; top: number }[],
  activationTop: number,
  isAtEnd = false
): string | null {
  if (headings.length === 0) return null
  if (isAtEnd) return headings.at(-1)?.id ?? null

  let activeId = headings[0].id
  for (const heading of headings) {
    if (heading.top > activationTop) break
    activeId = heading.id
  }
  return activeId
}

export function getOutlineLineOffset(depth: number, minimumDepth: number): number {
  return OUTLINE_RAIL_INSET + Math.max(0, depth - minimumDepth) * OUTLINE_DEPTH_STEP
}

export function buildOutlineConnectorPath(
  points: readonly OutlineConnectorPoint[],
  minimumDepth: number
): string {
  const first = points[0]
  if (!first) return ''

  let path = `M ${getOutlineLineOffset(first.depth, minimumDepth)} ${first.top}`

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (!previous || !current) continue

    const previousX = getOutlineLineOffset(previous.depth, minimumDepth)
    const currentX = getOutlineLineOffset(current.depth, minimumDepth)
    const midpoint = (previous.top + current.top) / 2
    path += ` L ${previousX} ${midpoint} L ${currentX} ${midpoint} L ${currentX} ${current.top}`
  }

  return path
}
