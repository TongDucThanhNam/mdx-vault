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
  test('blocks traversal, absolute paths, and .trash paths on all three channels', async () => {
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
        }
      ]

      for (const ipcCase of cases) {
        const handler = requireHandler(ipcCase.channel)

        for (const path of ipcCase.paths) {
          const result = await handler({}, ipcCase.payload(path))
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
        'vault:read-image-file'
      ]) {
        const result = await requireHandler(channel)({}, {})
        expect(result.ok).toBe(false)
        expect(result.error?.code).toBe('VALIDATION_FAILED')
      }
    } finally {
      ipcHandlers.clear()
      await rm(root, { recursive: true, force: true })
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

async function writeFixture(
  root: string,
  relativePath: string,
  contents: string | Uint8Array
): Promise<void> {
  const target = join(root, ...relativePath.split('/'))
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, contents)
}
