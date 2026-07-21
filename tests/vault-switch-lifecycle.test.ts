import { describe, expect, test } from 'bun:test'
import { switchVault } from '../src/renderer/src/workbench/vault-switch-lifecycle'

describe('vault switch lifecycle', () => {
  test('a failed active-item save stops before opening the picker or resetting the workbench', async () => {
    const order: string[] = []

    const result = await switchVault({
      saveActiveItem: async () => {
        order.push('save')
        return false
      },
      chooseVault: async () => {
        order.push('choose')
        return { name: 'vault-b' }
      },
      commitVault: async () => {
        order.push('commit')
      }
    })

    expect(result).toBe('save_failed')
    expect(order).toEqual(['save'])
  })

  test('native picker cancellation leaves the current vault uncommitted', async () => {
    const order: string[] = []

    const result = await switchVault({
      saveActiveItem: async () => {
        order.push('save')
        return true
      },
      chooseVault: async () => {
        order.push('choose')
        return null
      },
      commitVault: async () => {
        order.push('commit')
      }
    })

    expect(result).toBe('cancelled')
    expect(order).toEqual(['save', 'choose'])
  })

  test('a successful choice commits only after save and picker completion', async () => {
    const order: string[] = []
    const chosenVault = { name: 'vault-b' }
    let committedVault: typeof chosenVault | null = null

    const result = await switchVault({
      saveActiveItem: async () => {
        order.push('save')
        return true
      },
      chooseVault: async () => {
        order.push('choose')
        return chosenVault
      },
      commitVault: async (vault) => {
        order.push('commit')
        committedVault = vault
      }
    })

    expect(result).toBe('committed')
    expect(committedVault).toBe(chosenVault)
    expect(order).toEqual(['save', 'choose', 'commit'])
  })

  test('a failed workbench commit rejects without manufacturing success', async () => {
    const order: string[] = []

    const operation = switchVault({
      saveActiveItem: async () => {
        order.push('save')
        return true
      },
      chooseVault: async () => {
        order.push('choose')
        return { name: 'vault-b' }
      },
      commitVault: async () => {
        order.push('commit')
        throw new Error('reset failed')
      }
    })

    await expect(operation).rejects.toThrow('reset failed')
    expect(order).toEqual(['save', 'choose', 'commit'])
  })
})
