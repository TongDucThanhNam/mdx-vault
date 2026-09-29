import { useEffect, useState } from 'react'
import {
  normalizePanelWidth,
  PANEL_WIDTH_RANGES,
  type PanelWidthKey
} from '../../../../shared/app-settings'

export type WorkspaceLayoutMode = 'wide' | 'compact'
export type SupplementaryDockTab = 'context' | 'ai'

export const WIDE_WORKSPACE_MIN_WIDTH = 1360
export const PANEL_SEPARATOR_WIDTH = '6px'
/** 26rem keeps prose usable at the 980px minimum with both supplementary docks. */
export const COMPACT_DOCUMENT_FLOOR = 26
export const WIDE_DOCUMENT_FLOOR = 30
export type PanelWidths = Record<PanelWidthKey, number>

/** Pure dock policy: fit visible tracks, yielding the Explorer before the document. */
export function resolveDockPolicy({
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
}): { widths: PanelWidths; collapsedLeft: boolean; documentFloor: number } {
  const documentFloor = mode === 'wide' ? WIDE_DOCUMENT_FLOOR : COMPACT_DOCUMENT_FLOOR
  const fitted: PanelWidths = {
    leftPanelWidth: normalizePanelWidth('leftPanelWidth', widths.leftPanelWidth),
    rightPanelWidth: normalizePanelWidth('rightPanelWidth', widths.rightPanelWidth),
    aiPanelWidth: normalizePanelWidth('aiPanelWidth', widths.aiPanelWidth)
  }
  let collapsedLeft = false
  const open: PanelWidthKey[] = []
  if (leftPanelOpen) open.push('leftPanelWidth')
  if (rightPanelOpen) open.push('rightPanelWidth')
  if (aiPanelOpen) open.push('aiPanelWidth')
  const minimumTotal = (): number =>
    documentFloor +
    open.reduce((sum, key) => sum + PANEL_WIDTH_RANGES[key].min, 0) +
    (open.length * 6) / remPx
  if (
    mode === 'compact' &&
    leftPanelOpen &&
    (rightPanelOpen || aiPanelOpen) &&
    minimumTotal() > viewportWidth / remPx
  ) {
    open.splice(open.indexOf('leftPanelWidth'), 1)
    collapsedLeft = true
  }
  let excess = documentFloor + (open.length * 6) / remPx - viewportWidth / remPx
  for (const key of open) excess += fitted[key]
  for (const key of ['aiPanelWidth', 'rightPanelWidth', 'leftPanelWidth'] as const) {
    if (excess <= 0 || !open.includes(key)) continue
    const reduction = Math.min(excess, fitted[key] - PANEL_WIDTH_RANGES[key].min)
    const previous = fitted[key]
    fitted[key] = Math.max(PANEL_WIDTH_RANGES[key].min, Math.floor((previous - reduction) * 2) / 2)
    excess -= previous - fitted[key]
  }
  return { widths: fitted, collapsedLeft, documentFloor }
}

/** Kept for consumers that only need fitted widths. */
export function fitPanelWidths(input: Parameters<typeof resolveDockPolicy>[0]): PanelWidths {
  return resolveDockPolicy(input).widths
}

export function resolveWorkspaceLayoutMode(viewportWidth: number): WorkspaceLayoutMode {
  if (viewportWidth >= WIDE_WORKSPACE_MIN_WIDTH) {
    return 'wide'
  }
  return 'compact'
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
  if (readingFullView) {
    return 'minmax(0, 1fr)'
  }
  return [
    leftPanelOpen
      ? `var(--left-panel-width, ${normalizePanelWidth('leftPanelWidth', widths.leftPanelWidth)}rem) ${PANEL_SEPARATOR_WIDTH}`
      : null,
    `minmax(${mode === 'wide' ? WIDE_DOCUMENT_FLOOR : COMPACT_DOCUMENT_FLOOR}rem, 1fr)`,
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
