import { readFile, stat } from 'fs/promises'
import { extname } from 'path'

import { safeJoin } from './safe-path'
import type { VaultService } from './vault-service'

export interface InlinedAsset {
  sourcePath: string
  mimeType: string
  dataUri: string
  bytes: number
}

export interface AssetCollectionResult {
  images: Map<string, InlinedAsset>
  datasets: Map<string, InlinedAsset>
  /** total bytes (images + datasets only) that have been inlined into the export */
  totalBytes: number
  warnings: string[]
  skipped: string[]
}

const SUPPORTED_IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
}

const SUPPORTED_DATASET_EXTENSIONS = new Set(['.csv', '.json'])

const DATA_URI_HEAD_BYTES = 16 * 1024

export class AssetCollector {
  constructor(private readonly vault: VaultService) {}

  /**
   * Resolve relative references against `noteRelativePath` and inline the
   * contents as data URIs. Files that fail the size limit (5MB) or have an
   * unsupported mime type are recorded in `skipped` and the original relative
   * path is left in the manifest so the renderer can warn the user.
   */
  async collect({
    imageSources,
    datasetSources,
    noteRelativePath
  }: {
    imageSources: string[]
    datasetSources: string[]
    noteRelativePath: string
  }): Promise<AssetCollectionResult> {
    const images = new Map<string, InlinedAsset>()
    const datasets = new Map<string, InlinedAsset>()
    const warnings: string[] = []
    const skipped: string[] = []
    let totalBytes = 0

    for (const source of dedupe(imageSources)) {
      try {
        const absolutePath = this.resolveAssetPath(source, noteRelativePath)
        if (this.isPathInsideInteractive(absolutePath)) {
          skipped.push(`image:${source}`)
          warnings.push(`Skipped asset under interactives/ (sandbox isolation): ${source}`)
          continue
        }

        const mimeType = this.detectImageMimeType(absolutePath)
        if (!mimeType) {
          skipped.push(`image:${source}`)
          warnings.push(`Unsupported image extension: ${source}`)
          continue
        }

        const inlined = await this.readAsDataUri(absolutePath, mimeType, source)
        if (!inlined) {
          skipped.push(`image:${source}`)
          continue
        }

        images.set(source, inlined)
        totalBytes += inlined.bytes
      } catch (error) {
        skipped.push(`image:${source}`)
        warnings.push(`Could not inline image ${source}: ${formatError(error)}`)
      }
    }

    for (const source of dedupe(datasetSources)) {
      try {
        const absolutePath = this.resolveAssetPath(source, noteRelativePath)
        if (this.isPathInsideInteractive(absolutePath)) {
          skipped.push(`dataset:${source}`)
          warnings.push(`Skipped dataset under interactives/ (sandbox isolation): ${source}`)
          continue
        }

        const extension = extname(absolutePath).toLowerCase()
        if (!SUPPORTED_DATASET_EXTENSIONS.has(extension)) {
          skipped.push(`dataset:${source}`)
          warnings.push(`Unsupported dataset extension: ${source}`)
          continue
        }

        const mimeType = extension === '.json' ? 'application/json' : 'text/csv'
        const inlined = await this.readAsDataUri(absolutePath, mimeType, source)
        if (!inlined) {
          skipped.push(`dataset:${source}`)
          continue
        }

        datasets.set(source, inlined)
        totalBytes += inlined.bytes
      } catch (error) {
        skipped.push(`dataset:${source}`)
        warnings.push(`Could not inline dataset ${source}: ${formatError(error)}`)
      }
    }

    return {
      images,
      datasets,
      totalBytes,
      warnings,
      skipped
    }
  }

  /**
   * Reads the file at `absolutePath` and converts it to a base64 data URI.
   * Returns `null` if the file is missing, not a file, or larger than the
   * per-asset hard limit (25MB).
   */
  private async readAsDataUri(
    absolutePath: string,
    mimeType: string,
    source: string
  ): Promise<InlinedAsset | null> {
    let stats: Awaited<ReturnType<typeof stat>>
    try {
      stats = await stat(absolutePath)
    } catch {
      return null
    }
    if (!stats.isFile()) {
      return null
    }

    if (stats.size > 25 * 1024 * 1024) {
      return null
    }

    const bytes = await readFile(absolutePath)
    const dataUri = `data:${mimeType};base64,${bytes.toString('base64')}`
    return {
      sourcePath: source,
      mimeType,
      dataUri,
      bytes: bytes.byteLength
    }
  }

  private detectImageMimeType(absolutePath: string): string | null {
    const extension = extname(absolutePath).toLowerCase()
    return SUPPORTED_IMAGE_MIME_TYPES[extension] ?? null
  }

  private resolveAssetPath(source: string, noteRelativePath: string): string {
    if (isAbsolutePathLike(source)) {
      throw new Error(`Asset path must be vault-relative: ${source}`)
    }

    const noteDirectory = dirnameNote(noteRelativePath)
    const resolved = noteDirectory ? joinNotePath(noteDirectory, source) : source
    return safeJoin(this.vault.rootPath, resolved)
  }

  private isPathInsideInteractive(absolutePath: string): boolean {
    const normalized = absolutePath.replaceAll('\\', '/')
    return normalized.includes('/interactives/')
  }
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function isAbsolutePathLike(value: string): boolean {
  return (
    value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value)
  )
}

function dirnameNote(noteRelativePath: string): string {
  const segments = noteRelativePath.split('/')
  segments.pop()
  return segments.join('/')
}

function joinNotePath(directory: string, source: string): string {
  const segments: string[] = []
  const combined = `${directory}/${source}`

  for (const segment of combined.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (segments.length === 0) {
        segments.push('..')
      } else {
        segments.pop()
      }
      continue
    }
    segments.push(segment)
  }

  return segments.join('/')
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

// Silence unused-import warning during refactors.
void DATA_URI_HEAD_BYTES
