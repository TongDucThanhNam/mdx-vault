import { afterAll, describe, expect, mock, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

import { VaultService } from '../src/main/services/vault-service'

type IpcHandler = (
  event: unknown,
  payload: unknown
) => Promise<{
  ok: boolean
  data?: unknown
  error?: { code: string; message: string }
}>

const ipcHandlers = new Map<string, IpcHandler>()

mock.module('electron', () => ({
  BrowserWindow: { fromWebContents: () => null },
  dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => {
      ipcHandlers.set(channel, handler)
    }
  },
  shell: { showItemInFolder: () => undefined }
}))

const { registerVaultFileAccessIpc } = await import('../src/main/ipc/vault-ipc')

afterAll(() => {
  mock.restore()
})

describe('GOAL-16 vault file IPC', () => {
  test('blocks traversal, absolute paths, and .trash paths on every direct-access channel', async () => {
    const base = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-ipc-'))
    const root = join(base, 'vault')
    const vault = new VaultService(root)

    try {
      await writeFixture(base, 'outside.csv', 'outside')
      await writeFixture(base, 'outside.png', 'outside image')
      await writeFixture(root, '.trash/hidden.csv', 'hidden')
      await writeFixture(root, '.trash/hidden.png', 'hidden image')
      registerVaultFileAccessIpc(() => vault)

      const cases = [
        {
          channel: 'vault:read-text-file',
          paths: ['../outside.csv', join(base, 'outside.csv'), '.trash/hidden.csv'],
          payload: (relativePath: string) => ({ relativePath })
        },
        {
          channel: 'vault:write-text-file',
          paths: ['../outside.csv', join(base, 'outside.csv'), '.trash/hidden.csv'],
          payload: (relativePath: string) => ({ relativePath, content: 'changed' })
        },
        {
          channel: 'vault:read-image-file',
          paths: ['../outside.png', join(base, 'outside.png'), '.trash/hidden.png'],
          payload: (relativePath: string) => ({ relativePath })
        },
        {
          channel: 'vault:probe-file',
          paths: ['../outside.png', join(base, 'outside.png'), '.trash/hidden.png'],
          payload: (relativePath: string) => ({ relativePath })
        }
      ]

      for (const ipcCase of cases) {
        const handler = requireHandler(ipcCase.channel)

        for (const path of ipcCase.paths) {
          const event = ipcCase.channel === 'vault:probe-file' ? mainFrameEvent() : {}
          const result = await handler(event, ipcCase.payload(path))
          expect(result.ok).toBe(false)
          expect(result.error?.code).toBe('VAULT_ERROR')
        }
      }
    } finally {
      ipcHandlers.clear()
      await rm(base, { recursive: true, force: true })
    }
  })

  test('zod-validates payloads before invoking file access', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-ipc-validation-'))
    const vault = new VaultService(root)

    try {
      registerVaultFileAccessIpc(() => vault)

      for (const channel of [
        'vault:read-text-file',
        'vault:write-text-file',
        'vault:read-image-file',
        'vault:probe-file'
      ]) {
        const event = channel === 'vault:probe-file' ? mainFrameEvent() : {}
        const result = await requireHandler(channel)(event, {})
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('VALIDATION_FAILED')
      }
    } finally {
      ipcHandlers.clear()
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects missing and child-frame probe callers before file access', async () => {
    let probeCount = 0
    const vault = {
      probeFile: async () => {
        probeCount += 1
      }
    } as unknown as VaultService

    try {
      registerVaultFileAccessIpc(() => vault)
      const probe = requireHandler('vault:probe-file')

      for (const event of [{ sender: { mainFrame: {} } }, childFrameEvent()]) {
        const result = await probe(event, { relativePath: 'archive.bin' })
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('VAULT_ERROR')
        expect(result.error?.message).toContain('main renderer frame')
      }

      expect(probeCount).toBe(0)
    } finally {
      ipcHandlers.clear()
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

async function writeFixture(
  root: string,
  relativePath: string,
  contents: string | Uint8Array
): Promise<void> {
  const target = join(root, ...relativePath.split('/'))
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, contents)
}
