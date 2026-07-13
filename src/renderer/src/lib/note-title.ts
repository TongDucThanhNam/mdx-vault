export const RESERVED_NOTE_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
export const ILLEGAL_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

export function deriveNoteTitle(relativePath: string): string {
  const segments = relativePath.split('/')
  const last = segments[segments.length - 1] ?? relativePath
  return last.replace(/\.(md|mdx)$/i, '')
}

export function sanitizeNoteTitle(rawTitle: string): string {
  const trimmedTitle = rawTitle.replace(/\.(md|mdx)$/i, '').trim()

  if (!trimmedTitle) {
    throw new Error('Enter a note title.')
  }

  const sanitized = trimmedTitle
    .split('')
    .filter((char) => !isIllegalFilenameChar(char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)

  if (!sanitized) {
    throw new Error('The title contains only unsupported characters.')
  }

  if (RESERVED_NOTE_NAMES.test(sanitized)) {
    return `${sanitized} note`
  }

  return sanitized
}

export function isIllegalFilenameChar(char: string): boolean {
  if (ILLEGAL_FILENAME_CHARS.has(char)) {
    return true
  }

  return char.charCodeAt(0) <= 0x1f
}
