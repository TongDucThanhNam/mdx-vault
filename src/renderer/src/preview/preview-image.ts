const PASSTHROUGH_IMAGE_SCHEME = /^(?:https?:|data:|blob:)/i
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i

export type PreviewImageSource =
  | { kind: 'passthrough'; src: string }
  | { kind: 'vault'; relativePath: string }
  | { kind: 'error'; path: string; message: string }

interface PreviewImageCacheOptions {
  readAssetFile?: (relativePath: string) => Promise<string>
  createObjectUrl?: (blob: Blob) => string
  revokeObjectUrl?: (url: string) => void
}

interface CachedImage {
  objectUrl: string | null
  promise: Promise<string>
}

export class PreviewImageCache {
  private readonly entries = new Map<string, CachedImage>()
  private readonly readAssetFile: (relativePath: string) => Promise<string>
  private readonly createObjectUrl: (blob: Blob) => string
  private readonly revokeObjectUrl: (url: string) => void
  private generation = 0

  constructor(options: PreviewImageCacheOptions = {}) {
    this.readAssetFile =
      options.readAssetFile ?? ((relativePath) => window.vaultApi.readAssetFile(relativePath))
    this.createObjectUrl = options.createObjectUrl ?? ((blob) => URL.createObjectURL(blob))
    this.revokeObjectUrl = options.revokeObjectUrl ?? ((url) => URL.revokeObjectURL(url))
  }

  load(relativePath: string): Promise<string> {
    const cached = this.entries.get(relativePath)
    if (cached) {
      return cached.promise
    }

    const generation = this.generation
    const entry: CachedImage = {
      objectUrl: null,
      promise: Promise.resolve('')
    }

    entry.promise = this.readAssetFile(relativePath).then((base64) => {
      const objectUrl = this.createObjectUrl(
        decodeBase64Image(base64, inferImageMimeType(relativePath))
      )

      if (generation !== this.generation) {
        this.revokeObjectUrl(objectUrl)
        throw new Error('Image load was cancelled')
      }

      entry.objectUrl = objectUrl
      return objectUrl
    })

    this.entries.set(relativePath, entry)
    return entry.promise
  }

  dispose(): void {
    this.generation += 1

    for (const entry of this.entries.values()) {
      if (entry.objectUrl) {
        this.revokeObjectUrl(entry.objectUrl)
      }
    }

    this.entries.clear()
  }
}

export function resolvePreviewImageSource(
  selectedPath: string | null,
  source: string | undefined
): PreviewImageSource {
  if (!source?.trim()) {
    return {
      kind: 'error',
      path: source ?? '',
      message: 'Image source is missing'
    }
  }

  if (PASSTHROUGH_IMAGE_SCHEME.test(source)) {
    return { kind: 'passthrough', src: source }
  }

  const trimmedSource = source.trim()
  if (URL_SCHEME.test(trimmedSource)) {
    return {
      kind: 'error',
      path: trimmedSource,
      message: 'Unsupported image URL scheme'
    }
  }

  if (!selectedPath) {
    return {
      kind: 'error',
      path: trimmedSource,
      message: 'No note is selected'
    }
  }

  const sourcePath = trimmedSource.split(/[?#]/u, 1)[0]?.replaceAll('\\', '/') ?? ''
  if (!sourcePath || sourcePath.startsWith('/')) {
    return {
      kind: 'error',
      path: trimmedSource,
      message: 'Image path must be relative to the note'
    }
  }

  const noteSegments = selectedPath.replaceAll('\\', '/').split('/').slice(0, -1)
  const resolvedSegments = normalizePathSegments(noteSegments)

  if (!resolvedSegments) {
    return {
      kind: 'error',
      path: trimmedSource,
      message: 'Current note path is invalid'
    }
  }

  for (const rawSegment of sourcePath.split('/')) {
    const segment = decodePathSegment(rawSegment)
    if (segment === null) {
      return {
        kind: 'error',
        path: trimmedSource,
        message: 'Image path contains invalid encoding'
      }
    }

    if (!appendNormalizedSegment(resolvedSegments, segment)) {
      return {
        kind: 'error',
        path: trimmedSource,
        message: 'Image path escapes the vault'
      }
    }
  }

  if (resolvedSegments.length === 0) {
    return {
      kind: 'error',
      path: trimmedSource,
      message: 'Image path does not identify a file'
    }
  }

  return {
    kind: 'vault',
    relativePath: resolvedSegments.join('/')
  }
}

export function inferImageMimeType(relativePath: string): string {
  const extension = relativePath.split('.').at(-1)?.toLocaleLowerCase()

  switch (extension) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

export function decodeBase64Image(base64: string, mimeType: string): Blob {
  const payload = base64.includes(',') ? (base64.split(',', 2)[1] ?? '') : base64
  const binary = globalThis.atob(payload.replace(/\s/gu, ''))
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mimeType })
}

function normalizePathSegments(segments: string[]): string[] | null {
  const normalized: string[] = []

  for (const segment of segments) {
    if (!appendNormalizedSegment(normalized, segment)) {
      return null
    }
  }

  return normalized
}

function appendNormalizedSegment(segments: string[], segment: string): boolean {
  if (!segment || segment === '.') {
    return true
  }

  if (segment === '..') {
    if (segments.length === 0) {
      return false
    }
    segments.pop()
    return true
  }

  if (segment.includes('/') || segment.includes('\\') || segment.includes('\0')) {
    return false
  }

  segments.push(segment)
  return true
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}
