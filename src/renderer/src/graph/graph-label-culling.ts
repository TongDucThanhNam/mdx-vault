export interface GraphLabelCandidate {
  id: string
  title: string
  x: number
  y: number
  radius: number
  degree: number
}

export interface GraphLabelContext {
  zoom: number
  fadeThreshold?: number
  hoveredId: string | null
  selectedId: string | null
  neighborIds: ReadonlySet<string>
}

/** Greedy screen-space culling. The navigator remains the complete accessible label list. */
export function selectVisibleGraphLabels(
  candidates: readonly GraphLabelCandidate[],
  context: GraphLabelContext
): Set<string> {
  const topCount = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(candidates.length))))
  const topIds = new Set(
    [...candidates]
      .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
      .slice(0, topCount)
      .map((candidate) => candidate.id)
  )
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      priority:
        candidate.id === context.hoveredId
          ? 4
          : candidate.id === context.selectedId
            ? 3
            : context.neighborIds.has(candidate.id)
              ? 2
              : topIds.has(candidate.id) && context.zoom >= (context.fadeThreshold ?? 0)
                ? 1
                : context.zoom >= 1.35
                  ? 0
                  : -1
    }))
    .filter(({ priority }) => priority >= 0)
    .sort((a, b) => b.priority - a.priority || b.candidate.degree - a.candidate.degree)

  const boxes: Array<{ left: number; right: number; top: number; bottom: number }> = []
  const visible = new Set<string>()
  for (const { candidate } of ranked) {
    const scale = Math.max(0.15, context.zoom)
    const width = Math.min(160, Math.max(24, candidate.title.length * 7)) * scale
    const height = 15 * scale
    const top = candidate.y + candidate.radius * scale + 5 * scale
    const box = {
      left: candidate.x - width / 2 - 2,
      right: candidate.x + width / 2 + 2,
      top: top - 2,
      bottom: top + height + 2
    }
    if (
      boxes.some(
        (other) =>
          box.left < other.right &&
          box.right > other.left &&
          box.top < other.bottom &&
          box.bottom > other.top
      )
    )
      continue
    boxes.push(box)
    visible.add(candidate.id)
  }
  return visible
}
