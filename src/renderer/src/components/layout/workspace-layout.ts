import { useEffect, useState } from 'react'
import {
  normalizePanelWidth,
  PANEL_WIDTH_RANGES,
  type PanelWidthKey
} from '../../../../shared/app-settings'

export type WorkspaceLayoutMode = 'wide' | 'compact' | 'overlay'
export type SupplementaryDockTab = 'context' | 'ai'

export const WIDE_WORKSPACE_MIN_WIDTH = 1360
export const COMPACT_WORKSPACE_MIN_WIDTH = 800
export const PANEL_SEPARATOR_WIDTH = '6px'
export type PanelWidths = Record<PanelWidthKey, number>

/** Give the single document its 30rem floor before optional dock width. */
export function fitPanelWidths({
  widths,
  mode,
  viewportWidth,
  remPx,
  leftPanelOpen,
  rightPanelOpen,
  aiPanelOpen
}: {
  widths: PanelWidths
  mode: WorkspaceLayoutMode
  viewportWidth: number
  remPx: number
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  aiPanelOpen: boolean
}): PanelWidths {
  const fitted: PanelWidths = {
    leftPanelWidth: normalizePanelWidth('leftPanelWidth', widths.leftPanelWidth),
    rightPanelWidth: normalizePanelWidth('rightPanelWidth', widths.rightPanelWidth),
    aiPanelWidth: normalizePanelWidth('aiPanelWidth', widths.aiPanelWidth)
  }
  const open: PanelWidthKey[] = []
  if (leftPanelOpen && mode !== 'overlay') open.push('leftPanelWidth')
  if (rightPanelOpen && mode === 'wide') open.push('rightPanelWidth')
  if (aiPanelOpen && mode === 'wide') open.push('aiPanelWidth')
  let excess = 30 + (open.length * 6) / remPx - viewportWidth / remPx
  for (const key of open) excess += fitted[key]
  for (const key of ['aiPanelWidth', 'rightPanelWidth', 'leftPanelWidth'] as const) {
    if (excess <= 0 || !open.includes(key)) continue
    const reduction = Math.min(excess, fitted[key] - PANEL_WIDTH_RANGES[key].min)
    const previous = fitted[key]
    fitted[key] = Math.max(PANEL_WIDTH_RANGES[key].min, Math.floor((previous - reduction) * 2) / 2)
    excess -= previous - fitted[key]
  }
  return fitted
}

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
  readingFullView,
  widths
}: {
  mode: WorkspaceLayoutMode
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  aiPanelOpen: boolean
  readingFullView: boolean
  widths: PanelWidths
}): string {
  if (readingFullView || mode === 'overlay') {
    return 'minmax(0, 1fr)'
  }
  if (mode === 'compact') {
    return leftPanelOpen
      ? `var(--left-panel-width, ${normalizePanelWidth('leftPanelWidth', widths.leftPanelWidth)}rem) ${PANEL_SEPARATOR_WIDTH} minmax(30rem, 1fr)`
      : 'minmax(0, 1fr)'
  }
  return [
    leftPanelOpen
      ? `var(--left-panel-width, ${normalizePanelWidth('leftPanelWidth', widths.leftPanelWidth)}rem) ${PANEL_SEPARATOR_WIDTH}`
      : null,
    'minmax(30rem, 1fr)',
    rightPanelOpen
      ? `${PANEL_SEPARATOR_WIDTH} var(--right-panel-width, ${normalizePanelWidth('rightPanelWidth', widths.rightPanelWidth)}rem)`
      : null,
    aiPanelOpen
      ? `${PANEL_SEPARATOR_WIDTH} var(--ai-panel-width, ${normalizePanelWidth('aiPanelWidth', widths.aiPanelWidth)}rem)`
      : null
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

export function useWorkspaceViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    const update = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return width
}
