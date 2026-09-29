import {
  normalizePanelWidth,
  PANEL_WIDTH_RANGES,
  type PanelWidthKey
} from '../../../../shared/app-settings'

export function reducePanelResizeKey(
  key: PanelWidthKey,
  width: number,
  pressed: string,
  shift: boolean
): number | null {
  if (pressed === 'Enter') return PANEL_WIDTH_RANGES[key].defaultValue
  if (pressed !== 'ArrowLeft' && pressed !== 'ArrowRight') return null
  const direction = pressed === 'ArrowRight' ? 1 : -1
  const inward = key === 'leftPanelWidth' ? direction : -direction
  return normalizePanelWidth(key, width + inward * (shift ? 2 : 0.5))
}
