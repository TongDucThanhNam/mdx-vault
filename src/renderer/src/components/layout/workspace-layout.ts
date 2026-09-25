import { useEffect, useState } from 'react'

export type WorkspaceLayoutMode = 'wide' | 'compact' | 'overlay'
export type SupplementaryDockTab = 'context' | 'ai'

export const WIDE_WORKSPACE_MIN_WIDTH = 1360
export const COMPACT_WORKSPACE_MIN_WIDTH = 800

export function resolveWorkspaceLayoutMode(viewportWidth: number): WorkspaceLayoutMode {
  if (viewportWidth >= WIDE_WORKSPACE_MIN_WIDTH) {
    return 'wide'
  }
  if (viewportWidth >= COMPACT_WORKSPACE_MIN_WIDTH) {
    return 'compact'
  }
  return 'overlay'
}

export function workspaceGridTemplate({
  mode,
  leftPanelOpen,
  rightPanelOpen,
  aiPanelOpen,
  readingFullView
}: {
  mode: WorkspaceLayoutMode
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  aiPanelOpen: boolean
  readingFullView: boolean
}): string {
  if (readingFullView || mode === 'overlay') {
    return 'minmax(0, 1fr)'
  }
  if (mode === 'compact') {
    return leftPanelOpen ? 'minmax(13.5rem, 14rem) minmax(0, 1fr)' : 'minmax(0, 1fr)'
  }
  return [
    leftPanelOpen ? '15.5rem' : null,
    'minmax(30rem, 1fr)',
    rightPanelOpen ? '18rem' : null,
    aiPanelOpen ? '21rem' : null
  ]
    .filter((track): track is string => track !== null)
    .join(' ')
}

export function resolveVisibleSupplementaryDockTab({
  contextOpen,
  aiOpen,
  activeTab
}: {
  contextOpen: boolean
  aiOpen: boolean
  activeTab: SupplementaryDockTab
}): SupplementaryDockTab {
  if (activeTab === 'context' && contextOpen) {
    return 'context'
  }
  if (activeTab === 'ai' && aiOpen) {
    return 'ai'
  }
  return contextOpen ? 'context' : 'ai'
}

export function useWorkspaceLayoutMode(): WorkspaceLayoutMode {
  const [mode, setMode] = useState<WorkspaceLayoutMode>(() =>
    resolveWorkspaceLayoutMode(window.innerWidth)
  )

  useEffect(() => {
    const wideQuery = window.matchMedia(`(min-width: ${WIDE_WORKSPACE_MIN_WIDTH}px)`)
    const compactQuery = window.matchMedia(`(min-width: ${COMPACT_WORKSPACE_MIN_WIDTH}px)`)
    const update = (): void => setMode(resolveWorkspaceLayoutMode(window.innerWidth))

    wideQuery.addEventListener('change', update)
    compactQuery.addEventListener('change', update)
    return () => {
      wideQuery.removeEventListener('change', update)
      compactQuery.removeEventListener('change', update)
    }
  }, [])

  return mode
}
