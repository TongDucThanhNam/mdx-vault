export const WIKILINK_URL_PREFIX = 'wikilink:'

export interface WikilinkParts {
  target: string
  display: string
}

export interface WikilinkNoteCandidate {
  relativePath: string
  title: string
  aliases?: string[]
}

export function parseWikilinkParts(rawValue: string): WikilinkParts | null {
  const delimiterIndex = rawValue.indexOf('|')
  const rawTarget = delimiterIndex === -1 ? rawValue : rawValue.slice(0, delimiterIndex)
  const rawDisplay = delimiterIndex === -1 ? rawValue : rawValue.slice(delimiterIndex + 1)
  const target = rawTarget.trim()

  if (!target) {
    return null
  }

  const display = rawDisplay.trim() || target
  return { target, display }
}

export function createWikilinkUrl(target: string): string {
  return `${WIKILINK_URL_PREFIX}${encodeURIComponent(target)}`
}

export function parseWikilinkUrl(href: string | undefined): string | null {
  if (!href?.startsWith(WIKILINK_URL_PREFIX)) {
    return null
  }

  try {
    return decodeURIComponent(href.slice(WIKILINK_URL_PREFIX.length))
  } catch {
    return href.slice(WIKILINK_URL_PREFIX.length)
  }
}

export function normalizeLinkKey(value: string): string {
  return stripNoteExtension(value)
    .replaceAll('\\', '/')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
}

export function stripNoteExtension(value: string): string {
  return value.replace(/\.(mdx|md)$/i, '')
}

export function getFilenameStem(relativePath: string): string {
  const normalizedPath = relativePath.replaceAll('\\', '/')
  const filename = normalizedPath.split('/').at(-1) ?? normalizedPath
  return stripNoteExtension(filename)
}

export function getNoteLinkKeys(note: WikilinkNoteCandidate): string[] {
  const keys = new Set<string>()

  addKey(keys, note.title)
  addKey(keys, getFilenameStem(note.relativePath))
  addKey(keys, stripNoteExtension(note.relativePath))

  for (const alias of note.aliases ?? []) {
    addKey(keys, alias)
  }

  return [...keys]
}

export function resolveWikilinkTarget<TNote extends WikilinkNoteCandidate>(
  notes: TNote[],
  target: string
): TNote | null {
  const targetKey = normalizeLinkKey(target)

  if (!targetKey) {
    return null
  }

  for (const note of notes) {
    if (getNoteLinkKeys(note).includes(targetKey)) {
      return note
    }
  }

  return null
}

function addKey(keys: Set<string>, value: string): void {
  const key = normalizeLinkKey(value)

  if (key) {
    keys.add(key)
  }
}
