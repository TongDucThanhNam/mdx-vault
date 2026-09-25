const FALLBACK_HEADING_ID = 'section'

export function normalizeHeadingSlug(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

export function createUniqueHeadingId(
  value: string,
  occurrences: Map<string, number>
): { id: string; slug: string } {
  const slug = normalizeHeadingSlug(value)
  const baseId = slug || FALLBACK_HEADING_ID
  const occurrence = (occurrences.get(baseId) ?? 0) + 1
  occurrences.set(baseId, occurrence)

  return {
    slug,
    id: occurrence === 1 ? baseId : `${baseId}-${occurrence}`
  }
}
