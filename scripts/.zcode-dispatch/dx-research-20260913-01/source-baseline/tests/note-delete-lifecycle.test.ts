import { describe, expect, test } from 'bun:test'
import { deleteVaultNote } from '../src/renderer/src/workbench/note-delete-lifecycle'

describe('note delete lifecycle', () => {
  test('save preparation failure stops before the vault delete', async () => {
    const calls: string[] = []

    const deleted = await deleteVaultNote({
      prepareDelete: async () => {
        calls.push('save')
        return false
      },
      deleteFile: async () => {
        calls.push('delete')
      },
      refreshAfterDelete: async () => {
        calls.push('refresh')
      },
      commitDelete: async () => {
        calls.push('commit')
        return true
      },
      reportSuccess: () => calls.push('success')
    })

    expect(deleted).toBe(false)
    expect(calls).toEqual(['save'])
  })

  test('filesystem delete failure never commits or reports success', async () => {
    const calls: string[] = []

    await expect(
      deleteVaultNote({
        prepareDelete: async () => {
          calls.push('save')
          return true
        },
        deleteFile: async () => {
          calls.push('delete')
          throw new Error('injected delete failure')
        },
        refreshAfterDelete: async () => {
          calls.push('refresh')
        },
        commitDelete: async () => {
          calls.push('commit')
          return true
        },
        reportSuccess: () => calls.push('success')
      })
    ).rejects.toThrow('injected delete failure')

    expect(calls).toEqual(['save', 'delete'])
  })

  test('workbench commit failure keeps success reporting suppressed', async () => {
    const calls: string[] = []

    const deleted = await deleteVaultNote({
      prepareDelete: async () => {
        calls.push('save')
        return true
      },
      deleteFile: async () => {
        calls.push('delete')
      },
      refreshAfterDelete: async () => {
        calls.push('refresh')
      },
      commitDelete: async () => {
        calls.push('commit')
        return false
      },
      reportSuccess: () => calls.push('success')
    })

    expect(deleted).toBe(false)
    expect(calls).toEqual(['save', 'delete', 'refresh', 'commit'])
  })

  test('success refreshes after deletion, commits, and only then reports', async () => {
    const calls: string[] = []

    const deleted = await deleteVaultNote({
      prepareDelete: async () => {
        calls.push('save')
        return true
      },
      deleteFile: async () => {
        calls.push('delete')
      },
      refreshAfterDelete: async () => {
        calls.push('refresh')
      },
      commitDelete: async () => {
        calls.push('commit')
        return true
      },
      reportSuccess: () => calls.push('success')
    })

    expect(deleted).toBe(true)
    expect(calls).toEqual(['save', 'delete', 'refresh', 'commit', 'success'])
  })
})
