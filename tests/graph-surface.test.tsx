import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { GraphSurfaceState } from '../src/renderer/src/graph/GraphSurface'
import {
  formatGraphSummary,
  type GraphSurfaceStateId,
  getGraphSurfaceState
} from '../src/renderer/src/graph/graph-surface-state'
import type { GraphSnapshot } from '../src/shared/graph'

describe('GOAL-24 graph surface state contract', () => {
  test('selects every deliberate non-happy state without leaving stale topology visible', () => {
    const baseline = {
      hasVault: true,
      mode: 'global' as const,
      rootRelativePath: null,
      localUnavailableReason: null,
      configStatus: 'ready' as const,
      configError: null,
      graphStatus: 'ready' as const,
      graphError: null,
      rendererError: null,
      snapshot: createSnapshot(),
      query: ''
    }
    const cases: Array<[GraphSurfaceStateId, Parameters<typeof getGraphSurfaceState>[0]]> = [
      ['no-vault', { ...baseline, hasVault: false }],
      [
        'no-active-note',
        {
          ...baseline,
          mode: 'local',
          localUnavailableReason: 'no-active-note'
        }
      ],
      [
        'unsupported-item',
        {
          ...baseline,
          mode: 'local',
          localUnavailableReason: 'unsupported-item'
        }
      ],
      [
        'missing-note',
        {
          ...baseline,
          mode: 'local',
          localUnavailableReason: 'missing-note'
        }
      ],
      ['loading', { ...baseline, graphStatus: 'loading' }],
      ['config-error', { ...baseline, configStatus: 'error' }],
      ['query-error', { ...baseline, graphStatus: 'error' }],
      ['renderer-error', { ...baseline, rendererError: 'renderer failed' }],
      [
        'missing-root',
        {
          ...baseline,
          snapshot: { ...createSnapshot(), state: 'missing-root', nodes: [], edges: [] }
        }
      ],
      [
        'filter-empty',
        { ...baseline, snapshot: { ...createSnapshot(), nodes: [], edges: [] }, query: 'tag:#x' }
      ],
      [
        'empty-vault',
        {
          ...baseline,
          snapshot: { ...createSnapshot(), nodes: [], edges: [], totals: { nodes: 0, edges: 0 } }
        }
      ],
      ['no-links', { ...baseline, snapshot: { ...createSnapshot(), nodes: [], edges: [] } }]
    ]

    for (const [expected, input] of cases) {
      expect(getGraphSurfaceState(input)).toBe(expected)
    }
    expect(getGraphSurfaceState(baseline)).toBeNull()
  })

  test('renders stable state copy and retry only for recoverable errors', () => {
    const loading = renderToStaticMarkup(
      createElement(GraphSurfaceState, { state: 'loading', onRetry: () => undefined })
    )
    const queryError = renderToStaticMarkup(
      createElement(GraphSurfaceState, { state: 'query-error', onRetry: () => undefined })
    )

    expect(loading).toContain('Building graph')
    expect(loading).not.toContain('>Retry<')
    expect(queryError).toContain('Query could not run')
    expect(queryError).toContain('>Retry<')
  })

  test('makes explicit returned and total counts for truncated topology', () => {
    const snapshot = {
      ...createSnapshot(),
      truncated: true,
      truncationReason: 'Node cap reached.',
      totals: { nodes: 20, edges: 40 }
    }

    expect(formatGraphSummary(snapshot)).toBe('1/20 nodes · 0/40 edges')
    expect(snapshot.truncationReason).toBeTruthy()
  })
})

function createSnapshot(): GraphSnapshot {
  return {
    revision: 'index:1',
    state: 'ready',
    scope: { kind: 'global' },
    nodes: [
      {
        id: 'note:alpha',
        status: 'resolved',
        relativePath: 'Alpha.mdx',
        title: 'Alpha',
        candidatePaths: [],
        incomingCount: 0,
        outgoingCount: 0,
        degree: 0,
        orphan: true,
        groupIds: []
      }
    ],
    edges: [],
    totals: { nodes: 1, edges: 0 },
    truncated: false,
    truncationReason: null
  }
}
