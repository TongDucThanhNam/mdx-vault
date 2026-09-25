import { formatError } from '@/lib/format-error'

export interface SettingsPersistenceApi<TSnapshot, TPatch> {
  getSettings: () => Promise<TSnapshot>
  updateSettings: (patch: TPatch) => Promise<TSnapshot>
}

export type SettingsPersistenceResult<TSnapshot> =
  | { saved: true; snapshot: TSnapshot; error: null }
  | { saved: false; snapshot: TSnapshot | null; error: string }

/**
 * Persist one patch and, on rejection, immediately read the actual stored
 * snapshot. The renderer may report the failure, but never keeps a value that
 * only existed optimistically in memory.
 */
export async function persistAndReconcileSettings<TSnapshot, TPatch>(
  api: SettingsPersistenceApi<TSnapshot, TPatch>,
  patch: TPatch
): Promise<SettingsPersistenceResult<TSnapshot>> {
  try {
    return {
      saved: true,
      snapshot: await api.updateSettings(patch),
      error: null
    }
  } catch (writeError) {
    try {
      return {
        saved: false,
        snapshot: await api.getSettings(),
        error: `Could not save settings. ${formatError(writeError)} The controls were restored to the persisted value.`
      }
    } catch (refreshError) {
      return {
        saved: false,
        snapshot: null,
        error: `Could not save settings. ${formatError(writeError)} The persisted value could not be reloaded: ${formatError(refreshError)}`
      }
    }
  }
}
