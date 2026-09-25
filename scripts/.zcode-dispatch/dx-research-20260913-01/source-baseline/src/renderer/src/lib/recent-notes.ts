export const RECENT_NOTES_STORAGE_KEY = 'mdx-vault.recent-notes.v1'

export function loadRecentNotePaths(): string[] {
  try {
    const value = window.localStorage.getItem(RECENT_NOTES_STORAGE_KEY)
    const parsed = value ? (JSON.parse(value) as unknown) : null

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is string => typeof item === 'string').slice(0, 20)
  } catch {
    return []
  }
}

export function saveRecentNotePaths(paths: string[]): void {
  try {
    window.localStorage.setItem(RECENT_NOTES_STORAGE_KEY, JSON.stringify(paths.slice(0, 20)))
  } catch {
    // Recent notes are a convenience; storage failures should not block editing.
  }
}

export function recordRecentNotePath(currentPaths: string[], relativePath: string): string[] {
  return [relativePath, ...currentPaths.filter((path) => path !== relativePath)].slice(0, 20)
}
