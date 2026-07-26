import { describe, expect, test } from 'bun:test'

import {
  createGlobalGraphWorkbenchItem,
  createWorkbenchItemForPath
} from '../src/renderer/src/workbench/workbench-item'
import {
  closeWorkbenchItem,
  createWorkbenchState,
  deleteWorkbenchItem,
  GLOBAL_GRAPH_WORKBENCH_ID,
  markWorkbenchItemMissing,
  openOrActivateWorkbenchItem,
  renameWorkbenchItem,
  reopenWorkbenchItem,
  resetWorkbenchState,
  resolveReopenCandidate,
  setWorkbenchItemDirty,
  startMruSwitch
} from '../src/renderer/src/workbench/workbench-state'

describe('GOAL-24 virtual graph workbench item', () => {
  test('opens and activates one typed graph item without a fake vault path', () => {
    const note = createWorkbenchItemForPath('notes/Alpha.mdx', 'reading')
    const graph = createGlobalGraphWorkbenchItem()
    let state = openOrActivateWorkbenchItem(createWorkbenchState(), note)
    state = openOrActivateWorkbenchItem(state, graph)
    state = openOrActivateWorkbenchItem(state, graph)

    expect(state.items).toHaveLength(2)
    expect(state.activeId).toBe(GLOBAL_GRAPH_WORKBENCH_ID)
    expect(state.mruIds).toEqual([GLOBAL_GRAPH_WORKBENCH_ID, note.id])
    expect('relativePath' in graph).toBe(false)
    expect(graph).toEqual({
      id: GLOBAL_GRAPH_WORKBENCH_ID,
      kind: 'graph',
      resource: { kind: 'global-graph' },
      dirty: false,
      missing: false,
      autosavePaused: false
    })
  })

  test('participates in close, reopen, MRU, and vault reset while file mutations are no-ops', () => {
    const graph = createGlobalGraphWorkbenchItem()
    const note = createWorkbenchItemForPath('notes/Alpha.mdx', 'live')
    let state = openOrActivateWorkbenchItem(createWorkbenchState(), note)
    state = openOrActivateWorkbenchItem(state, graph)
    state = startMruSwitch(state)
    expect(state.mruSwitch?.highlightedId).toBe(note.id)

    const unchanged = state
    expect(renameWorkbenchItem(state, graph.id, 'notes/Fake.mdx')).toBe(unchanged)
    expect(deleteWorkbenchItem(state, graph.id)).toBe(unchanged)
    expect(markWorkbenchItemMissing(state, graph.id)).toBe(unchanged)
    expect(setWorkbenchItemDirty(state, graph.id, true)).toBe(unchanged)

    state = closeWorkbenchItem(state, graph.id)
    expect(state.activeId).toBe(note.id)
    expect(state.closedIds[0]).toBe(graph.id)

    let fileProbeCount = 0
    const resolution = resolveReopenCandidate(state, () => {
      fileProbeCount += 1
      return false
    })
    expect(resolution.candidateId).toBe(graph.id)
    expect(fileProbeCount).toBe(0)

    state = reopenWorkbenchItem(resolution.state, graph)
    expect(state.activeId).toBe(graph.id)
    expect(state.items.filter((item) => item.kind === 'graph')).toHaveLength(1)
    expect(resetWorkbenchState(state)).toMatchObject({
      sessionId: state.sessionId + 1,
      items: [],
      activeId: null,
      closedIds: []
    })
  })
})
