import { useCallback, useEffect, useRef, useState } from 'react'
import { formatError } from '@/lib/format-error'
import { persistAndReconcileSettings } from '@/settings/app-settings-reconciliation'
import type { AppSettingsPatch, AppSettingsSnapshot } from '../../../shared/app-settings'

export type { AppSettingsPatch, AppSettingsSnapshot } from '../../../shared/app-settings'
export { DEFAULT_APP_SETTINGS_SNAPSHOT } from '../../../shared/app-settings'

interface UseAppSettingsOptions {
  /** SettingsDialog disables its private controller when App supplies the shared one. */
  enabled?: boolean
  /** Promotes settings failures to an application-level error surface. */
  onError?: (message: string) => void
}

export interface AppSettingsController {
  /** Null until a renderer-visible snapshot has been confirmed by the main process. */
  snapshot: AppSettingsSnapshot | null
  isLoading: boolean
  isPending: boolean
  error: string | null
  reload: () => Promise<AppSettingsSnapshot | null>
  /**
   * Resolves to the confirmed snapshot, or null after a rejected write. Rejected
   * writes are followed by a read so the UI cannot retain an optimistic value.
   */
  updateSettings: (patch: AppSettingsPatch) => Promise<AppSettingsSnapshot | null>
  reportError: (message: string) => void
  dismissError: () => void
}

export function useAppSettings({
  enabled = true,
  onError
}: UseAppSettingsOptions = {}): AppSettingsController {
  const [snapshot, setSnapshot] = useState<AppSettingsSnapshot | null>(null)
  const [loadingCount, setLoadingCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(false)
  const requestSequenceRef = useRef(0)
  const committedSequenceRef = useRef(0)
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const publishError = useCallback(
    (message: string): void => {
      if (!mountedRef.current) {
        return
      }
      setError(message)
      onError?.(message)
    },
    [onError]
  )

  const commitConfirmedSnapshot = useCallback(
    (confirmed: AppSettingsSnapshot, requestSequence: number): void => {
      if (!mountedRef.current || requestSequence < committedSequenceRef.current) {
        return
      }
      committedSequenceRef.current = requestSequence
      setSnapshot(confirmed)
    },
    []
  )

  const reload = useCallback(async (): Promise<AppSettingsSnapshot | null> => {
    if (!window.appApi) {
      publishError('Application settings are unavailable in this renderer.')
      return null
    }

    const requestSequence = ++requestSequenceRef.current
    if (mountedRef.current) {
      setLoadingCount((count) => count + 1)
      setError(null)
    }

    try {
      const confirmed = await window.appApi.getSettings()
      commitConfirmedSnapshot(confirmed, requestSequence)
      return confirmed
    } catch (loadError) {
      publishError(`Could not load settings. ${formatError(loadError)}`)
      return null
    } finally {
      if (mountedRef.current) {
        setLoadingCount((count) => Math.max(0, count - 1))
      }
    }
  }, [commitConfirmedSnapshot, publishError])

  useEffect(() => {
    if (enabled) {
      void reload()
    }
  }, [enabled, reload])

  const updateSettings = useCallback(
    (patch: AppSettingsPatch): Promise<AppSettingsSnapshot | null> => {
      if (!window.appApi) {
        publishError('Application settings are unavailable in this renderer.')
        return Promise.resolve(null)
      }

      const requestSequence = ++requestSequenceRef.current
      if (mountedRef.current) {
        setPendingCount((count) => count + 1)
        setError(null)
      }

      let resolveMutation: (snapshot: AppSettingsSnapshot | null) => void = () => undefined
      const result = new Promise<AppSettingsSnapshot | null>((resolve) => {
        resolveMutation = resolve
      })

      const operation = mutationQueueRef.current.then(async () => {
        const result = await persistAndReconcileSettings(window.appApi, patch)
        if (result.snapshot) {
          commitConfirmedSnapshot(result.snapshot, requestSequence)
        }
        if (!result.saved) {
          publishError(result.error)
        }
        resolveMutation(result.saved ? result.snapshot : null)

        if (mountedRef.current) {
          setPendingCount((count) => Math.max(0, count - 1))
        }
      })

      mutationQueueRef.current = operation.catch(() => undefined)
      return result
    },
    [commitConfirmedSnapshot, publishError]
  )

  const dismissError = useCallback((): void => {
    setError(null)
  }, [])

  const reportError = publishError

  return {
    snapshot,
    isLoading: loadingCount > 0,
    isPending: pendingCount > 0,
    error,
    reload,
    updateSettings,
    reportError,
    dismissError
  }
}
