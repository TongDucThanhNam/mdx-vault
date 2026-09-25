import { describe, expect, test } from 'bun:test'
import { runWorkbenchControllerTransaction } from '../src/renderer/src/workbench/controller-transaction'
import {
  applySynchronousEditorValue,
  commitPreparedWorkbenchDocument,
  type PreparedWorkbenchDocument,
  prepareWorkbenchDocument,
  type WorkbenchEditorPorts
} from '../src/renderer/src/workbench/editor-adapter'
import type {
  WorkbenchItem,
  WorkbenchState,
  WorkbenchViewState
} from '../src/renderer/src/workbench/types'
import {
  captureWorkbenchViewState,
  commitTransactionalWorkbenchClose,
  createWorkbenchRequestCoordinator,
  createWorkbenchState,
  openOrActivateWorkbenchItem
} from '../src/renderer/src/workbench/workbench-state'

describe('thin workbench controller transaction', () => {
  test('an immediate edit is the exact buffer saved before close commits', async () => {
    let current = open(createWorkbenchState(), note('target.mdx'), note('draft.mdx'))
    current = withDraftView(current)
    const editor = createEditorHarness('draft.mdx', 'persisted draft')
    const writes: string[] = []
    let focusedPath = 'draft.mdx'

    applySynchronousEditorValue(editor.contentRef, editor.render, () => 'latest keystroke')

    const result = await runWorkbenchControllerTransaction({
      coordinator: createWorkbenchRequestCoordinator(),
      store: {
        getState: () => current,
        commit: (state) => {
          current = state
        }
      },
      operation: 'close',
      targetId: 'draft.mdx',
      prepare: async (token) => {
        writes.push(editor.contentRef.current)
        editor.savedContentRef.current = editor.contentRef.current
        const prepared = await prepareNoteDocument(
          'target.mdx',
          () => 'target content',
          () => token.id > 0
        )
        if (!prepared) {
          return false
        }

        return { value: prepared }
      },
      transition: (state, prepared) =>
        commitTransactionalWorkbenchClose(state, {
          id: 'draft.mdx',
          wasActive: true,
          discardMissing: false,
          activeBufferClean: editor.contentRef.current === editor.savedContentRef.current,
          preparedDestinationId: prepared.id,
          activateOnClose: 'history'
        }),
      commit: (prepared, state) => {
        commitPreparedWorkbenchDocument(prepared, editor.ports)
        focusedPath = state.activeId ?? ''
      }
    })

    expect(result.status).toBe('committed')
    expect(writes).toEqual(['latest keystroke'])
    expect(current.items.map((item) => item.id)).toEqual(['target.mdx'])
    expect(current.activeId).toBe('target.mdx')
    expect(editor.selectedPathRef.current).toBe('target.mdx')
    expect(editor.contentRef.current).toBe('target content')
    expect(editor.renderedContent()).toBe('target content')
    expect(focusedPath).toBe('target.mdx')
  })

  test('save failure stops before destination read and preserves exact active UI', async () => {
    let current = withDraftView(open(createWorkbenchState(), note('target.mdx'), note('draft.mdx')))
    const initial = current
    const editor = createEditorHarness('draft.mdx', 'persisted draft')
    let focusedPath = 'draft.mdx'
    const destinationReads = 0
    let commitCount = 0
    const saveAttempts: string[] = []

    applySynchronousEditorValue(editor.contentRef, editor.render, () => 'unsaved exact buffer')

    const result = await runWorkbenchControllerTransaction({
      coordinator: createWorkbenchRequestCoordinator(),
      store: {
        getState: () => current,
        commit: (state) => {
          current = state
        }
      },
      operation: 'activate',
      targetId: 'target.mdx',
      prepare: async () => {
        saveAttempts.push(editor.contentRef.current)
        return false
      },
      transition: (state) => openOrActivateWorkbenchItem(state, note('target.mdx')),
      commit: () => {
        commitCount += 1
        focusedPath = 'target.mdx'
      }
    })

    expect(result.status).toBe('failed')
    expect(destinationReads).toBe(0)
    expect(saveAttempts).toEqual(['unsaved exact buffer'])
    expect(commitCount).toBe(0)
    expect(current).toBe(initial)
    expect(current.items).toEqual(initial.items)
    expect(current.mruIds).toEqual(initial.mruIds)
    expect(current.items.find((item) => item.id === 'draft.mdx')?.viewState).toEqual(
      initial.items.find((item) => item.id === 'draft.mdx')?.viewState
    )
    expect(editor.selectedPathRef.current).toBe('draft.mdx')
    expect(editor.contentRef.current).toBe('unsaved exact buffer')
    expect(editor.renderedContent()).toBe('unsaved exact buffer')
    expect(editor.savedContentRef.current).toBe('persisted draft')
    expect(focusedPath).toBe('draft.mdx')
  })

  test('destination load failure preserves exact active UI after saving the latest buffer', async () => {
    let current = withDraftView(open(createWorkbenchState(), note('target.mdx'), note('draft.mdx')))
    const initial = current
    const editor = createEditorHarness('draft.mdx', 'persisted draft')
    const writes: string[] = []
    let focusedPath = 'draft.mdx'
    let commitCount = 0

    applySynchronousEditorValue(editor.contentRef, editor.render, () => 'latest before switch')

    const result = await runWorkbenchControllerTransaction({
      coordinator: createWorkbenchRequestCoordinator(),
      store: {
        getState: () => current,
        commit: (state) => {
          current = state
        }
      },
      operation: 'activate',
      targetId: 'target.mdx',
      prepare: async () => {
        writes.push(editor.contentRef.current)
        editor.savedContentRef.current = editor.contentRef.current
        await prepareNoteDocument(
          'target.mdx',
          () => {
            throw new Error('injected read failure')
          },
          () => true
        )
        return false
      },
      transition: (state) => openOrActivateWorkbenchItem(state, note('target.mdx')),
      commit: () => {
        commitCount += 1
        focusedPath = 'target.mdx'
      }
    })

    expect(result.status).toBe('failed')
    expect(writes).toEqual(['latest before switch'])
    expect(commitCount).toBe(0)
    expect(current).toBe(initial)
    expect(current.activeId).toBe('draft.mdx')
    expect(current.items.map((item) => item.id)).toEqual(['target.mdx', 'draft.mdx'])
    expect(current.mruIds).toEqual(initial.mruIds)
    expect(current.items.find((item) => item.id === 'draft.mdx')?.viewState).toEqual(
      initial.items.find((item) => item.id === 'draft.mdx')?.viewState
    )
    expect(editor.selectedPathRef.current).toBe('draft.mdx')
    expect(editor.contentRef.current).toBe('latest before switch')
    expect(editor.renderedContent()).toBe('latest before switch')
    expect(focusedPath).toBe('draft.mdx')
  })

  test('open captures cursor, selection, scroll, and mode after awaited preparation', async () => {
    let current = open(createWorkbenchState(), note('draft.mdx'))
    let liveView: WorkbenchViewState = {
      cursor: 2,
      selection: { anchor: 1, head: 2 },
      scrollTop: 10,
      scrollLeft: 1,
      viewMode: 'live'
    }
    let capturedView = liveView
    let releasePreparation!: () => void
    const preparationGate = new Promise<void>((resolve) => {
      releasePreparation = resolve
    })

    const pending = runWorkbenchControllerTransaction({
      coordinator: createWorkbenchRequestCoordinator(),
      store: {
        getState: () => current,
        commit: (state) => {
          current = state
        }
      },
      operation: 'open',
      targetId: 'target.mdx',
      prepare: async () => {
        await preparationGate
        return { value: note('target.mdx') }
      },
      captureLatest: () => {
        capturedView = {
          ...liveView,
          selection: liveView.selection ? { ...liveView.selection } : undefined
        }
      },
      transition: (state, target) =>
        openOrActivateWorkbenchItem(
          captureWorkbenchViewState(state, 'draft.mdx', capturedView),
          target
        ),
      commit: () => undefined
    })

    liveView = {
      cursor: 29,
      selection: { anchor: 11, head: 29 },
      scrollTop: 420,
      scrollLeft: 7,
      viewMode: 'source'
    }
    releasePreparation()
    const result = await pending

    expect(result.status).toBe('committed')
    expect(current.items.find((item) => item.id === 'draft.mdx')?.viewState).toEqual(liveView)
  })

  test('inactive close captures the active tab view after awaited preparation', async () => {
    let current = open(createWorkbenchState(), note('other.mdx'), note('draft.mdx'))
    let liveView: WorkbenchViewState = {
      cursor: 3,
      selection: { anchor: 3, head: 3 },
      scrollTop: 12,
      scrollLeft: 0,
      viewMode: 'live'
    }
    let capturedView = liveView
    let releasePreparation!: () => void
    const preparationGate = new Promise<void>((resolve) => {
      releasePreparation = resolve
    })

    const pending = runWorkbenchControllerTransaction<null>({
      coordinator: createWorkbenchRequestCoordinator(),
      store: {
        getState: () => current,
        commit: (state) => {
          current = state
        }
      },
      operation: 'close',
      targetId: 'other.mdx',
      prepare: async () => {
        await preparationGate
        return { value: null }
      },
      captureLatest: () => {
        capturedView = {
          ...liveView,
          selection: liveView.selection ? { ...liveView.selection } : undefined
        }
      },
      transition: (state) =>
        commitTransactionalWorkbenchClose(
          captureWorkbenchViewState(state, 'draft.mdx', capturedView),
          {
            id: 'other.mdx',
            wasActive: false,
            discardMissing: false,
            activeBufferClean: true,
            preparedDestinationId: null,
            activateOnClose: 'history'
          }
        ),
      commit: () => undefined
    })

    liveView = {
      cursor: 37,
      selection: { anchor: 18, head: 37 },
      scrollTop: 512,
      scrollLeft: 9,
      viewMode: 'source'
    }
    releasePreparation()
    const result = await pending

    expect(result.status).toBe('committed')
    expect(current.items.map((item) => item.id)).toEqual(['draft.mdx'])
    expect(current.items[0]?.viewState).toEqual(liveView)
  })
})

function note(relativePath: string): WorkbenchItem {
  return {
    id: relativePath,
    relativePath,
    kind: 'note',
    dirty: false,
    missing: false,
    autosavePaused: false
  }
}

function open(state: WorkbenchState, ...items: WorkbenchItem[]): WorkbenchState {
  return items.reduce(openOrActivateWorkbenchItem, state)
}

function withDraftView(state: WorkbenchState): WorkbenchState {
  return {
    ...state,
    items: state.items.map((item) =>
      item.id === 'draft.mdx'
        ? {
            ...item,
            viewState: {
              cursor: 7,
              selection: { anchor: 2, head: 7 },
              scrollTop: 81,
              scrollLeft: 3,
              viewMode: 'source' as const
            }
          }
        : item
    )
  }
}

async function prepareNoteDocument(
  relativePath: string,
  readNote: () => string,
  isCurrent: () => boolean
): Promise<PreparedWorkbenchDocument | null> {
  const result = await prepareWorkbenchDocument({
    item: note(relativePath),
    readNote: async () => readNote(),
    readText: async () => '',
    prepareImage: async () => {
      throw new Error('unexpected image preparation')
    },
    probeUnsupported: async () => undefined,
    isCurrent
  })

  return result.status === 'ready' ? result.document : null
}

function createEditorHarness(relativePath: string, persistedContent: string) {
  const selectedPathRef = { current: relativePath }
  const contentRef = { current: persistedContent }
  const savedContentRef = { current: persistedContent }
  let renderedContent = persistedContent

  const render = (value: string): void => {
    renderedContent = value
  }

  const ports: WorkbenchEditorPorts = {
    cancelNoteLoad: () => undefined,
    cancelTextLoad: () => undefined,
    restoreNoteBuffer: (path, content, savedContent) => {
      selectedPathRef.current = path
      contentRef.current = content
      savedContentRef.current = savedContent
      render(content)
    },
    restoreTextBuffer: () => undefined,
    restoreImagePreview: () => undefined
  }

  return {
    selectedPathRef,
    contentRef,
    savedContentRef,
    render,
    renderedContent: () => renderedContent,
    ports
  }
}
