import { useEffect } from 'react'
import type { UiDensity } from '../../../shared/app-settings'

export function useInterfacePreferences({
  density,
  uiScale
}: {
  density: UiDensity
  uiScale: number
}): void {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.density = density
    root.style.setProperty('--ui-scale', String(uiScale / 100))
    root.style.fontSize = `${(16 * uiScale) / 100}px`
  }, [density, uiScale])
}
