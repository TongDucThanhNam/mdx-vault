import { describe, expect, test } from 'bun:test'
import type { VaultTreeFile } from '../src/renderer/src/vault/types'
import {
  createAndOpenVaultNote,
  openRefreshedVaultFile,
  openVaultNote
} from '../src/renderer/src/workbench/note-action-lifecycle'

const CREATED_FILE: VaultTreeFile = {
  relativePath: 'journal/2026-07-21.mdx',
  name: '2026-07-21.mdx',
  directory: 'journal',
  extension: '.mdx'
}

describe('note action lifecycle', () => {
  test('a failed active-item save stops before creating a file', async () => {
    const calls: string[] = []

    await expect(
      createAndOpenVaultNote({
        relativePath: CREATED_FILE.relativePath,
        content: 'new note',
        saveActiveItem: async () => {
          calls.push('save')
          return false
        },
        createFile: async () => {
          calls.push('create')
          return CREATED_FILE.relativePath
        },
        refreshVaultSnapshot: async () => {
          calls.push('refresh')
          return [CREATED_FILE]
        },
        openCreatedFile: async () => {
          calls.push('open')
          return true
        },
        rollbackCreatedFile: async () => {
          calls.push('rollback')
        }
      })
    ).rejects.toThrow('note creation was cancelled')

    expect(calls).toEqual(['save'])
  })

  test('a failed activation rolls the created note out of the vault', async () => {
    const calls: string[] = []
    const vaultPaths = new Set<string>()

    await expect(
      createAndOpenVaultNote({
        relativePath: CREATED_FILE.relativePath,
        content: 'new note',
        saveActiveItem: async () => {
          calls.push('save')
          return true
        },
        createFile: async (relativePath) => {
          calls.push('create')
          vaultPaths.add(relativePath)
          return relativePath
        },
        refreshVaultSnapshot: async () => {
          calls.push('refresh')
          return vaultPaths.has(CREATED_FILE.relativePath) ? [CREATED_FILE] : []
        },
        openCreatedFile: async () => {
          calls.push('open')
          return false
        },
        rollbackCreatedFile: async (relativePath) => {
          calls.push('rollback')
          vaultPaths.delete(relativePath)
        }
      })
    ).rejects.toThrow('was moved to trash')

    expect(calls).toEqual(['save', 'create', 'refresh', 'open', 'rollback', 'refresh'])
    expect([...vaultPaths]).toEqual([])
  })

  test('a successful create opens the exact refreshed file without rollback', async () => {
    const calls: string[] = []

    const createdPath = await createAndOpenVaultNote({
      relativePath: CREATED_FILE.relativePath,
      content: 'new note',
      saveActiveItem: async () => {
        calls.push('save')
        return true
      },
      createFile: async (relativePath, content) => {
        calls.push(`create:${relativePath}:${content}`)
        return relativePath
      },
      refreshVaultSnapshot: async () => {
        calls.push('refresh')
        return [CREATED_FILE]
      },
      openCreatedFile: async (relativePath, file) => {
        calls.push(`open:${relativePath}:${file.relativePath}`)
        return true
      },
      rollbackCreatedFile: async () => {
        calls.push('rollback')
      }
    })

    expect(createdPath).toBe(CREATED_FILE.relativePath)
    expect(calls).toEqual([
      'save',
      `create:${CREATED_FILE.relativePath}:new note`,
      'refresh',
      `open:${CREATED_FILE.relativePath}:${CREATED_FILE.relativePath}`
    ])
  })

  test('existing daily/random note actions report success only after activation succeeds', async () => {
    const reports: string[] = []

    expect(
      await openVaultNote(
        async () => false,
        () => reports.push('opened')
      )
    ).toBe(false)
    expect(reports).toEqual([])

    expect(
      await openVaultNote(
        async () => true,
        () => reports.push('opened')
      )
    ).toBe(true)
    expect(reports).toEqual(['opened'])
  })

  test('duplicate-style activation uses the refreshed file and suppresses false success', async () => {
    const calls: string[] = []

    expect(
      await openRefreshedVaultFile({
        relativePath: CREATED_FILE.relativePath,
        refreshVaultSnapshot: async () => {
          calls.push('refresh')
          return [CREATED_FILE]
        },
        openFile: async (relativePath, file) => {
          calls.push(`open:${relativePath}:${file.relativePath}`)
          return false
        }
      })
    ).toBe(false)

    expect(calls).toEqual([
      'refresh',
      `open:${CREATED_FILE.relativePath}:${CREATED_FILE.relativePath}`
    ])
  })
})
