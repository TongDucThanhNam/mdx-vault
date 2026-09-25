import { beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  createDefaultGraphViewManifest,
  DEFAULT_GRAPH_VIEW_SETTINGS,
  type GraphConfigLoadResult,
  type GraphSnapshot,
  type GraphSnapshotRequest
} from '../src/shared/graph'

type IpcResult = {
  ok: boolean
  data?: unknown
  error?: { code: string; message: string }
}

type IpcHandler = (event: unknown, payload: unknown) => Promise<IpcResult>

const ipcHandlers = new Map<string, IpcHandler>()

mock.module('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => {
      ipcHandlers.set(channel, handler)
    }
  }
}))

const { registerGraphIpc } = await import('../src/main/ipc/graph-ipc')

beforeEach(() => {
  ipcHandlers.clear()
})

describe('GOAL-24 graph IPC', () => {
  test('returns schema-validated snapshot and configuration results', async () => {
    const manifest = createDefaultGraphViewManifest()
    const snapshot = createSnapshot()
    const saved: number[] = []
    registerGraphIpc({
      createQueryService: () => ({ getSnapshot: () => snapshot }),
      getConfigService: () => ({
        load: async () => ({ manifest, recovery: null }),
        save: async (_next, expectedRevision) => {
          saved.push(expectedRevision)
          return { manifest, recovery: null }
        }
      }),
      getSessionRevision: () => 4
    })

    const snapshotResult = await requireHandler('graph:get-snapshot')(
      mainFrameEvent(),
      createRequest()
    )
    const configResult = await requireHandler('graph:get-config')(mainFrameEvent(), undefined)
    const saveResult = await requireHandler('graph:save-config')(mainFrameEvent(), {
      manifest,
      expectedRevision: 0
    })

    expect(snapshotResult).toEqual({ ok: true, data: snapshot })
    expect(configResult).toEqual({
      ok: true,
      data: { manifest, recovery: null }
    })
    expect(saveResult.ok).toBe(true)
    expect(saved).toEqual([0])
  })

  test('rejects malformed, unsafe, and oversized requests before querying or saving', async () => {
    let queryCount = 0
    let saveCount = 0
    const manifest = createDefaultGraphViewManifest()
    registerGraphIpc({
      createQueryService: () => ({
        getSnapshot: () => {
          queryCount += 1
          return createSnapshot()
        }
      }),
      getConfigService: () => ({
        load: async () => ({ manifest, recovery: null }),
        save: async () => {
          saveCount += 1
          return { manifest, recovery: null }
        }
      }),
      getSessionRevision: () => 1
    })
    const getSnapshot = requireHandler('graph:get-snapshot')

    for (const payload of [
      { ...createRequest(), scope: { kind: 'local', rootRelativePath: '../secret.mdx', depth: 1 } },
      { ...createRequest(), scope: { kind: 'local', rootRelativePath: 'Note.mdx', depth: 5 } },
      {
        ...createRequest(),
        settings: { ...DEFAULT_GRAPH_VIEW_SETTINGS, query: 'x'.repeat(301) }
      },
      {
        ...createRequest(),
        groups: Array.from({ length: 9 }, (_, index) => ({
          id: `group-${index}`,
          label: `Group ${index}`,
          query: '',
          visualToken: 'blue'
        }))
      },
      {
        ...createRequest(),
        groups: [{ id: 'unsafe id', label: 'Unsafe', query: '', visualToken: 'blue' }]
      }
    ]) {
      const result = await getSnapshot(mainFrameEvent(), payload)
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_FAILED')
    }

    const invalidSave = await requireHandler('graph:save-config')(mainFrameEvent(), {
      manifest: { ...manifest, groups: Array.from({ length: 9 }, () => ({})) },
      expectedRevision: 0
    })
    expect(invalidSave.error?.code).toBe('VALIDATION_FAILED')
    expect(queryCount).toBe(0)
    expect(saveCount).toBe(0)
  })

  test('rejects missing and child-frame callers on every graph channel', async () => {
    const manifest = createDefaultGraphViewManifest()
    registerGraphIpc({
      createQueryService: () => ({ getSnapshot: createSnapshot }),
      getConfigService: () => ({
        load: async () => ({ manifest, recovery: null }),
        save: async () => ({ manifest, recovery: null })
      }),
      getSessionRevision: () => 1
    })

    const payloads: Record<string, unknown> = {
      'graph:get-snapshot': createRequest(),
      'graph:get-config': undefined,
      'graph:save-config': { manifest, expectedRevision: 0 }
    }

    for (const [channel, payload] of Object.entries(payloads)) {
      for (const event of [{ sender: { mainFrame: {} } }, childFrameEvent()]) {
        const result = await requireHandler(channel)(event, payload)
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('MAIN_FRAME_REQUIRED')
      }
    }
  })

  test('rejects oversized and dangling response topology at the main boundary', async () => {
    const oversized = createSnapshot()
    oversized.nodes = Array.from({ length: 2_501 }, (_, index) => ({
      id: `note:${index}`,
      status: 'resolved',
      relativePath: `notes/${index}.mdx`,
      title: `${index}`,
      candidatePaths: [],
      incomingCount: 0,
      outgoingCount: 0,
      degree: 0,
      orphan: true,
      groupIds: []
    }))
    const manifest = createDefaultGraphViewManifest()
    registerGraphIpc({
      createQueryService: () => ({ getSnapshot: () => oversized }),
      getConfigService: () => ({
        load: async () => ({ manifest, recovery: null }),
        save: async () => ({ manifest, recovery: null })
      }),
      getSessionRevision: () => 1
    })

    const result = await requireHandler('graph:get-snapshot')(mainFrameEvent(), createRequest())
    expect(result.ok).toBe(false)
    expect(result.data).toBeUndefined()
    expect(result.error?.code).toBe('VALIDATION_FAILED')
  })

  test('rejects a config result when the active vault changes during an async read', async () => {
    let sessionRevision = 8
    const manifest = createDefaultGraphViewManifest()
    registerGraphIpc({
      createQueryService: () => ({ getSnapshot: createSnapshot }),
      getConfigService: () => ({
        load: async () => {
          sessionRevision += 1
          return { manifest, recovery: null }
        },
        save: async () => ({ manifest, recovery: null })
      }),
      getSessionRevision: () => sessionRevision
    })

    const result = await requireHandler('graph:get-config')(mainFrameEvent(), undefined)
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('STALE_VAULT')
  })

  test('does not expose absolute filesystem details from service failures', async () => {
    const manifest = createDefaultGraphViewManifest()
    registerGraphIpc({
      createQueryService: () => ({
        getSnapshot: () => {
          throw new Error('EACCES: C:\\Users\\private\\.app\\index.sqlite')
        }
      }),
      getConfigService: () => ({
        load: async (): Promise<GraphConfigLoadResult> => {
          throw new Error('EACCES: C:\\Users\\private\\.app\\graph-view.json')
        },
        save: async () => ({ manifest, recovery: null })
      }),
      getSessionRevision: () => 1
    })

    for (const [channel, payload] of [
      ['graph:get-snapshot', createRequest()],
      ['graph:get-config', undefined]
    ] as const) {
      const result = await requireHandler(channel)(mainFrameEvent(), payload)
      expect(result.ok).toBe(false)
      expect(result.error?.message).not.toContain('C:\\Users\\private')
    }
  })
})

function createRequest(): GraphSnapshotRequest {
  return {
    scope: { kind: 'global' },
    settings: { ...DEFAULT_GRAPH_VIEW_SETTINGS },
    groups: []
  }
}

function createSnapshot(): GraphSnapshot {
  return {
    revision: 'index:1',
    state: 'ready',
    scope: { kind: 'global' },
    nodes: [],
    edges: [],
    totals: { nodes: 0, edges: 0 },
    truncated: false,
    truncationReason: null
  }
}

function requireHandler(channel: string): IpcHandler {
  const handler = ipcHandlers.get(channel)
  if (!handler) throw new Error(`IPC handler was not registered: ${channel}`)
  return handler
}

function mainFrameEvent(): unknown {
  const mainFrame = {}
  return { senderFrame: mainFrame, sender: { mainFrame } }
}

function childFrameEvent(): unknown {
  return { senderFrame: {}, sender: { mainFrame: {} } }
}
