import { getNoteLinkKeys } from '../../../shared/wikilinks'
import type { IndexedNoteSummary } from '@/vault/types'

export interface ScoredNote {
  note: IndexedNoteSummary
  score: number
}

/**
 * Fuzzy-match a query against a note's title, relative path, and any
 * aliases/wikilink keys. Returns 0 when nothing matches, otherwise a tiered
 * score so exact > prefix > substring > subsequence.
 *
 * Extracted from QuickSwitcher so the `[[` autocomplete in the editor can
 * reuse the exact same ranking without duplicating the heuristic.
 */
export function scoreNote(note: IndexedNoteSummary, query: string): number {
  const keys = [note.title, note.relativePath, ...getNoteLinkKeys(note)].map((value) =>
    value.toLocaleLowerCase()
  )
  let bestScore = 0

  for (const key of keys) {
    if (key === query) {
      bestScore = Math.max(bestScore, 100)
    } else if (key.startsWith(query)) {
      bestScore = Math.max(bestScore, 80)
    } else if (key.includes(query)) {
      bestScore = Math.max(bestScore, 55)
    } else if (isSubsequence(query, key)) {
      bestScore = Math.max(bestScore, 25)
    }
  }

  return bestScore
}

/** Rank a list of notes by fuzzy relevance to `query`, capped at `limit`. */
export function getScoredNotes(
  notes: IndexedNoteSummary[],
  query: string,
  limit = 30
): ScoredNote[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return notes
    .map((note) => ({
      note,
      score: normalizedQuery ? scoreNote(note, normalizedQuery) : 1
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) => right.score - left.score || left.note.title.localeCompare(right.note.title)
    )
    .slice(0, limit)
}

/** Classic subsequence test: `query` chars appear in `value` in order. */
export function isSubsequence(query: string, value: string): boolean {
  let queryIndex = 0

  for (const character of value) {
    if (character === query[queryIndex]) {
      queryIndex += 1
    }

    if (queryIndex === query.length) {
      return true
    }
  }

  return false
}
