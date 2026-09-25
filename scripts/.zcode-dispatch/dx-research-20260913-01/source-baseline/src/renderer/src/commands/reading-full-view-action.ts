import type { ViewMode } from '@/components/ViewModeToggle'

export function isReadingFullViewActionEnabled(
  selectedNotePath: string | null,
  viewMode: ViewMode
): boolean {
  return selectedNotePath !== null && viewMode === 'reading'
}
