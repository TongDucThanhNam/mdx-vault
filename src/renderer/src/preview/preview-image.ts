const PASSTHROUGH_IMAGE_SCHEME = /^(?:https?:|data:|blob:)/i
const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i

export type PreviewImageSource =
  | { kind: 'passthrough'; src: string }
  | { kind: 'vault'; relativePath: string }
  | { kind: 'error'; path: string; message: string }

interface PreviewImageCacheOptions {
  readImageFile?: (relativePath: string) => Promise<string>
  createObjectUrl?: (blob: Blob) => string
  revokeObjectUrl?: (url: string) => void
  decodeObjectUrl?: (url: string) => Promise<void>
}

export interface PreparedPreviewImage {
  readonly relativePath: string
  readonly objectUrl: string
  /** Releases the object URL. Safe to call more than once. */
  release: () => void
}

interface CachedImage {
  prepared: PreparedPreviewImage | null
  promise: Promise<string>
}

export class PreviewImageCache {
  private readonly entries = new Map<string, CachedImage>()
  private readonly aspectRatios = new Map<string, number>()
  private readonly readImageFile: (relativePath: string) => Promise<string>
  private readonly createObjectUrl: (blob: Blob) => string
  private readonly revokeObjectUrl: (url: string) => void
  private readonly decodeObjectUrl: (url: string) => Promise<void>
  private readonly preparedImages = new Set<PreparedPreviewImage>()
  private generation = 0

  constructor(options: PreviewImageCacheOptions = {}) {
    this.readImageFile =
      options.readImageFile ?? ((relativePath) => window.vaultApi.readImageFile(relativePath))
    this.createObjectUrl = options.createObjectUrl ?? ((blob) => URL.createObjectURL(blob))
    this.revokeObjectUrl = options.revokeObjectUrl ?? ((url) => URL.revokeObjectURL(url))
    this.decodeObjectUrl = options.decodeObjectUrl ?? decodeObjectUrlImage
  }

  load(relativePath: string): Promise<string> {
    const cached = this.entries.get(relativePath)
    if (cached) {
      return cached.promise
    }

    const generation = this.generation
    const entry: CachedImage = {
      prepared: null,
      promise: Promise.resolve('')
    }

    entry.promise = this.prepare(relativePath).then((prepared) => {
      if (generation !== this.generation) {
        prepared.release()
        throw new Error('Image load was cancelled')
      }

      entry.prepared = prepared
      return prepared.objectUrl
    })
    void entry.promise.catch(() => {
      if (this.entries.get(relativePath) === entry) {
        this.entries.delete(relativePath)
      }
    })

    this.entries.set(relativePath, entry)
    return entry.promise
  }

  getAspectRatio(relativePath: string): number | null {
    return this.aspectRatios.get(relativePath) ?? null
  }

  rememberAspectRatio(relativePath: string, width: number, height: number): void {
    if (width > 0 && height > 0) this.aspectRatios.set(relativePath, width / height)
  }

  /**
   * Reads and browser-decodes a fresh image without publishing it to the
   * cache. Workbench navigation uses this as its prepare phase, then owns the
   * returned handle only after the matching state transaction commits.
   */
  async prepare(relativePath: string): Promise<PreparedPreviewImage> {
    const generation = this.generation
    const base64 = await this.readImageFile(relativePath)

    if (generation !== this.generation) {
      throw new Error('Image load was cancelled')
    }

    const objectUrl = this.createObjectUrl(
      decodeBase64Image(base64, inferImageMimeType(relativePath))
    )
    let released = false
    const prepared: PreparedPreviewImage = {
      relativePath,
      objectUrl,
      release: () => {
        if (released) {
          return
        }

        released = true
        this.preparedImages.delete(prepared)
        this.revokeObjectUrl(objectUrl)
      }
    }
    this.preparedImages.add(prepared)

    try {
      await this.decodeObjectUrl(objectUrl)
    } catch {
      prepared.release()
      throw new Error('Image data could not be decoded')
    }

    if (generation !== this.generation) {
      prepared.release()
      throw new Error('Image load was cancelled')
    }

    return prepared
  }

  dispose(): void {
    this.generation += 1

    for (const prepared of [...this.preparedImages]) {
      prepared.release()
    }

    this.entries.clear()
    this.aspectRatios.clear()
  }
}

function decodeObjectUrlImage(objectUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      image.onload = null
      image.onerror = null
      resolve()
    }
    image.onerror = () => {
      image.onload = null
      image.onerror = null
      reject(new Error('Image data could not be decoded'))
    }
    image.src = objectUrl
  })
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
