import { describe, expect, test } from 'bun:test'
import { PreviewImageCache } from '../src/renderer/src/preview/preview-image'
import {
  commitPreparedWorkbenchDocument,
  type PreparedWorkbenchDocument,
  prepareWorkbenchDocument,
  releasePreparedWorkbenchDocument,
  type WorkbenchEditorPorts
} from '../src/renderer/src/workbench/editor-adapter'
import type { WorkbenchItem, WorkbenchState } from '../src/renderer/src/workbench/types'
import {
  createWorkbenchRequestCoordinator,
  createWorkbenchState,
  openOrActivateWorkbenchItem,
  runWorkbenchTransaction
} from '../src/renderer/src/workbench/workbench-state'

describe('workbench resource transactions', () => {
  test('a decode failure cannot mutate tabs, editor buffer, view, or focus', async () => {
    const origin = item('origin.mdx', 'note')
    const initial = openOrActivateWorkbenchItem(createWorkbenchState(), origin)
    let state = initial
    const visible = { path: origin.relativePath, content: 'unsaved origin' }
    const ports = createPorts(visible)
    const focus = { count: 0 }
    const cache = new PreviewImageCache({
      readImageFile: async () => 'AQIDBA==',
      createObjectUrl: () => 'blob:invalid',
      revokeObjectUrl: () => undefined,
      decodeObjectUrl: async () => {
        throw new Error('decode failed')
      }
    })
    let prepared: PreparedWorkbenchDocument | null = null
    const coordinator = createWorkbenchRequestCoordinator()
    const result = await runWorkbenchTransaction({
      coordinator,
      store: {
        getState: () => state,
        commit: (nextState) => {
          state = nextState
        }
      },
      operation: 'open',
      targetId: 'assets/invalid.png',
      prepare: async (token) => {
        try {
          const preparation = await prepareWorkbenchDocument({
            item: item('assets/invalid.png', 'image'),
            readNote: async () => '',
            readText: async () => '',
            prepareImage: (relativePath) => cache.prepare(relativePath),
            probeUnsupported: async () => undefined,
            isCurrent: () => coordinator.isCurrent(token)
          })
          prepared = preparation.status === 'ready' ? preparation.document : null
          return prepared !== null
        } catch {
          return false
        }
      },
      transition: (latestState) =>
        prepared
          ? openOrActivateWorkbenchItem(latestState, item('assets/invalid.png', 'image'))
          : false
    })

    if (result.status === 'committed' && prepared) {
      commitPreparedWorkbenchDocument(prepared, ports)
      focus.count += 1
    }

    expect(result.status).toBe('failed')
    expect(state).toEqual(initial)
    expect(visible).toEqual({ path: 'origin.mdx', content: 'unsaved origin' })
    expect(focus.count).toBe(0)
  })

  test('a newer unsupported open wins an overlapping image read without a phantom tab', async () => {
    const origin = item('origin.mdx', 'note')
    let state = openOrActivateWorkbenchItem(createWorkbenchState(), origin)
    let releaseImageRead!: (base64: string) => void
    const delayedImageRead = new Promise<string>((resolve) => {
      releaseImageRead = resolve
    })
    const revoked: string[] = []
    const cache = new PreviewImageCache({
      readImageFile: () => delayedImageRead,
      createObjectUrl: () => 'blob:late-image',
      revokeObjectUrl: (url) => revoked.push(url),
      decodeObjectUrl: async () => undefined
    })
    const coordinator = createWorkbenchRequestCoordinator()
    const store = {
      getState: (): WorkbenchState => state,
      commit: (nextState: WorkbenchState): void => {
        state = nextState
      }
    }
    let preparedImage: PreparedWorkbenchDocument | null = null
    const imageOpen = runWorkbenchTransaction({
      coordinator,
      store,
      operation: 'open',
      targetId: 'assets/late.png',
      prepare: async (token) => {
        const result = await prepareWorkbenchDocument({
          item: item('assets/late.png', 'image'),
          readNote: async () => '',
          readText: async () => '',
          prepareImage: (relativePath) => cache.prepare(relativePath),
          probeUnsupported: async () => undefined,
          isCurrent: () => coordinator.isCurrent(token)
        })
        preparedImage = result.status === 'ready' ? result.document : null
        return preparedImage !== null
      },
      transition: (latestState) =>
        preparedImage
          ? openOrActivateWorkbenchItem(latestState, item('assets/late.png', 'image'))
          : false
    })

    let preparedUnsupported: PreparedWorkbenchDocument | null = null
    const unsupportedOpen = await runWorkbenchTransaction({
      coordinator,
      store,
      operation: 'open',
      targetId: 'archive/readable.bin',
      prepare: async (token) => {
        const result = await prepareWorkbenchDocument({
          item: item('archive/readable.bin', 'unsupported'),
          readNote: async () => '',
          readText: async () => '',
          prepareImage: (relativePath) => cache.prepare(relativePath),
          probeUnsupported: async () => undefined,
          isCurrent: () => coordinator.isCurrent(token)
        })
        preparedUnsupported = result.status === 'ready' ? result.document : null
        return preparedUnsupported !== null
      },
      transition: (latestState) =>
        preparedUnsupported
          ? openOrActivateWorkbenchItem(latestState, item('archive/readable.bin', 'unsupported'))
          : false
    })

    releaseImageRead('AQIDBA==')
    const staleImageResult = await imageOpen
    if (preparedImage) {
      releasePreparedWorkbenchDocument(preparedImage)
    }

    expect(unsupportedOpen.status).toBe('committed')
    expect(staleImageResult.status).toBe('stale')
    expect(state.activeId).toBe('archive/readable.bin')
    expect(state.items.map((openItem) => openItem.id)).toEqual([
      'origin.mdx',
      'archive/readable.bin'
    ])
    expect(revoked).toEqual(['blob:late-image'])
  })

  test('a stale unsupported entry is rejected before the state transition', async () => {
    const initial = openOrActivateWorkbenchItem(createWorkbenchState(), item('origin.mdx', 'note'))
    let state = initial
    const coordinator = createWorkbenchRequestCoordinator()
    let transitionCount = 0
    const result = await runWorkbenchTransaction({
      coordinator,
      store: {
        getState: () => state,
        commit: (nextState) => {
          state = nextState
        }
      },
      operation: 'open',
      targetId: 'deleted/stale.bin',
      prepare: async (token) => {
        try {
          await prepareWorkbenchDocument({
            item: item('deleted/stale.bin', 'unsupported'),
            readNote: async () => '',
            readText: async () => '',
            prepareImage: async () => {
              throw new Error('not used')
            },
            probeUnsupported: async () => {
              throw new Error('Vault file path could not be resolved safely')
            },
            isCurrent: () => coordinator.isCurrent(token)
          })
          return true
        } catch {
          return false
        }
      },
      transition: (latestState) => {
        transitionCount += 1
        return openOrActivateWorkbenchItem(latestState, item('deleted/stale.bin', 'unsupported'))
      }
    })

    expect(result.status).toBe('failed')
    expect(transitionCount).toBe(0)
    expect(state).toEqual(initial)
  })
})

function item(relativePath: string, kind: WorkbenchItem['kind']): WorkbenchItem {
  return {
    id: relativePath,
    relativePath,
    kind,
    dirty: false,
    missing: false,
    autosavePaused: false
  }
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
