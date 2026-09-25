import { describe, expect, test } from 'bun:test'
import { toGraphQuerySettings } from '../src/renderer/src/graph/graph-query-settings'
import { createGraphRequestCoordinator } from '../src/renderer/src/graph/graph-request-coordinator'
import { resolveLocalGraphContext } from '../src/renderer/src/graph/local-graph-state'
import type { WorkbenchItem } from '../src/renderer/src/workbench/types'
import {
  createGlobalGraphWorkbenchItem,
  createWorkbenchItemForPath
} from '../src/renderer/src/workbench/workbench-item'

describe('GOAL-24 Local Graph active-item scope', () => {
  test('follows only a present active note', () => {
    expect(resolveLocalGraphContext(createWorkbenchItemForPath('notes/Alpha.mdx', 'live'))).toEqual(
      {
        rootRelativePath: 'notes/Alpha.mdx',
        unavailableReason: null
      }
    )
  })

  test('clears stale scope for no item, missing note, text, image, unsupported, and graph items', () => {
    const missing: WorkbenchItem = {
      ...createWorkbenchItemForPath('notes/Missing.mdx', 'live'),
      missing: true,
      autosavePaused: true
    }
    const cases: Array<[WorkbenchItem | null, string]> = [
      [null, 'no-active-note'],
      [missing, 'missing-note'],
      [createWorkbenchItemForPath('data/table.csv', 'live'), 'unsupported-item'],
      [createWorkbenchItemForPath('assets/map.png', 'live'), 'unsupported-item'],
      [createWorkbenchItemForPath('archive/file.bin', 'live'), 'unsupported-item'],
      [createGlobalGraphWorkbenchItem(), 'unsupported-item']
    ]

    for (const [item, reason] of cases) {
      expect(resolveLocalGraphContext(item)).toEqual({
        rootRelativePath: null,
        unavailableReason: reason
      })
    }
  })

  test('rejects a previous-note result after the active-note scope changes', async () => {
    const coordinator = createGraphRequestCoordinator()
    const alphaRequest = coordinator.begin()
    const betaRequest = coordinator.begin()
    const committed: string[] = []

    await Promise.resolve('Alpha.mdx').then((path) => {
      if (coordinator.isCurrent(alphaRequest)) committed.push(path)
    })
    await Promise.resolve('Beta.mdx').then((path) => {
      if (coordinator.isCurrent(betaRequest)) committed.push(path)
    })

    expect(committed).toEqual(['Beta.mdx'])
  })

  test('keeps local depth in the scope instead of leaking it into strict query settings', () => {
    const querySettings = toGraphQuerySettings({
      query: 'tag:#graph',
      existingOnly: false,
      showOrphans: true,
      arrows: true,
      labelFadeThreshold: 0.35,
      nodeSize: 12,
      linkThickness: 1.5,
      centerForce: 1,
      repelForce: 2_048,
      linkForce: 32,
      linkDistance: 56,
      depth: 4
    })

    expect(querySettings).not.toHaveProperty('depth')
    expect(querySettings.query).toBe('tag:#graph')
  })
})
