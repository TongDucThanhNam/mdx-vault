import type { ViewMode } from '@/components/ViewModeToggle'
import type { WorkspaceActionId } from '../../../shared/workspace-actions'

export type ReadingZoomActionId = Extract<
  WorkspaceActionId,
  'view.zoom-in' | 'view.zoom-out' | 'view.zoom-reset'
>

export type ReadingZoomActionHandler = () => void

export interface ReadingZoomActionHandlersInput {
  readonly zoomIn: ReadingZoomActionHandler
  readonly zoomOut: ReadingZoomActionHandler
  readonly reset: ReadingZoomActionHandler
}

export function isReadingZoomActionEnabled(
  selectedNotePath: string | null,
  viewMode: ViewMode
): boolean {
  return selectedNotePath !== null && viewMode === 'reading'
}

/**
 * Keep Reading zoom execution addressable by the same stable action IDs used
 * by keybindings, Settings, and the command palette.
 */
export function createReadingZoomActionHandlers({
  zoomIn,
  zoomOut,
  reset
}: ReadingZoomActionHandlersInput): Readonly<
  Record<ReadingZoomActionId, ReadingZoomActionHandler>
> {
  return {
    'view.zoom-in': zoomIn,
    'view.zoom-out': zoomOut,
    'view.zoom-reset': reset
  }
}
