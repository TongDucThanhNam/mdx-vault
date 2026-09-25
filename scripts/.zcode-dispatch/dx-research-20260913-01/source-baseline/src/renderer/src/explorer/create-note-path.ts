export interface CreateNotePathResult {
  ok: true
  baseTitle: string
  relativePath: string
}

export interface CreateNotePathFailure {
  ok: false
  error: string
}

const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
const ILLEGAL_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

export function normalizeCreateNoteDirectory(directoryPath: string | null): string {
  return (directoryPath ?? '').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
}

export function validateCreateNotePath(
  rawName: string,
  directoryPath: string | null
): CreateNotePathResult | CreateNotePathFailure {
  const trimmedName = rawName.trim()
  if (!trimmedName) {
    return { ok: false, error: 'Enter a note title.' }
  }

  if (/[\\/]/.test(trimmedName)) {
    return { ok: false, error: 'Enter a title without folder separators.' }
  }

  const baseTitle = trimmedName.replace(/\.(md|mdx)$/i, '').trim()

  if (!baseTitle) {
    return { ok: false, error: 'Enter a note title.' }
  }

  if (RESERVED_NAMES.test(baseTitle)) {
    return { ok: false, error: 'That name is reserved by the OS.' }
  }

  const sanitized = baseTitle
    .split('')
    .filter((char) => !isIllegalFilenameChar(char))
    .join('')
    .trim()

  if (!sanitized) {
    return { ok: false, error: 'The title contains only unsupported characters.' }
  }

  const normalizedDirectory = normalizeCreateNoteDirectory(directoryPath)
  if (
    normalizedDirectory &&
    normalizedDirectory
      .split('/')
      .some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    return { ok: false, error: 'The selected folder path is invalid.' }
  }

  const filename = `${sanitized}.mdx`
  return {
    ok: true,
    baseTitle: sanitized,
    relativePath: normalizedDirectory ? `${normalizedDirectory}/${filename}` : filename
  }
}

function isIllegalFilenameChar(char: string): boolean {
  if (ILLEGAL_FILENAME_CHARS.has(char)) {
    return true
  }
  const code = char.charCodeAt(0)
  return code <= 0x1f
}
