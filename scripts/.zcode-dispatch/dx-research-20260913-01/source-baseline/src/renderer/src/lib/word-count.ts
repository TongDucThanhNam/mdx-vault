export const WORDS_PER_MINUTE = 200

export interface WordCount {
  words: number
  chars: number
  readingMinutes: number
}

/**
 * Compute word / character count + estimated reading time for the editor
 * status bar. Strips common Markdown syntax (frontmatter, code fences,
 * heading/list markers, wikilink brackets) so the count reflects what a reader
 * would see — not the raw source. Reading time uses the standard 200 wpm.
 */
export function computeWordCount(value: string): WordCount {
  if (!value) {
    return { words: 0, chars: 0, readingMinutes: 0 }
  }

  const withoutFrontmatter = value.replace(/^---\n[\s\S]*?\n---\n?/, '')
  const withoutCodeFences = withoutFrontmatter.replace(/```[\s\S]*?```/g, ' ')
  const stripped = withoutCodeFences
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+\/?>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => alt as string)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, (_, label) => label as string)
    .replace(/\[\[([^\]]*)\]\]/g, (_, label) => label as string)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~]/g, '')

  const words = stripped.split(/\s+/).filter((word) => word.length > 0).length
  const chars = withoutFrontmatter.length
  const readingMinutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))

  return { words, chars, readingMinutes }
}
