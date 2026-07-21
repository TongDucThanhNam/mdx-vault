import { describe, expect, test } from 'bun:test'
import { persistAndReconcileSettings } from '../src/renderer/src/settings/app-settings-reconciliation'
import {
  type AppSettingsPatch,
  type AppSettingsSnapshot,
  DEFAULT_APP_SETTINGS_SNAPSHOT
} from '../src/shared/app-settings'

interface Snapshot {
  value: string
}

interface Patch {
  value: string
}

describe('renderer settings reconciliation', () => {
  test('returns the main-process snapshot after a successful write', async () => {
    const result = await persistAndReconcileSettings<Snapshot, Patch>(
      {
        getSettings: async () => ({ value: 'stored-before' }),
        updateSettings: async (patch) => ({ value: patch.value })
      },
      { value: 'confirmed' }
    )

    expect(result).toEqual({ saved: true, snapshot: { value: 'confirmed' }, error: null })
  })

  test('reads and returns the actual persisted snapshot after a rejected write', async () => {
    const calls: string[] = []
    const result = await persistAndReconcileSettings<Snapshot, Patch>(
      {
        getSettings: async () => {
          calls.push('read')
          return { value: 'persisted' }
        },
        updateSettings: async () => {
          calls.push('write')
          throw new Error('disk full')
        }
      },
      { value: 'optimistic-only' }
    )

    expect(calls).toEqual(['write', 'read'])
    expect(result.saved).toBe(false)
    expect(result.snapshot).toEqual({ value: 'persisted' })
    expect(result.error).toContain('disk full')
    expect(result.error).toContain('restored to the persisted value')
  })

  test('keeps the persistence error visible when reconciliation also fails', async () => {
    const result = await persistAndReconcileSettings<Snapshot, Patch>(
      {
        getSettings: async () => {
          throw new Error('read denied')
        },
        updateSettings: async () => {
          throw new Error('write denied')
        }
      },
      { value: 'unconfirmed' }
    )

    expect(result.saved).toBe(false)
    expect(result.snapshot).toBeNull()
    expect(result.error).toContain('write denied')
    expect(result.error).toContain('read denied')
  })

  test('restores confirmed theme and file-sort consumers after a rejected write', async () => {
    const persisted: AppSettingsSnapshot = {
      ...DEFAULT_APP_SETTINGS_SNAPSHOT,
      theme: 'dark',
      fileTreeSort: 'created-desc'
    }
    let renderedSnapshot = persisted

    const result = await persistAndReconcileSettings<AppSettingsSnapshot, AppSettingsPatch>(
      {
        getSettings: async () => persisted,
        updateSettings: async () => {
          throw new Error('settings volume is read-only')
        }
      },
      { theme: 'light', fileTreeSort: 'name' }
    )

    if (result.snapshot) {
      renderedSnapshot = result.snapshot
    }

    expect(result.saved).toBe(false)
    expect(renderedSnapshot.theme).toBe('dark')
    expect(renderedSnapshot.fileTreeSort).toBe('created-desc')
    expect(result.error).toContain('settings volume is read-only')
  })
})
