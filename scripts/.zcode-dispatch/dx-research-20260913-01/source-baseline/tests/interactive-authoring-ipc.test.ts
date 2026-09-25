import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type {
  InteractiveCreatePayload,
  InteractiveCreateResult
} from '../src/shared/interactive-authoring'

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

const { registerInteractiveAuthoringIpc } = await import(
  '../src/main/ipc/interactive-authoring-ipc'
)

beforeEach(() => {
  ipcHandlers.clear()
})

describe('GOAL-25 interactive authoring IPC', () => {
  test('registers one narrow create channel and returns a schema-validated result', async () => {
    const input = validPayload()
    const expected = validResult()
    let received: InteractiveCreatePayload | null = null
    registerInteractiveAuthoringIpc({
      createService: () => ({
        create: async (payload) => {
          received = payload
          return expected
        }
      })
    })

    expect([...ipcHandlers.keys()]).toEqual(['interactive:create'])
    const result = await requireHandler('interactive:create')(mainFrameEvent(), input)
    expect(result).toEqual({ ok: true, data: expected })
    expect(received).toEqual(input)
  })

  test('rejects malformed, traversal, oversized, and arbitrary-template payloads before mutation', async () => {
    let createCount = 0
    registerInteractiveAuthoringIpc({
      createService: () => ({
        create: async () => {
          createCount += 1
          return validResult()
        }
      })
    })
    const create = requireHandler('interactive:create')

    for (const payload of [
      {},
      { ...validPayload(), noteRelativePath: '../Note.mdx' },
      { ...validPayload(), slug: '../counter' },
      { ...validPayload(), displayName: 'x'.repeat(81) },
      { ...validPayload(), insertionOffset: 10 * 1024 * 1024 },
      { ...validPayload(), starter: 'renderer-source', componentSource: 'alert(1)' }
    ]) {
      const result = await create(mainFrameEvent(), payload)
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_FAILED')
    }

    expect(createCount).toBe(0)
  })

  test('requires the main frame and does not leak absolute paths from unexpected failures', async () => {
    let createCount = 0
    registerInteractiveAuthoringIpc({
      createService: () => ({
        create: async () => {
          createCount += 1
          throw new Error('EACCES: C:\\Users\\private\\vault\\interactives')
        }
      })
    })
    const create = requireHandler('interactive:create')

    for (const event of [{ sender: { mainFrame: {} } }, childFrameEvent()]) {
      const result = await create(event, validPayload())
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe('MAIN_FRAME_REQUIRED')
    }
    expect(createCount).toBe(0)

    const failure = await create(mainFrameEvent(), validPayload())
    expect(failure.ok).toBe(false)
    expect(failure.error?.code).toBe('INTERACTIVE_CREATE_FAILED')
    expect(failure.error?.message).not.toContain('C:\\Users\\private')
  })

  test('rejects an invalid service result instead of crossing an untyped bridge', async () => {
    registerInteractiveAuthoringIpc({
      createService: () => ({
        create: async () =>
          ({
            ...validResult(),
            componentRelativePath: 'C:\\Users\\private\\component.tsx'
          }) as InteractiveCreateResult
      })
    })

    const result = await requireHandler('interactive:create')(mainFrameEvent(), validPayload())
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_FAILED')
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

function validPayload(): InteractiveCreatePayload {
  return {
    noteRelativePath: 'notes/Lab.mdx',
    insertionOffset: 12,
    expectedContentHash: 'a'.repeat(64),
    displayName: 'Counter',
    slug: 'counter',
    starter: 'stateful-control'
  }
}

function validResult(): InteractiveCreateResult {
  return {
    noteRelativePath: 'notes/Lab.mdx',
    noteContent: '# Lab\n\n<Interactive src="../interactives/counter" />\n',
    projectRoot: 'interactives/counter',
    componentRelativePath: 'interactives/counter/component.tsx',
    insertedSource: '../interactives/counter',
    contentHash: 'b'.repeat(64)
  }
}
