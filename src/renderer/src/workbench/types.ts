export type WorkbenchItemKind = 'note' | 'text' | 'image' | 'unsupported'

export type WorkbenchViewMode = 'source' | 'live' | 'reading'

export interface WorkbenchSelectionRange {
  anchor: number
  head: number
}

/**
 * Ephemeral editor state kept only for the current vault session. Fields are
 * optional because image and unsupported-file surfaces do not expose an
 * editor selection.
 */
export interface WorkbenchViewState {
  cursor?: number
  selection?: WorkbenchSelectionRange
  scrollTop?: number
  scrollLeft?: number
  viewMode?: WorkbenchViewMode
}

export interface GraphWorkbenchViewState {
  selectedNodeId?: string
  zoom?: number
  pan?: { x: number; y: number }
}

interface WorkbenchItemBase {
  id: string
  dirty: boolean
  missing: boolean
  autosavePaused: boolean
}

export interface FileWorkbenchItem extends WorkbenchItemBase {
  /** Canonical vault-relative path. IDs are scoped by WorkbenchState.sessionId. */
  id: string
  relativePath: string
  kind: WorkbenchItemKind
  viewState?: WorkbenchViewState
}

export interface GraphWorkbenchItem extends WorkbenchItemBase {
  id: 'virtual:graph:global'
  kind: 'graph'
  resource: { kind: 'global-graph' }
  dirty: false
  missing: false
  autosavePaused: false
  viewState?: GraphWorkbenchViewState
}

export type WorkbenchItem = FileWorkbenchItem | GraphWorkbenchItem

export interface MruSwitchState {
  originId: string
  candidateIds: string[]
  highlightedId: string
}

export interface WorkbenchState {
  /** Opaque, renderer-local generation. It must never contain an absolute path. */
  sessionId: number
  /** Visual tab order. */
  items: WorkbenchItem[]
  activeId: string | null
  /** Most-recently activated first. This is intentionally not visual order. */
  mruIds: string[]
  /** Most-recently closed first. Current session only. */
  closedIds: string[]
  mruSwitch: MruSwitchState | null
}

export type ActivateOnClose = 'history' | 'right' | 'left'

export type WhenClosingWithNoTabs = 'keep_window_open' | 'close_window'

export type CloseAuthorization = 'saved' | 'discard_missing' | 'cancel'

export type CloseRequirement = 'none' | 'save' | 'confirm_discard_missing'

export type CloseActiveIntent =
  | { type: 'close_item'; id: string }
  | { type: 'close_window' }
  | { type: 'keep_window_open' }

export type WorkbenchRequestOperation =
  | 'open'
  | 'activate'
  | 'close'
  | 'rename'
  | 'delete'
  | 'reopen'

export interface WorkbenchRequestToken {
  id: number
  sessionId: number
  operation: WorkbenchRequestOperation
  targetId?: string
}
