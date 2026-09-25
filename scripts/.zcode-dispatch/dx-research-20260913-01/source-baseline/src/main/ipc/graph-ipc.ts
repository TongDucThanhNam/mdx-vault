import { type IpcMainInvokeEvent, ipcMain } from 'electron'
import { z } from 'zod'

import {
  type GraphConfigLoadResult,
  type GraphSnapshot,
  graphConfigLoadResultSchema,
  graphConfigSaveRequestSchema,
  graphSnapshotRequestSchema,
  graphSnapshotSchema
} from '../../shared/graph'
import type { GraphConfigService } from '../services/graph-config-service'
import { GraphQueryService } from '../services/graph-query-service'
import {
  getCurrentGraphConfig,
  getCurrentIndex,
  getCurrentVaultSessionRevision
} from '../services/vault-session'
import type { IpcFailure, IpcResult } from './vault-ipc'

interface GraphIpcDependencies {
  createQueryService: () => Pick<GraphQueryService, 'getSnapshot'>
  getConfigService: () => Pick<GraphConfigService, 'load' | 'save'>
  getSessionRevision: () => number
}

const emptyPayloadSchema = z.undefined()

export function registerGraphIpc(
  dependencies: GraphIpcDependencies = createDefaultDependencies()
): void {
  ipcMain.handle(
    'graph:get-snapshot',
    (event, payload): Promise<IpcResult<GraphSnapshot>> =>
      handleGraphRequest(event, 'query', async () => {
        const request = graphSnapshotRequestSchema.parse(payload)
        return graphSnapshotSchema.parse(dependencies.createQueryService().getSnapshot(request))
      })
  )

  ipcMain.handle(
    'graph:get-config',
    (event, payload): Promise<IpcResult<GraphConfigLoadResult>> =>
      handleGraphRequest(event, 'config', async () => {
        emptyPayloadSchema.parse(payload)
        const sessionRevision = dependencies.getSessionRevision()
        const result = await dependencies.getConfigService().load()
        assertCurrentSession(sessionRevision, dependencies.getSessionRevision())
        return graphConfigLoadResultSchema.parse(result)
      })
  )

  ipcMain.handle(
    'graph:save-config',
    (event, payload): Promise<IpcResult<GraphConfigLoadResult>> =>
      handleGraphRequest(event, 'config', async () => {
        const request = graphConfigSaveRequestSchema.parse(payload)
        const sessionRevision = dependencies.getSessionRevision()
        const result = await dependencies
          .getConfigService()
          .save(request.manifest, request.expectedRevision)
        assertCurrentSession(sessionRevision, dependencies.getSessionRevision())
        return graphConfigLoadResultSchema.parse(result)
      })
  )
}

function createDefaultDependencies(): GraphIpcDependencies {
  return {
    createQueryService: () => {
      const index = getCurrentIndex()
      return new GraphQueryService(index.database, () => index.revision)
    },
    getConfigService: getCurrentGraphConfig,
    getSessionRevision: getCurrentVaultSessionRevision
  }
}

async function handleGraphRequest<T>(
  event: IpcMainInvokeEvent,
  operation: 'query' | 'config',
  run: () => Promise<T>
): Promise<IpcResult<T>> {
  try {
    assertMainFrame(event)
    return { ok: true, data: await run() }
  } catch (error) {
    return { ok: false, error: toGraphIpcError(error, operation) }
  }
}

function assertMainFrame(event: IpcMainInvokeEvent): void {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    throw new GraphIpcError(
      'MAIN_FRAME_REQUIRED',
      'Graph IPC is only available to the main renderer frame'
    )
  }
}

function assertCurrentSession(before: number, after: number): void {
  if (before !== after) {
    throw new GraphIpcError(
      'STALE_VAULT',
      'The active vault changed before the graph request completed'
    )
  }
}

class GraphIpcError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'GraphIpcError'
  }
}

function toGraphIpcError(error: unknown, operation: 'query' | 'config'): IpcFailure['error'] {
  if (error instanceof z.ZodError) {
    return {
      code: 'VALIDATION_FAILED',
      message: 'Invalid graph request or response'
    }
  }
  if (error instanceof GraphIpcError) {
    return { code: error.code, message: error.message }
  }
  if (error instanceof Error && error.message.includes('another operation')) {
    return {
      code: 'GRAPH_CONFIG_CONFLICT',
      message: 'Graph settings changed in another operation. Reload before saving.'
    }
  }
  if (error instanceof Error && error.message.includes('recovery is required')) {
    return {
      code: 'GRAPH_CONFIG_RECOVERY_REQUIRED',
      message:
        'Graph configuration recovery is required at .app/graph-view.json; the existing file was preserved.'
    }
  }

  return operation === 'query'
    ? {
        code: 'GRAPH_QUERY_ERROR',
        message: 'Graph query could not be evaluated'
      }
    : {
        code: 'GRAPH_CONFIG_ERROR',
        message: 'Graph configuration is unavailable'
      }
}
