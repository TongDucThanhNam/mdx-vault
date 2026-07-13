import type { IndexedNoteSummary } from '@/vault/types'
import { getNoteLinkKeys } from '../../../shared/wikilinks'

export interface ScoredNote {
  note: IndexedNoteSummary
  score: number
  matchedAlias?: string
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
  return getNoteMatch(note, query).score
}

function getNoteMatch(
  note: IndexedNoteSummary,
  query: string
): {
  score: number
  matchedAlias?: string
} {
  const keys = getSearchKeys(note)
  let bestScore = 0
  let matchedAlias: string | undefined

  for (const key of keys) {
    const value = key.value.toLocaleLowerCase()
    let score = 0

    if (value === query) {
      score = 100
    } else if (value.startsWith(query)) {
      score = 80
    } else if (value.includes(query)) {
      score = 55
    } else if (isSubsequence(query, value)) {
      score = 25
    }

    if (score > bestScore) {
      bestScore = score
      matchedAlias = key.isAlias ? key.value : undefined
    } else if (score === bestScore && key.isAlias && !matchedAlias) {
      matchedAlias = key.value
    }
  }

  return { score: bestScore, matchedAlias }
}

function getSearchKeys(note: IndexedNoteSummary): Array<{ value: string; isAlias: boolean }> {
  const aliasSet = new Set(note.aliases.map((alias) => alias.toLocaleLowerCase()))
  const seen = new Set<string>()
  const keys: Array<{ value: string; isAlias: boolean }> = []

  for (const value of [note.title, note.relativePath, ...getNoteLinkKeys(note)]) {
    const normalizedValue = value.toLocaleLowerCase()

    if (seen.has(normalizedValue)) {
      continue
    }

    seen.add(normalizedValue)
    keys.push({
      value,
      isAlias: aliasSet.has(normalizedValue)
    })
  }

  return keys
}

/** Rank a list of notes by fuzzy relevance to `query`, capped at `limit`. */
export function getScoredNotes(
  notes: IndexedNoteSummary[],
  query: string,
  limit = 30
): ScoredNote[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return notes
    .map((note) => {
      const match = normalizedQuery ? getNoteMatch(note, normalizedQuery) : { score: 1 }

      return {
        note,
        score: match.score,
        matchedAlias: match.matchedAlias
      }
    })
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
