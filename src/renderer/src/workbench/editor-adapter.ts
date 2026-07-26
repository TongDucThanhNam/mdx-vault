import type { PreparedPreviewImage } from '../preview/preview-image'
import type { FileWorkbenchItem, WorkbenchItemKind } from './types'

export interface CachedWorkbenchBuffer {
  kind: 'note' | 'text'
  content: string
  savedContent: string
}

export type EditorValueUpdate = string | ((current: string) => string)

export function applySynchronousEditorValue(
  valueRef: { current: string },
  commitState: (value: string) => void,
  update: EditorValueUpdate
): string {
  const value = typeof update === 'function' ? update(valueRef.current) : update
  valueRef.current = value
  commitState(value)
  return value
}

export interface PreparedWorkbenchDocument {
  id: string
  relativePath: string
  kind: WorkbenchItemKind
  missing: boolean
  content?: string
  savedContent?: string
  image?: PreparedPreviewImage
}

export type PreparedDocumentResult =
  | { status: 'ready'; document: PreparedWorkbenchDocument }
  | { status: 'stale' }
  | { status: 'unavailable' }

export type ControllerPreparedDocumentResult = PreparedDocumentResult | { status: 'failed' }

export interface PrepareWorkbenchDocumentOptions {
  item: FileWorkbenchItem
  cachedBuffer?: CachedWorkbenchBuffer
  readNote: (relativePath: string) => Promise<string>
  readText: (relativePath: string) => Promise<string>
  prepareImage: (relativePath: string) => Promise<PreparedPreviewImage>
  probeUnsupported: (relativePath: string) => Promise<void>
  isCurrent: () => boolean
}

export interface WorkbenchEditorPorts {
  cancelNoteLoad: () => void
  cancelTextLoad: () => void
  restoreNoteBuffer: (
    relativePath: string,
    content: string,
    savedContent: string,
    missing: boolean
  ) => void
  restoreTextBuffer: (
    relativePath: string,
    content: string,
    savedContent: string,
    missing: boolean
  ) => void
  restoreImagePreview: (image: PreparedPreviewImage | null) => void
}

/**
 * Reads a destination without mutating either editor. The controller applies
 * the prepared document only after its workbench transaction owns the latest
 * request and commits the matching active item.
 */
export async function prepareWorkbenchDocument(
  options: PrepareWorkbenchDocumentOptions
): Promise<PreparedDocumentResult> {
  const { item, cachedBuffer, isCurrent } = options
  if (!isCurrent()) {
    return { status: 'stale' }
  }

  if (item.missing) {
    if ((item.kind === 'note' || item.kind === 'text') && cachedBuffer?.kind === item.kind) {
      return {
        status: 'ready',
        document: {
          id: item.id,
          relativePath: item.relativePath,
          kind: item.kind,
          missing: true,
          content: cachedBuffer.content,
          savedContent: cachedBuffer.savedContent
        }
      }
    }

    if (item.kind === 'image' || item.kind === 'unsupported') {
      return {
        status: 'ready',
        document: toPreparedDocument(item)
      }
    }

    return { status: 'unavailable' }
  }

  if (item.kind === 'note' || item.kind === 'text') {
    const content =
      item.kind === 'note'
        ? await options.readNote(item.relativePath)
        : await options.readText(item.relativePath)

    if (!isCurrent()) {
      return { status: 'stale' }
    }

    return {
      status: 'ready',
      document: {
        ...toPreparedDocument(item),
        content,
        savedContent: content
      }
    }
  }

  if (item.kind === 'image') {
    const image = await options.prepareImage(item.relativePath)

    if (!isCurrent()) {
      image.release()
      return { status: 'stale' }
    }

    return {
      status: 'ready',
      document: {
        ...toPreparedDocument(item),
        image
      }
    }
  }

  await options.probeUnsupported(item.relativePath)

  if (!isCurrent()) {
    return { status: 'stale' }
  }

  return {
    status: 'ready',
    document: toPreparedDocument(item)
  }
}

/**
 * Converts preparation failures into a controller result while publishing the
 * error only when this request still owns navigation. A superseded read may
 * still reject after a newer request begins, but it must remain invisible.
 */
export async function prepareWorkbenchDocumentForController(
  options: PrepareWorkbenchDocumentOptions,
  onCurrentError: (error: unknown) => void
): Promise<ControllerPreparedDocumentResult> {
  try {
    return await prepareWorkbenchDocument(options)
  } catch (error) {
    if (!options.isCurrent()) {
      return { status: 'stale' }
    }

    onCurrentError(error)
    return { status: 'failed' }
  }
}

export function commitPreparedWorkbenchDocument(
  prepared: PreparedWorkbenchDocument,
  ports: WorkbenchEditorPorts
): void {
  if (prepared.kind === 'note') {
    ports.restoreImagePreview(null)
    ports.cancelTextLoad()
    ports.restoreNoteBuffer(
      prepared.relativePath,
      prepared.content ?? '',
      prepared.savedContent ?? '',
      prepared.missing
    )
    return
  }

  if (prepared.kind === 'text') {
    ports.restoreImagePreview(null)
    ports.cancelNoteLoad()
    ports.restoreTextBuffer(
      prepared.relativePath,
      prepared.content ?? '',
      prepared.savedContent ?? '',
      prepared.missing
    )
    return
  }

  ports.cancelNoteLoad()
  ports.cancelTextLoad()
  ports.restoreImagePreview(prepared.image ?? null)
}

/** Releases a staged image when its workbench transaction does not commit. */
export function releasePreparedWorkbenchDocument(prepared: PreparedWorkbenchDocument): void {
  prepared.image?.release()
}

function toPreparedDocument(item: FileWorkbenchItem): PreparedWorkbenchDocument {
  return {
    id: item.id,
    relativePath: item.relativePath,
    kind: item.kind,
    missing: Boolean(item.missing)
  }
}
