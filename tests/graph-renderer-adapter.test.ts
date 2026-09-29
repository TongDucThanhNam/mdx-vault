import { describe, expect, test } from 'bun:test'
import type cytoscape from 'cytoscape'

import {
  createCoseLayoutOptions,
  createCytoscapeGraphAdapter,
  createGraphElements
} from '../src/renderer/src/graph/cytoscape-adapter'
import {
  DEFAULT_GRAPH_VIEW_SETTINGS,
  type GraphGroup,
  type GraphSnapshot
} from '../src/shared/graph'

describe('GOAL-24 Cytoscape adapter', () => {
  test('groups orphan nodes under a labeled, quiet parent without changing graph data', () => {
    installDocumentStub()
    const snapshot = createSnapshot()
    snapshot.nodes[0]!.orphan = true
    const elements = createGraphElements(snapshot, DEFAULT_GRAPH_VIEW_SETTINGS, null)
    expect(elements.find((element) => element.data.id === 'graph:orphans')?.data.label).toBe(
      'Orphans (1)'
    )
    expect(elements.find((element) => element.data.id === snapshot.nodes[0]!.id)?.data.parent).toBe(
      'graph:orphans'
    )
    expect(snapshot.nodes).toHaveLength(2)
  })
  test('creates stable element data and maps bounded controls to built-in CoSE', () => {
    installDocumentStub()
    const snapshot = createSnapshot()
    const elements = createGraphElements(
      snapshot,
      DEFAULT_GRAPH_VIEW_SETTINGS,
      'notes/Alpha.mdx',
      TEST_GROUPS
    )
    const layout = createCoseLayoutOptions(snapshot, DEFAULT_GRAPH_VIEW_SETTINGS, true)

    expect(elements).toHaveLength(3)
    expect(elements[0]?.data).toMatchObject({
      id: 'note:alpha',
      active: 'yes',
      color: '#be123c',
      shape: 'ellipse'
    })
    expect(layout).toMatchObject({
      name: 'cose',
      animate: false,
      nodeRepulsion: DEFAULT_GRAPH_VIEW_SETTINGS.repelForce,
      idealEdgeLength: DEFAULT_GRAPH_VIEW_SETTINGS.linkDistance,
      gravity: DEFAULT_GRAPH_VIEW_SETTINGS.centerForce
    })
  })

  test('resizes, stops layout, and destroys every owned resource', async () => {
    const theme = installDocumentStub()
    const resizeObservers: FakeResizeObserver[] = []
    const mutationObservers: FakeMutationObserver[] = []
    globalThis.ResizeObserver = class extends FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback)
        resizeObservers.push(this)
      }
    } as typeof ResizeObserver
    globalThis.MutationObserver = class extends FakeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback)
        mutationObservers.push(this)
      }
    } as typeof MutationObserver
    const harness = createCoreHarness()
    const adapter = await createCytoscapeGraphAdapter(
      {
        container: { clientWidth: 800, clientHeight: 500 } as HTMLElement,
        snapshot: createSnapshot(),
        settings: DEFAULT_GRAPH_VIEW_SETTINGS,
        groups: TEST_GROUPS,
        activeRelativePath: null,
        reducedMotion: true,
        onSelectNode: () => undefined,
        onOpenNode: () => undefined,
        onContextNode: () => undefined
      },
      async () => harness.library
    )

    expect(harness.calls).toContain('layout.run')
    resizeObservers[0]?.callback([], resizeObservers[0])
    expect(harness.calls).toContain('resize')
    theme.dark = true
    mutationObservers[0]?.callback([], mutationObservers[0])
    expect(harness.calls).toContain('data:color:#fb7185')
    adapter.fit()
    adapter.panBy(10, -10)
    adapter.zoomBy(1.2)
    adapter.setSnapshot(createSnapshot(), DEFAULT_GRAPH_VIEW_SETTINGS, TEST_GROUPS)
    adapter.destroy()

    expect(harness.calls).toContain('fit')
    expect(harness.calls).toContain('panBy')
    expect(harness.calls.filter((call) => call === 'layout.stop').length).toBeGreaterThan(0)
    expect(harness.calls).toContain('stop')
    expect(harness.calls).toContain('destroy')
    expect(resizeObservers[0]?.disconnected).toBe(true)
    expect(mutationObservers[0]?.disconnected).toBe(true)
  })
})

const TEST_GROUPS: GraphGroup[] = [
  {
    id: 'primary',
    label: 'Primary',
    query: 'path:notes',
    visualToken: 'red'
  }
]

class FakeResizeObserver {
  disconnected = false

  constructor(readonly callback: ResizeObserverCallback) {}

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true
  }
}

class FakeMutationObserver {
  disconnected = false

  constructor(readonly callback: MutationCallback) {}

  observe(): void {}
  takeRecords(): MutationRecord[] {
    return []
  }
  disconnect(): void {
    this.disconnected = true
  }
}

function createCoreHarness(): {
  library: typeof cytoscape
  calls: string[]
} {
  const calls: string[] = []
  const collection = {
    removeClass: () => collection,
    addClass: () => collection,
    toggleClass: () => collection,
    not: () => collection,
    closedNeighborhood: () => collection,
    empty: () => false,
    remove: () => collection,
    id: () => 'note:alpha',
    data: (key?: string, value?: unknown) => {
      if (key && value !== undefined) calls.push(`data:${key}:${String(value)}`)
      return collection
    }
  }
  let zoom = 1
  const core = {
    on: () => core,
    elements: () => collection,
    nodes: () => collection,
    getElementById: () => collection,
    batch: (run: () => void) => run(),
    add: () => collection,
    style: () => core,
    layout: () => ({
      run: () => calls.push('layout.run'),
      stop: () => calls.push('layout.stop')
    }),
    resize: () => {
      calls.push('resize')
      return core
    },
    fit: () => {
      calls.push('fit')
      return core
    },
    zoom: (input?: unknown) => {
      if (input !== undefined) {
        calls.push('zoom')
        if (typeof input === 'object' && input && 'level' in input) {
          zoom = Number((input as { level: number }).level)
        }
        return core
      }
      return zoom
    },
    panBy: () => {
      calls.push('panBy')
      return core
    },
    animate: () => core,
    stop: () => {
      calls.push('stop')
      return core
    },
    destroy: () => calls.push('destroy')
  }
  const library = (() => core) as unknown as typeof cytoscape
  return { library, calls }
}

function createSnapshot(): GraphSnapshot {
  return {
    revision: 'index:1',
    state: 'ready',
    scope: { kind: 'global' },
    nodes: [
      {
        id: 'note:alpha',
        status: 'resolved',
        relativePath: 'notes/Alpha.mdx',
        title: 'Alpha',
        candidatePaths: [],
        incomingCount: 0,
        outgoingCount: 1,
        degree: 1,
        orphan: false,
        groupIds: ['primary']
      },
      {
        id: 'note:beta',
        status: 'resolved',
        relativePath: 'notes/Beta.mdx',
        title: 'Beta',
        candidatePaths: [],
        incomingCount: 1,
        outgoingCount: 0,
        degree: 1,
        orphan: false,
        groupIds: []
      }
    ],
    edges: [
      {
        id: 'edge:alpha-beta',
        sourceId: 'note:alpha',
        targetId: 'note:beta',
        occurrenceCount: 2
      }
    ],
    totals: { nodes: 2, edges: 1 },
    truncated: false,
    truncationReason: null
  }
}

function installDocumentStub(): { dark: boolean } {
  const theme = { dark: false }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: {
        classList: { contains: () => theme.dark }
      }
    }
  })
  return theme
}
