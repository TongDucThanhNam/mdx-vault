import { describe, expect, test } from 'bun:test'
import type {
  WorkbenchItem,
  WorkbenchItemKind,
  WorkbenchState
} from '../src/renderer/src/workbench/types'
import {
  activateVisualWorkbenchItem,
  cancelMruSwitch,
  captureWorkbenchViewState,
  closeWorkbenchItem,
  commitMruSwitch,
  commitTransactionalWorkbenchClose,
  createWorkbenchItem,
  createWorkbenchRequestCoordinator,
  createWorkbenchState,
  cycleMruSwitch,
  deleteWorkbenchItem,
  getCloseRequirement,
  getMruSwitchCommitTarget,
  markWorkbenchItemMissing,
  openOrActivateWorkbenchItem,
  renameWorkbenchItem,
  reopenWorkbenchItem,
  resetWorkbenchState,
  resolveCloseActiveIntent,
  resolveReopenCandidate,
  runWorkbenchTransaction,
  setWorkbenchItemDirty,
  startMruSwitch,
  workbenchReducer
} from '../src/renderer/src/workbench/workbench-state'

function item(
  relativePath: string,
  kind: WorkbenchItemKind = 'note',
  options: Partial<Pick<WorkbenchItem, 'dirty' | 'missing' | 'viewState'>> = {}
): WorkbenchItem {
  return createWorkbenchItem({ relativePath, kind, ...options })
}

function open(state: WorkbenchState, ...items: WorkbenchItem[]): WorkbenchState {
  return items.reduce(openOrActivateWorkbenchItem, state)
}

function ids(state: WorkbenchState): string[] {
  return state.items.map((candidate) => candidate.id)
}

describe('GOAL-22 pure workbench state', () => {
  test('opens, deduplicates, and keeps visual order separate from MRU activation order', () => {
    const initial = createWorkbenchState()
    const withFiles = open(
      initial,
      item('notes/Alpha.mdx'),
      item('data/rows.csv', 'text'),
      item('assets/chart.png', 'image')
    )

    expect(ids(withFiles)).toEqual(['notes/Alpha.mdx', 'data/rows.csv', 'assets/chart.png'])
    expect(withFiles.activeId).toBe('assets/chart.png')
    expect(withFiles.mruIds).toEqual(['assets/chart.png', 'data/rows.csv', 'notes/Alpha.mdx'])

    const deduplicated = workbenchReducer(withFiles, {
      type: 'open_or_activate',
      item: item('data\\rows.csv', 'text')
    })

    expect(ids(deduplicated)).toEqual(ids(withFiles))
    expect(deduplicated.activeId).toBe('data/rows.csv')
    expect(deduplicated.mruIds).toEqual(['data/rows.csv', 'assets/chart.png', 'notes/Alpha.mdx'])
  })

  test('closing an inactive item preserves the active item and records one closed path', () => {
    const state = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'), item('c.mdx'))
    const next = closeWorkbenchItem(state, 'b.mdx')

    expect(ids(next)).toEqual(['a.mdx', 'c.mdx'])
    expect(next.activeId).toBe('c.mdx')
    expect(next.mruIds).toEqual(['c.mdx', 'a.mdx'])
    expect(next.closedIds).toEqual(['b.mdx'])
  })

  test('history close chooses the most recently used survivor before visual fallbacks', () => {
    let state = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'), item('c.mdx'))
    state = workbenchReducer(state, { type: 'activate', id: 'a.mdx' })

    const history = closeWorkbenchItem(state, 'a.mdx', { activateOnClose: 'history' })
    expect(history.activeId).toBe('c.mdx')

    const missingHistory: WorkbenchState = {
      ...state,
      activeId: 'b.mdx',
      mruIds: ['b.mdx']
    }
    expect(
      closeWorkbenchItem(missingHistory, 'b.mdx', { activateOnClose: 'history' }).activeId
    ).toBe('c.mdx')

    const rightEdge: WorkbenchState = {
      ...state,
      activeId: 'c.mdx',
      mruIds: ['c.mdx']
    }
    expect(closeWorkbenchItem(rightEdge, 'c.mdx', { activateOnClose: 'history' }).activeId).toBe(
      'b.mdx'
    )
  })

  test('right and left activation policies use their immediate non-wrapping edge fallback', () => {
    const base = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'), item('c.mdx'))
    const middle = workbenchReducer(base, { type: 'activate', id: 'b.mdx' })

    expect(closeWorkbenchItem(middle, 'b.mdx', { activateOnClose: 'right' }).activeId).toBe('c.mdx')
    expect(closeWorkbenchItem(middle, 'b.mdx', { activateOnClose: 'left' }).activeId).toBe('a.mdx')
    expect(closeWorkbenchItem(base, 'c.mdx', { activateOnClose: 'right' }).activeId).toBe('b.mdx')

    const first = workbenchReducer(base, { type: 'activate', id: 'a.mdx' })
    expect(closeWorkbenchItem(first, 'a.mdx', { activateOnClose: 'left' }).activeId).toBe('b.mdx')
  })

  test('last close leaves an empty workbench and only the following close applies no-tab policy', () => {
    const state = open(createWorkbenchState(), item('only.mdx'))
    const empty = closeWorkbenchItem(state, 'only.mdx')

    expect(empty.items).toEqual([])
    expect(empty.activeId).toBeNull()
    expect(resolveCloseActiveIntent(empty, 'keep_window_open')).toEqual({
      type: 'keep_window_open'
    })
    expect(resolveCloseActiveIntent(empty, 'close_window')).toEqual({ type: 'close_window' })
    expect(resolveCloseActiveIntent(state, 'close_window')).toEqual({
      type: 'close_item',
      id: 'only.mdx'
    })
  })

  test('closed history is bounded and reopen skips missing paths without phantom tabs', () => {
    let state = createWorkbenchState()

    for (let index = 0; index < 23; index += 1) {
      const path = `notes/${index}.mdx`
      state = openOrActivateWorkbenchItem(state, item(path))
      state = closeWorkbenchItem(state, path)
    }

    expect(state.closedIds).toHaveLength(20)
    expect(state.closedIds[0]).toBe('notes/22.mdx')
    expect(state.closedIds.at(-1)).toBe('notes/3.mdx')

    state = {
      ...state,
      closedIds: ['notes/deleted.mdx', 'notes/exists.mdx']
    }
    const resolution = resolveReopenCandidate(
      state,
      (relativePath) => relativePath === 'notes/exists.mdx'
    )

    expect(resolution.skippedIds).toEqual(['notes/deleted.mdx'])
    expect(resolution.candidateId).toBe('notes/exists.mdx')
    expect(resolution.state.closedIds).toEqual(['notes/exists.mdx'])

    const reopened = reopenWorkbenchItem(resolution.state, item('notes/exists.mdx'))
    expect(ids(reopened)).toEqual(['notes/exists.mdx'])
    expect(reopened.closedIds).toEqual([])
    expect(resolveReopenCandidate(reopened, () => true).candidateId).toBeNull()
  })

  test('rename maps identity in place and preserves MRU position and captured view state', () => {
    let state = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'))
    state = workbenchReducer(state, { type: 'activate', id: 'a.mdx' })
    state = captureWorkbenchViewState(state, 'a.mdx', {
      cursor: 18,
      selection: { anchor: 8, head: 18 },
      scrollTop: 320,
      scrollLeft: 12,
      viewMode: 'live'
    })
    state = setWorkbenchItemDirty(state, 'a.mdx', true)
    const renamed = renameWorkbenchItem(state, 'a.mdx', 'notes/Renamed.mdx')

    expect(ids(renamed)).toEqual(['notes/Renamed.mdx', 'b.mdx'])
    expect(renamed.activeId).toBe('notes/Renamed.mdx')
    expect(renamed.mruIds).toEqual(['notes/Renamed.mdx', 'b.mdx'])
    expect(renamed.items[0]?.viewState).toEqual({
      cursor: 18,
      selection: { anchor: 8, head: 18 },
      scrollTop: 320,
      scrollLeft: 12,
      viewMode: 'live'
    })
    expect(renamed.items[0]?.dirty).toBe(false)

    expect(renameWorkbenchItem(renamed, 'notes/Renamed.mdx', 'b.mdx')).toBe(renamed)

    const withText = openOrActivateWorkbenchItem(renamed, item('data.csv', 'text'))
    expect(renameWorkbenchItem(withText, 'data.csv', 'renamed.csv')).toBe(withText)
    expect(deleteWorkbenchItem(withText, 'data.csv')).toBe(withText)
  })

  test('activation preserves each tab cursor, selection, scroll, and note view mode', () => {
    let state = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'))
    state = captureWorkbenchViewState(state, 'b.mdx', {
      cursor: 42,
      selection: { anchor: 30, head: 42 },
      scrollTop: 480,
      scrollLeft: 16,
      viewMode: 'reading'
    })
    state = workbenchReducer(state, { type: 'activate', id: 'a.mdx' })
    state = captureWorkbenchViewState(state, 'a.mdx', {
      cursor: 9,
      selection: { anchor: 3, head: 9 },
      scrollTop: 120,
      scrollLeft: 0,
      viewMode: 'source'
    })

    state = workbenchReducer(state, { type: 'activate', id: 'b.mdx' })
    expect(state.items.find((candidate) => candidate.id === state.activeId)?.viewState).toEqual({
      cursor: 42,
      selection: { anchor: 30, head: 42 },
      scrollTop: 480,
      scrollLeft: 16,
      viewMode: 'reading'
    })

    state = workbenchReducer(state, { type: 'activate', id: 'a.mdx' })
    expect(state.items.find((candidate) => candidate.id === state.activeId)?.viewState).toEqual({
      cursor: 9,
      selection: { anchor: 3, head: 9 },
      scrollTop: 120,
      scrollLeft: 0,
      viewMode: 'source'
    })
  })

  test('app delete removes only after commit while external delete retains clean and dirty items', () => {
    let state = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'))
    state = workbenchReducer(state, { type: 'activate', id: 'a.mdx' })
    const deleted = deleteWorkbenchItem(state, 'a.mdx')

    expect(ids(deleted)).toEqual(['b.mdx'])
    expect(deleted.activeId).toBe('b.mdx')
    expect(deleted.closedIds).not.toContain('a.mdx')

    const cleanMissing = markWorkbenchItemMissing(deleted, 'b.mdx')
    expect(cleanMissing.items[0]).toMatchObject({
      id: 'b.mdx',
      missing: true,
      dirty: false,
      autosavePaused: true
    })

    let dirtyMissing = openOrActivateWorkbenchItem(cleanMissing, item('dirty.mdx'))
    dirtyMissing = setWorkbenchItemDirty(dirtyMissing, 'dirty.mdx', true)
    dirtyMissing = markWorkbenchItemMissing(dirtyMissing, 'dirty.mdx')
    const dirtyItem = dirtyMissing.items.find((candidate) => candidate.id === 'dirty.mdx')!

    expect(getCloseRequirement(dirtyItem)).toBe('confirm_discard_missing')
    expect(closeWorkbenchItem(dirtyMissing, 'dirty.mdx')).toBe(dirtyMissing)
    expect(closeWorkbenchItem(dirtyMissing, 'dirty.mdx', { authorization: 'saved' })).toBe(
      dirtyMissing
    )
    expect(closeWorkbenchItem(dirtyMissing, 'dirty.mdx', { authorization: 'cancel' })).toBe(
      dirtyMissing
    )

    const discarded = closeWorkbenchItem(dirtyMissing, 'dirty.mdx', {
      authorization: 'discard_missing'
    })
    expect(ids(discarded)).toEqual(['b.mdx'])
  })

  test('existing dirty items require a successful save authorization before close', () => {
    const dirty = open(createWorkbenchState(), item('draft.mdx', 'note', { dirty: true }))

    expect(getCloseRequirement(dirty.items[0]!)).toBe('save')
    expect(closeWorkbenchItem(dirty, 'draft.mdx')).toBe(dirty)
    expect(closeWorkbenchItem(dirty, 'draft.mdx', { authorization: 'cancel' })).toBe(dirty)
    expect(closeWorkbenchItem(dirty, 'draft.mdx', { authorization: 'saved' }).items).toEqual([])
  })

  test('transactional close rejects watcher and in-flight editor mutations', () => {
    const clean = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'))
    const options = {
      id: 'b.mdx',
      wasActive: true,
      discardMissing: false,
      activeBufferClean: true,
      preparedDestinationId: 'a.mdx',
      activateOnClose: 'history' as const
    }

    expect(commitTransactionalWorkbenchClose(clean, options)).not.toBe(false)
    expect(
      commitTransactionalWorkbenchClose(setWorkbenchItemDirty(clean, 'b.mdx', true), options)
    ).toBe(false)
    expect(commitTransactionalWorkbenchClose(clean, { ...options, activeBufferClean: false })).toBe(
      false
    )

    const missingDirty = markWorkbenchItemMissing(
      setWorkbenchItemDirty(clean, 'b.mdx', true),
      'b.mdx'
    )
    expect(commitTransactionalWorkbenchClose(missingDirty, options)).toBe(false)
    expect(
      commitTransactionalWorkbenchClose(missingDirty, {
        ...options,
        discardMissing: true,
        activeBufferClean: false
      })
    ).not.toBe(false)
  })

  test('vault reset clears tabs, MRU, closed history, switch state, and view state generation', () => {
    let state = open(createWorkbenchState(7), item('same/path.mdx'), item('other.mdx'))
    state = captureWorkbenchViewState(state, 'other.mdx', { cursor: 4, scrollTop: 100 })
    state = startMruSwitch(state)
    state = closeWorkbenchItem(state, 'same/path.mdx')
    const reset = resetWorkbenchState(state)

    expect(reset).toEqual({
      sessionId: 8,
      items: [],
      activeId: null,
      mruIds: [],
      closedIds: [],
      mruSwitch: null
    })
  })

  test('MRU switch is transient, cycles independently, cancels, and commits once', () => {
    let state = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'), item('c.mdx'))
    state = workbenchReducer(state, { type: 'activate', id: 'a.mdx' })
    const originalMru = [...state.mruIds]
    const started = startMruSwitch(state)

    expect(started.activeId).toBe('a.mdx')
    expect(started.mruIds).toEqual(originalMru)
    expect(started.mruSwitch).toEqual({
      originId: 'a.mdx',
      candidateIds: ['a.mdx', 'c.mdx', 'b.mdx'],
      highlightedId: 'c.mdx'
    })

    const cycled = cycleMruSwitch(started, 1)
    expect(getMruSwitchCommitTarget(cycled)).toBe('b.mdx')
    expect(cycled.activeId).toBe('a.mdx')
    expect(cycled.mruIds).toEqual(originalMru)

    expect(cancelMruSwitch(cycled)).toEqual({ ...state, mruSwitch: null })

    const reverse = startMruSwitch(state, -1)
    expect(getMruSwitchCommitTarget(reverse)).toBe('b.mdx')
    const committed = commitMruSwitch(reverse)
    expect(committed.activeId).toBe('b.mdx')
    expect(committed.mruIds).toEqual(['b.mdx', 'a.mdx', 'c.mdx'])
    expect(committed.mruSwitch).toBeNull()
  })

  test('visual tab navigation wraps without changing visual order', () => {
    let state = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'), item('c.mdx'))
    const visualOrder = ids(state)

    state = activateVisualWorkbenchItem(state, 1)
    expect(state.activeId).toBe('a.mdx')
    state = activateVisualWorkbenchItem(state, -1)
    expect(state.activeId).toBe('c.mdx')
    state = activateVisualWorkbenchItem(state, -1)
    expect(state.activeId).toBe('b.mdx')
    expect(ids(state)).toEqual(visualOrder)
  })
})

describe('GOAL-22 transactional workbench helper', () => {
  test('failed save or load leaves the exact workbench state uncommitted', async () => {
    const initial = open(createWorkbenchState(), item('draft.mdx', 'note', { dirty: true }))
    let current = initial
    const store = {
      getState: () => current,
      commit: (next: WorkbenchState) => {
        current = next
      }
    }
    const coordinator = createWorkbenchRequestCoordinator()
    const calls: string[] = []

    const saveFailure = await runWorkbenchTransaction({
      coordinator,
      store,
      operation: 'open',
      targetId: 'next.mdx',
      prepare: async () => {
        calls.push('save')
        throw new Error('save failed')
      },
      transition: (state) => openOrActivateWorkbenchItem(state, item('next.mdx'))
    })

    expect(saveFailure.status).toBe('failed')
    expect(current).toBe(initial)
    expect(calls).toEqual(['save'])

    const loadFailure = await runWorkbenchTransaction({
      coordinator,
      store,
      operation: 'open',
      targetId: 'next.mdx',
      prepare: async () => {
        calls.push('save')
        calls.push('load')
        throw new Error('load failed')
      },
      transition: (state) => openOrActivateWorkbenchItem(state, item('next.mdx'))
    })

    expect(loadFailure.status).toBe('failed')
    expect(current).toBe(initial)
    expect(calls).toEqual(['save', 'save', 'load'])

    const booleanSaveFailure = await runWorkbenchTransaction({
      coordinator,
      store,
      operation: 'close',
      targetId: 'draft.mdx',
      prepare: async () => false,
      transition: (state) => closeWorkbenchItem(state, 'draft.mdx', { authorization: 'saved' })
    })

    expect(booleanSaveFailure.status).toBe('failed')
    expect(current).toBe(initial)

    const commitPreconditionFailure = await runWorkbenchTransaction({
      coordinator,
      store,
      operation: 'close',
      targetId: 'draft.mdx',
      prepare: async () => true,
      transition: () => false
    })

    expect(commitPreconditionFailure.status).toBe('failed')
    expect(current).toBe(initial)
  })

  test('a slower earlier request cannot override a newer committed choice', async () => {
    let current = open(createWorkbenchState(), item('origin.mdx'))
    const store = {
      getState: () => current,
      commit: (next: WorkbenchState) => {
        current = next
      }
    }
    const coordinator = createWorkbenchRequestCoordinator()
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = runWorkbenchTransaction({
      coordinator,
      store,
      operation: 'open',
      targetId: 'slow.mdx',
      prepare: async () => firstGate,
      transition: (state) => openOrActivateWorkbenchItem(state, item('slow.mdx'))
    })
    const second = runWorkbenchTransaction({
      coordinator,
      store,
      operation: 'open',
      targetId: 'latest.mdx',
      prepare: async () => undefined,
      transition: (state) => openOrActivateWorkbenchItem(state, item('latest.mdx'))
    })

    expect((await second).status).toBe('committed')
    releaseFirst()
    expect((await first).status).toBe('stale')
    expect(ids(current)).toEqual(['origin.mdx', 'latest.mdx'])
    expect(current.activeId).toBe('latest.mdx')
  })

  test('a vault reset invalidates a pending request even when paths repeat', async () => {
    let current = open(createWorkbenchState(11), item('same/path.mdx'))
    const store = {
      getState: () => current,
      commit: (next: WorkbenchState) => {
        current = next
      }
    }
    const coordinator = createWorkbenchRequestCoordinator()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const pending = runWorkbenchTransaction({
      coordinator,
      store,
      operation: 'open',
      targetId: 'late.mdx',
      prepare: async () => gate,
      transition: (state) => openOrActivateWorkbenchItem(state, item('late.mdx'))
    })

    current = resetWorkbenchState(current)
    current = openOrActivateWorkbenchItem(current, item('same/path.mdx'))
    release()

    expect((await pending).status).toBe('stale')
    expect(current.sessionId).toBe(12)
    expect(ids(current)).toEqual(['same/path.mdx'])
    expect(current.activeId).toBe('same/path.mdx')
  })

  test('a failed MRU target load preserves the origin and pre-switch MRU exactly', async () => {
    let current = open(createWorkbenchState(), item('a.mdx'), item('b.mdx'), item('c.mdx'))
    current = workbenchReducer(current, { type: 'activate', id: 'a.mdx' })
    current = startMruSwitch(current)
    const beforeLoad = current
    const store = {
      getState: () => current,
      commit: (next: WorkbenchState) => {
        current = next
      }
    }

    const result = await runWorkbenchTransaction({
      coordinator: createWorkbenchRequestCoordinator(),
      store,
      operation: 'activate',
      targetId: getMruSwitchCommitTarget(current) ?? undefined,
      prepare: async () => {
        throw new Error('target load failed')
      },
      transition: commitMruSwitch
    })

    expect(result.status).toBe('failed')
    expect(current).toBe(beforeLoad)
    expect(current.activeId).toBe('a.mdx')
    expect(current.mruIds).toEqual(['a.mdx', 'c.mdx', 'b.mdx'])
  })
})
