import { describe, expect, test } from 'bun:test'

import {
  createGraphActionHandlers,
  GRAPH_ACTION_IDS,
  getGraphActionEnabledState
} from '../src/renderer/src/commands/graph-actions'
import { getWorkspaceActionDefinition } from '../src/shared/workspace-actions'

describe('GOAL-24 graph actions', () => {
  test('registers stable palette-visible graph metadata', () => {
    for (const id of GRAPH_ACTION_IDS) {
      expect(getWorkspaceActionDefinition(id)).toMatchObject({
        id,
        paletteVisible: true,
        keybindable: true
      })
    }
  })

  test('routes every graph action through the shared runtime handler map', () => {
    const calls: string[] = []
    const handlers = createGraphActionHandlers({
      openGlobalGraph: () => calls.push('open'),
      fitView: () => calls.push('fit'),
      toggleSettings: () => calls.push('settings'),
      showLocalGraph: () => calls.push('local')
    })

    expect(Object.keys(handlers)).toEqual(GRAPH_ACTION_IDS)
    for (const id of GRAPH_ACTION_IDS) handlers[id]()
    expect(calls).toEqual(['open', 'fit', 'settings', 'local'])
  })

  test('gates vault, note, and visible-surface actions independently', () => {
    expect(
      getGraphActionEnabledState({
        hasVault: false,
        hasNote: false,
        graphSurfaceActive: false
      })
    ).toEqual({
      'graph.open-global': false,
      'graph.fit-view': false,
      'graph.toggle-settings': false,
      'panel.showLocalGraph': false
    })

    expect(
      getGraphActionEnabledState({
        hasVault: true,
        hasNote: true,
        graphSurfaceActive: true
      })
    ).toEqual({
      'graph.open-global': true,
      'graph.fit-view': true,
      'graph.toggle-settings': true,
      'panel.showLocalGraph': true
    })
  })
})
