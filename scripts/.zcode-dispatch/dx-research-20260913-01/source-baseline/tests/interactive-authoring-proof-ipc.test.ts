import { beforeEach, describe, expect, mock, test } from 'bun:test'

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
  },
  protocol: {
    handle: () => {},
    registerSchemesAsPrivileged: () => {}
  }
}))

const { registerSandboxIpc } = await import('../src/main/ipc/sandbox-ipc')

beforeEach(() => {
  ipcHandlers.clear()
})

describe('interactive authoring proof IPC', () => {
  test('registers one explicit authoring-proof mode alongside the normal sandbox contract', () => {
    registerSandboxIpc()
    expect(ipcHandlers.has('sandbox:load-authoring-proof')).toBe(true)
    expect(ipcHandlers.has('sandbox:set-permission')).toBe(true)
    expect(ipcHandlers.has('sandbox:request-data')).toBe(true)
  })

  test('rejects missing and child-frame callers before touching vault state', async () => {
    registerSandboxIpc()
    const loadProof = requireHandler('sandbox:load-authoring-proof')
    const payload = validPayload()

    for (const event of [{ sender: { mainFrame: {} } }, childFrameEvent()]) {
      const result = await loadProof(event, payload)
      expect(result).toEqual({
        ok: false,
        error: {
          code: 'MAIN_FRAME_REQUIRED',
          message: 'Sandbox IPC is only available to the main renderer frame'
        }
      })
    }
  })

  test('rejects traversal, missing mode, oversized props, and boolean bypasses', async () => {
    registerSandboxIpc()
    const loadProof = requireHandler('sandbox:load-authoring-proof')

    for (const payload of [
      {},
      { ...validPayload(), mode: undefined },
      { ...validPayload(), mode: 'normal' },
      { ...validPayload(), projectRoot: '../interactives/counter' },
      { ...validPayload(), projectRoot: 'interactives/counter/nested' },
      { ...validPayload(), allowPermissions: true },
      { ...validPayload(), instanceId: 'x'.repeat(129) },
      { ...validPayload(), props: { label: 'x'.repeat(64 * 1024 + 1) } }
    ]) {
      const result = await loadProof(mainFrameEvent(), payload)
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_FAILED')
    }
  })
})

function requireHandler(channel: string): IpcHandler {
  const handler = ipcHandlers.get(channel)
  if (!handler) {
    throw new Error(`IPC handler was not registered: ${channel}`)
  }
  return handler
}

function mainFrameEvent(): unknown {
  const mainFrame = {}
  return { senderFrame: mainFrame, sender: { mainFrame } }
}

function childFrameEvent(): unknown {
  return { senderFrame: {}, sender: { mainFrame: {} } }
}

function validPayload(): unknown {
  return {
    mode: 'authoring-proof',
    projectRoot: 'interactives/counter',
    instanceId: 'proof-instance',
    props: {}
  }
}
