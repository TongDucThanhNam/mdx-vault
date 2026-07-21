import { PreviewImageCache } from '../src/renderer/src/preview/preview-image'
import {
  applySynchronousEditorValue,
  commitPreparedWorkbenchDocument,
  prepareWorkbenchDocument,
  prepareWorkbenchDocumentForController,
  type WorkbenchEditorPorts
} from '../src/renderer/src/workbench/editor-adapter'
import type { WorkbenchItem } from '../src/renderer/src/workbench/types'
import { createWorkbenchRequestCoordinator } from '../src/renderer/src/workbench/workbench-state'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
  toEqual(expected: unknown): void
}

describe('transactional editor adapter', () => {
  test('source changes update the save ref before a React render can synchronize effects', () => {
    const contentRef = { current: 'saved' }
    let renderedContent = 'saved'

    const next = applySynchronousEditorValue(
      contentRef,
      (value) => {
        renderedContent = value
      },
      (current) => `${current} + immediate edit`
    )

    expect(next).toBe('saved + immediate edit')
    expect(contentRef.current).toBe('saved + immediate edit')
    expect(renderedContent).toBe('saved + immediate edit')
  })

  test('a superseded delayed read never installs its path or content', async () => {
    let current = true
    let release!: (content: string) => void
    const delayedRead = new Promise<string>((resolve) => {
      release = resolve
    })
    const visible = { path: 'origin.mdx', content: 'origin buffer' }
    const ports = createPorts(visible)
    const pending = prepareWorkbenchDocument({
      item: item('late.mdx', 'note'),
      readNote: () => delayedRead,
      readText: async () => '',
      ...resourceLoaders(),
      isCurrent: () => current
    })

    current = false
    release('late buffer')
    const result = await pending
    if (result.status === 'ready') {
      commitPreparedWorkbenchDocument(result.document, ports)
    }

    expect(result.status).toBe('stale')
    expect(visible).toEqual({ path: 'origin.mdx', content: 'origin buffer' })
  })

  test('a superseded delayed read rejection never publishes an error', async () => {
    const coordinator = createWorkbenchRequestCoordinator()
    const token = coordinator.begin(0, 'open', 'slow.mdx')
    const reportedErrors: unknown[] = []
    let rejectRead!: (error: Error) => void
    const delayedRead = new Promise<string>((_resolve, reject) => {
      rejectRead = reject
    })
    const pending = prepareWorkbenchDocumentForController(
      {
        item: item('slow.mdx', 'note'),
        readNote: () => delayedRead,
        readText: async () => '',
        ...resourceLoaders(),
        isCurrent: () => coordinator.isCurrent(token)
      },
      (error) => reportedErrors.push(error)
    )

    coordinator.begin(0, 'open', 'newer.mdx')
    rejectRead(new Error('late stale rejection'))
    const result = await pending

    expect(result.status).toBe('stale')
    expect(reportedErrors).toEqual([])
  })

  test('commit applies the exact prepared buffer only after a successful read', async () => {
    const visible = { path: 'origin.mdx', content: 'origin buffer' }
    const ports = createPorts(visible)
    const result = await prepareWorkbenchDocument({
      item: item('data.csv', 'text'),
      readNote: async () => '',
      readText: async () => 'a,b\n1,2',
      ...resourceLoaders(),
      isCurrent: () => true
    })

    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(visible).toEqual({ path: 'origin.mdx', content: 'origin buffer' })
      commitPreparedWorkbenchDocument(result.document, ports)
    }
    expect(visible).toEqual({ path: 'data.csv', content: 'a,b\n1,2' })
  })

  test('a missing dirty buffer restores from session memory without reading disk', async () => {
    let readCount = 0
    const result = await prepareWorkbenchDocument({
      item: { ...item('deleted.mdx', 'note'), missing: true, dirty: true },
      cachedBuffer: { kind: 'note', content: 'unsaved', savedContent: 'saved' },
      readNote: async () => {
        readCount += 1
        return ''
      },
      readText: async () => '',
      ...resourceLoaders(),
      isCurrent: () => true
    })

    expect(result.status).toBe('ready')
    expect(readCount).toBe(0)
    if (result.status === 'ready') {
      expect(result.document.content).toBe('unsaved')
      expect(result.document.savedContent).toBe('saved')
      expect(result.document.missing).toBe(true)
    }
  })

  test('image read and decode failure leaves the visible editor exactly unchanged', async () => {
    const visible = { path: 'origin.mdx', content: 'origin buffer' }
    const ports = createPorts(visible)
    const revoked: string[] = []
    const imageCache = new PreviewImageCache({
      readImageFile: async () => 'AQIDBA==',
      createObjectUrl: () => 'blob:corrupt-image',
      revokeObjectUrl: (url) => revoked.push(url),
      decodeObjectUrl: async () => {
        throw new Error('decode failed')
      }
    })
    let failed = false

    try {
      const result = await prepareWorkbenchDocument({
        item: item('assets/corrupt.png', 'image'),
        readNote: async () => '',
        readText: async () => '',
        prepareImage: (relativePath) => imageCache.prepare(relativePath),
        probeUnsupported: async () => undefined,
        isCurrent: () => true
      })
      if (result.status === 'ready') {
        commitPreparedWorkbenchDocument(result.document, ports)
      }
    } catch {
      failed = true
    }

    expect(failed).toBe(true)
    expect(revoked).toEqual(['blob:corrupt-image'])
    expect(visible).toEqual({ path: 'origin.mdx', content: 'origin buffer' })
  })

  test('a stale unsupported tree entry is probed before it can be committed', async () => {
    const visible = { path: 'origin.mdx', content: 'origin buffer' }
    const ports = createPorts(visible)
    let probeCount = 0
    let failed = false

    try {
      const result = await prepareWorkbenchDocument({
        item: item('stale/archive.bin', 'unsupported'),
        readNote: async () => '',
        readText: async () => '',
        prepareImage: resourceLoaders().prepareImage,
        probeUnsupported: async () => {
          probeCount += 1
          throw new Error('File no longer exists')
        },
        isCurrent: () => true
      })
      if (result.status === 'ready') {
        commitPreparedWorkbenchDocument(result.document, ports)
      }
    } catch {
      failed = true
    }

    expect(failed).toBe(true)
    expect(probeCount).toBe(1)
    expect(visible).toEqual({ path: 'origin.mdx', content: 'origin buffer' })
  })

  test('a superseded image preparation releases its staged object URL', async () => {
    let current = true
    let releaseRead!: (base64: string) => void
    const delayedRead = new Promise<string>((resolve) => {
      releaseRead = resolve
    })
    const revoked: string[] = []
    const imageCache = new PreviewImageCache({
      readImageFile: () => delayedRead,
      createObjectUrl: () => 'blob:superseded-image',
      revokeObjectUrl: (url) => revoked.push(url),
      decodeObjectUrl: async () => undefined
    })
    const pending = prepareWorkbenchDocument({
      item: item('assets/slow.png', 'image'),
      readNote: async () => '',
      readText: async () => '',
      prepareImage: (relativePath) => imageCache.prepare(relativePath),
      probeUnsupported: async () => undefined,
      isCurrent: () => current
    })

    current = false
    releaseRead('AQIDBA==')
    const result = await pending

    expect(result.status).toBe('stale')
    expect(revoked).toEqual(['blob:superseded-image'])
  })
})

function item(relativePath: string, kind: WorkbenchItem['kind']): WorkbenchItem {
  return { id: relativePath, relativePath, kind, dirty: false, missing: false }
}

function createPorts(visible: { path: string; content: string }): WorkbenchEditorPorts {
  return {
    cancelNoteLoad: () => undefined,
    cancelTextLoad: () => undefined,
    restoreNoteBuffer: (relativePath, content) => {
      visible.path = relativePath
      visible.content = content
    },
    restoreTextBuffer: (relativePath, content) => {
      visible.path = relativePath
      visible.content = content
    },
    restoreImagePreview: () => undefined
  }
}

function resourceLoaders(): Pick<
  Parameters<typeof prepareWorkbenchDocument>[0],
  'prepareImage' | 'probeUnsupported'
> {
  return {
    prepareImage: async (relativePath) => ({
      relativePath,
      objectUrl: `blob:${relativePath}`,
      release: () => undefined
    }),
    probeUnsupported: async () => undefined
  }
}
