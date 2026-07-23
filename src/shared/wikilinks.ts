export const WIKILINK_URL_PREFIX = 'wikilink:'

export interface WikilinkHeadingSubpath {
  kind: 'heading'
  segments: string[]
}

export interface WikilinkBlockSubpath {
  kind: 'block'
  identifier: string
}

export type WikilinkSubpath = WikilinkHeadingSubpath | WikilinkBlockSubpath

export interface WikilinkReference {
  noteTarget: string
  subpath: WikilinkSubpath | null
}

export interface MarkdownNoteReference {
  relativePath: string
  subpath: WikilinkSubpath | null
}

export interface WikilinkParts {
  target: string
  display: string
  reference: WikilinkReference
}

export interface WikilinkNoteCandidate {
  relativePath: string
  title: string
  aliases?: string[]
}

export interface WikilinkHeadingCandidate {
  depth: number
  text: string
}

export function parseWikilinkParts(rawValue: string): WikilinkParts | null {
  const delimiterIndex = rawValue.indexOf('|')
  const rawTarget = delimiterIndex === -1 ? rawValue : rawValue.slice(0, delimiterIndex)
  const rawDisplay = delimiterIndex === -1 ? rawValue : rawValue.slice(delimiterIndex + 1)
  const target = rawTarget.trim()
  const reference = parseWikilinkTarget(target)

  if (!reference) {
    return null
  }

  const display = rawDisplay.trim() || target
  return { target, display, reference }
}

export function parseWikilinkTarget(value: string): WikilinkReference | null {
  const target = value.trim()
  const fragmentIndex = target.indexOf('#')
  const noteTarget = (fragmentIndex === -1 ? target : target.slice(0, fragmentIndex)).trim()

  if (fragmentIndex === -1) {
    return noteTarget ? { noteTarget, subpath: null } : null
  }

  const rawSubpath = target.slice(fragmentIndex + 1).trim()

  if (!rawSubpath) {
    return null
  }

  if (rawSubpath.startsWith('^')) {
    const identifier = rawSubpath.slice(1).trim()
    return identifier ? { noteTarget, subpath: { kind: 'block', identifier } } : null
  }

  const segments = rawSubpath
    .split('#')
    .map((segment) => segment.trim())
    .filter(Boolean)

  return segments.length > 0 ? { noteTarget, subpath: { kind: 'heading', segments } } : null
}

export function formatWikilinkSubpath(subpath: WikilinkSubpath | null): string {
  if (!subpath) {
    return ''
  }

  return subpath.kind === 'block' ? `#^${subpath.identifier}` : `#${subpath.segments.join('#')}`
}

export function formatWikilinkTarget(reference: WikilinkReference): string {
  return `${reference.noteTarget}${formatWikilinkSubpath(reference.subpath)}`
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
  target: string,
  sourceRelativePath?: string
): TNote | null {
  const reference = parseWikilinkTarget(target)

  if (!reference) {
    return null
  }

  if (!reference.noteTarget) {
    const sourceKey = sourceRelativePath ? normalizeLinkKey(sourceRelativePath) : ''
    return notes.find((note) => normalizeLinkKey(note.relativePath) === sourceKey) ?? null
  }

  const targetKey = normalizeLinkKey(reference.noteTarget)

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

export function resolveMarkdownNoteTarget<TNote extends WikilinkNoteCandidate>(
  notes: TNote[],
  href: string | undefined,
  sourceRelativePath: string | undefined
): { note: TNote; reference: MarkdownNoteReference } | null {
  if (!href || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(href)) {
    return null
  }

  const fragmentIndex = href.indexOf('#')
  const rawPath = fragmentIndex === -1 ? href : href.slice(0, fragmentIndex)
  const rawFragment = fragmentIndex === -1 ? '' : href.slice(fragmentIndex + 1)
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(rawPath)
  } catch {
    decodedPath = rawPath
  }

  const sourcePath = sourceRelativePath?.replaceAll('\\', '/') ?? ''
  const sourceDirectory = sourcePath.includes('/')
    ? sourcePath.slice(0, sourcePath.lastIndexOf('/'))
    : ''
  const targetPath = decodedPath
    ? normalizeRelativeSegments(
        decodedPath.startsWith('/') ? decodedPath.slice(1) : `${sourceDirectory}/${decodedPath}`
      )
    : sourcePath
  const targetKey = normalizeLinkKey(targetPath)
  const note = notes.find((candidate) => normalizeLinkKey(candidate.relativePath) === targetKey)

  if (!note) return null

  const subpath = rawFragment
    ? (parseWikilinkTarget(`#${decodeURIComponentSafely(rawFragment)}`)?.subpath ?? null)
    : null
  return { note, reference: { relativePath: note.relativePath, subpath } }
}

export function normalizeWikilinkHeadingKey(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

export function resolveWikilinkHeading<THeading extends WikilinkHeadingCandidate>(
  headings: THeading[],
  subpath: WikilinkSubpath | null
): THeading | null {
  if (subpath?.kind !== 'heading') {
    return null
  }

  const targetSegments = subpath.segments.map(normalizeWikilinkHeadingKey)
  const headingPath: string[] = []

  for (const heading of headings) {
    const depth = Math.max(1, Math.min(6, heading.depth))
    headingPath.length = depth
    headingPath[depth - 1] = normalizeWikilinkHeadingKey(heading.text)
    const compactPath = headingPath.filter(Boolean)

    if (
      targetSegments.length <= compactPath.length &&
      targetSegments.every(
        (segment, index) =>
          compactPath[compactPath.length - targetSegments.length + index] === segment
      )
    ) {
      return heading
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

function normalizeRelativeSegments(value: string): string {
  const segments: string[] = []
  for (const segment of value.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      segments.pop()
    } else {
      segments.push(segment)
    }
  }
  return segments.join('/')
}

function decodeURIComponentSafely(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
