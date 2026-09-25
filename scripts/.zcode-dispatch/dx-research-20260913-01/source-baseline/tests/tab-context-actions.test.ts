import { describe, expect, test } from 'bun:test'
import {
  deriveTabContextCloseTargets,
  runTabFileAction,
  selectNextBatchCloseCandidate
} from '../src/renderer/src/workbench/tab-context-actions'
import type { WorkbenchItem } from '../src/renderer/src/workbench/types'
import { createGlobalGraphWorkbenchItem } from '../src/renderer/src/workbench/workbench-item'

function item(id: string, dirty = false): WorkbenchItem {
  return {
    id,
    relativePath: id,
    kind: 'note',
    dirty,
    missing: false,
    autosavePaused: false
  }
}

describe('tab context actions', () => {
  test('derives visual close groups and excludes dirty items from Close Saved', () => {
    const items = [item('a.mdx'), item('b.mdx', true), item('c.mdx'), item('d.mdx')]

    expect(deriveTabContextCloseTargets(items, 'b.mdx')).toEqual({
      current: ['b.mdx'],
      others: ['a.mdx', 'c.mdx', 'd.mdx'],
      left: ['a.mdx'],
      right: ['c.mdx', 'd.mdx'],
      saved: ['a.mdx', 'c.mdx', 'd.mdx'],
      all: ['a.mdx', 'b.mdx', 'c.mdx', 'd.mdx']
    })
  })

  test('returns empty close groups for a stale context-menu target', () => {
    expect(deriveTabContextCloseTargets([item('a.mdx')], 'missing.mdx')).toEqual({
      current: [],
      others: [],
      left: [],
      right: [],
      saved: [],
      all: []
    })
  })

  test('bulk close prioritizes an active candidate, then saved inactive candidates', () => {
    const items = [item('a.mdx', true), item('b.mdx'), item('c.mdx', true)]
    const pendingIds = new Set(items.map((candidate) => candidate.id))

    expect(selectNextBatchCloseCandidate(items, 'c.mdx', pendingIds)).toEqual({
      id: 'c.mdx',
      requiresActivation: false
    })
    expect(selectNextBatchCloseCandidate(items, null, pendingIds)).toEqual({
      id: 'b.mdx',
      requiresActivation: false
    })
  })

  test('requires activation before closing the last unsaved inactive candidate', () => {
    const items = [item('a.mdx', true), item('b.mdx')]

    expect(selectNextBatchCloseCandidate(items, 'b.mdx', new Set(['a.mdx']))).toEqual({
      id: 'a.mdx',
      requiresActivation: true
    })
    expect(selectNextBatchCloseCandidate(items, 'b.mdx', new Set(['gone.mdx']))).toBeNull()
  })

  test('never routes graph tabs into path-only context actions', () => {
    const paths: string[] = []
    const graph = createGlobalGraphWorkbenchItem()

    expect(runTabFileAction(graph, (path) => paths.push(path))).toBe(false)
    expect(paths).toEqual([])
    expect(runTabFileAction(item('notes/Alpha.mdx'), (path) => paths.push(path))).toBe(true)
    expect(paths).toEqual(['notes/Alpha.mdx'])
  })
})
