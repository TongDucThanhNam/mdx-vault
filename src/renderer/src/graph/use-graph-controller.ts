import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  GraphConfigRecovery,
  GraphGroup,
  GraphScope,
  GraphSnapshot,
  GraphSnapshotRequest,
  GraphViewManifest,
  GraphViewSettings,
  LocalGraphViewSettings
} from '../../../shared/graph'
import {
  createDefaultGraphViewManifest,
  DEFAULT_GRAPH_VIEW_SETTINGS,
  DEFAULT_LOCAL_GRAPH_VIEW_SETTINGS
} from '../../../shared/graph'
import { createGraphTopologyRequestKey, toGraphQuerySettings } from './graph-query-settings'
import { createGraphRequestCoordinator } from './graph-request-coordinator'
import { createGraphSaveScheduler } from './graph-save-scheduler'

type GraphMode = 'global' | 'local'

interface GraphConfigController {
  status: 'loading' | 'ready' | 'error'
  manifest: GraphViewManifest
  settings: GraphViewSettings | LocalGraphViewSettings
  groups: GraphGroup[]
  recovery: GraphConfigRecovery | null
  error: string | null
  isSaving: boolean
  updateSettings: (patch: Partial<LocalGraphViewSettings>) => void
  updateGroups: (groups: GraphGroup[]) => void
  resetSettings: () => void
  reload: () => void
}

interface GraphSnapshotController {
  status: 'idle' | 'loading' | 'ready' | 'error'
  snapshot: GraphSnapshot | null
  error: string | null
  refresh: () => void
}

export function useGraphConfigController(
  mode: GraphMode,
  vaultSessionId: number
): GraphConfigController {
  const [status, setStatus] = useState<GraphConfigController['status']>('loading')
  const [manifest, setManifest] = useState(createDefaultGraphViewManifest)
  const [recovery, setRecovery] = useState<GraphConfigRecovery | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const confirmedRef = useRef(createDefaultGraphViewManifest())
  const draftRef = useRef(createDefaultGraphViewManifest())
  const editGenerationRef = useRef(0)
  const loadTokenRef = useRef(0)
  const savingRef = useRef(false)
  const flushSaveRef = useRef<() => Promise<void>>(async () => undefined)
  const saveSchedulerRef = useRef(
    createGraphSaveScheduler(() => {
      void flushSaveRef.current()
    })
  )
  const mountedRef = useRef(true)

  const load = useCallback(async (): Promise<void> => {
    const token = loadTokenRef.current + 1
    loadTokenRef.current = token
    setStatus('loading')
    setError(null)

    try {
      const result = await window.graphApi.getConfig()
      if (!mountedRef.current || loadTokenRef.current !== token) return
      confirmedRef.current = cloneManifest(result.manifest)
      draftRef.current = cloneManifest(result.manifest)
      editGenerationRef.current += 1
      setManifest(cloneManifest(result.manifest))
      setRecovery(result.recovery)
      setStatus('ready')
    } catch (loadError) {
      if (!mountedRef.current || loadTokenRef.current !== token) return
      const defaults = createDefaultGraphViewManifest()
      confirmedRef.current = defaults
      draftRef.current = cloneManifest(defaults)
      setManifest(cloneManifest(defaults))
      setRecovery(null)
      setStatus('error')
      setError(formatGraphError(loadError, 'Graph configuration could not be loaded.'))
    }
  }, [])

  const flushSave = useCallback(async (): Promise<void> => {
    if (savingRef.current || recovery) return
    savingRef.current = true
    setIsSaving(true)
    const generation = editGenerationRef.current
    const confirmed = confirmedRef.current
    const next: GraphViewManifest = {
      ...cloneManifest(draftRef.current),
      revision: confirmed.revision + 1
    }

    try {
      const result = await window.graphApi.saveConfig(next, confirmed.revision)
      if (!mountedRef.current) return
      confirmedRef.current = cloneManifest(result.manifest)
      draftRef.current = {
        ...draftRef.current,
        revision: result.manifest.revision
      }
      setRecovery(result.recovery)
      setManifest(cloneManifest(draftRef.current))
      setError(null)
    } catch (saveError) {
      if (!mountedRef.current) return
      setError(formatGraphError(saveError, 'Graph settings could not be saved.'))
      try {
        const reconciled = await window.graphApi.getConfig()
        if (!mountedRef.current) return
        confirmedRef.current = cloneManifest(reconciled.manifest)
        draftRef.current = cloneManifest(reconciled.manifest)
        editGenerationRef.current += 1
        setManifest(cloneManifest(reconciled.manifest))
        setRecovery(reconciled.recovery)
      } catch {
        // Keep the original persistence failure visible.
      }
    } finally {
      savingRef.current = false
      if (mountedRef.current) {
        setIsSaving(false)
        if (editGenerationRef.current !== generation) {
          saveSchedulerRef.current.schedule()
        }
      }
    }
  }, [recovery])
  flushSaveRef.current = flushSave

  const scheduleSave = useCallback((): void => {
    saveSchedulerRef.current.schedule()
  }, [])

  const updateDraft = useCallback(
    (update: (current: GraphViewManifest) => GraphViewManifest): void => {
      const next = update(cloneManifest(draftRef.current))
      draftRef.current = next
      editGenerationRef.current += 1
      setManifest(cloneManifest(next))
      setError(null)
      scheduleSave()
    },
    [scheduleSave]
  )

  const updateSettings = useCallback(
    (patch: Partial<LocalGraphViewSettings>): void => {
      updateDraft((current) =>
        mode === 'global'
          ? {
              ...current,
              global: { ...current.global, ...patch }
            }
          : {
              ...current,
              local: { ...current.local, ...patch }
            }
      )
    },
    [mode, updateDraft]
  )

  const updateGroups = useCallback(
    (groups: GraphGroup[]): void => {
      updateDraft((current) => ({
        ...current,
        groups: groups.map((group) => ({ ...group }))
      }))
    },
    [updateDraft]
  )

  const resetSettings = useCallback((): void => {
    updateDraft((current) =>
      mode === 'global'
        ? { ...current, global: { ...DEFAULT_GRAPH_VIEW_SETTINGS } }
        : { ...current, local: { ...DEFAULT_LOCAL_GRAPH_VIEW_SETTINGS } }
    )
  }, [mode, updateDraft])

  useEffect(() => {
    mountedRef.current = true
    void load()
    return () => {
      mountedRef.current = false
      loadTokenRef.current += 1
      saveSchedulerRef.current.cancel()
    }
  }, [load, vaultSessionId])

  return {
    status,
    manifest,
    settings: mode === 'global' ? manifest.global : manifest.local,
    groups: manifest.groups,
    recovery,
    error,
    isSaving,
    updateSettings,
    updateGroups,
    resetSettings,
    reload: load
  }
}

export function useGraphSnapshotController(options: {
  active: boolean
  scope: GraphScope | null
  settings: GraphViewSettings
  groups: GraphGroup[]
}): GraphSnapshotController {
  const [status, setStatus] = useState<GraphSnapshotController['status']>('idle')
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshRevision, setRefreshRevision] = useState(0)
  const hasRequestedRef = useRef(false)
  const requestCoordinatorRef = useRef(createGraphRequestCoordinator())
  const requestKey = createGraphTopologyRequestKey(options.scope, options.settings, options.groups)
  const queryRequest = useMemo<GraphSnapshotRequest | null>(() => {
    const membership = JSON.parse(requestKey) as {
      scope: GraphScope | null
      query: string
      existingOnly: boolean
      showOrphans: boolean
      groups: GraphGroup[]
    }
    if (!membership.scope) return null
    return {
      scope: membership.scope,
      settings: toGraphQuerySettings({
        ...DEFAULT_GRAPH_VIEW_SETTINGS,
        query: membership.query,
        existingOnly: membership.existingOnly,
        showOrphans: membership.showOrphans
      }),
      groups: membership.groups
    }
  }, [requestKey])

  useEffect(() => {
    if (!options.active || !queryRequest) {
      requestCoordinatorRef.current.invalidate()
      setStatus('idle')
      setSnapshot(null)
      setError(null)
      return
    }

    const token = requestCoordinatorRef.current.begin()
    setStatus('loading')
    setSnapshot(null)
    setError(null)
    const delay = hasRequestedRef.current ? 160 : 0
    hasRequestedRef.current = true
    const timer = setTimeout(() => {
      performance.mark('g39:graph-query-start')
      void window.graphApi
        .getSnapshot(queryRequest)
        .then((nextSnapshot) => {
          if (!requestCoordinatorRef.current.isCurrent(token)) return
          performance.mark('g39:graph-query-done')
          setSnapshot(nextSnapshot)
          setStatus('ready')
        })
        .catch((queryError: unknown) => {
          if (!requestCoordinatorRef.current.isCurrent(token)) return
          setSnapshot(null)
          setStatus('error')
          setError(formatGraphError(queryError, 'Graph query could not be evaluated.'))
        })
    }, delay)

    return () => {
      clearTimeout(timer)
      if (requestCoordinatorRef.current.isCurrent(token)) {
        requestCoordinatorRef.current.invalidate()
      }
    }
  }, [options.active, queryRequest, refreshRevision])

  useEffect(() => {
    if (!options.active) return
    return window.indexApi.onDidChange(() => {
      setRefreshRevision((current) => current + 1)
    })
  }, [options.active])

  return {
    status,
    snapshot,
    error,
    refresh: () => setRefreshRevision((current) => current + 1)
  }
}

function cloneManifest(manifest: GraphViewManifest): GraphViewManifest {
  return {
    ...manifest,
    global: { ...manifest.global },
    local: { ...manifest.local },
    groups: manifest.groups.map((group) => ({ ...group }))
  }
}

function formatGraphError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
