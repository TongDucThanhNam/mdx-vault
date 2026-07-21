import type {
  ActionContext,
  KeyBinding,
  WorkspaceActionId
} from '../../../shared/workspace-actions'

export interface CommandAction {
  id: string
  title: string
  description: string
  category: string
  keywords?: string[]
  hotkeys?: string[]
  bindings?: readonly KeyBinding[]
  context?: ActionContext
  stableActionId?: WorkspaceActionId
  disabled?: boolean
  run: (input?: unknown) => unknown
}

export interface CommandActionRegistry {
  actions: CommandAction[]
  dispatch: (actionId: string, input?: unknown) => Promise<boolean>
  isEnabled: (actionId: WorkspaceActionId) => boolean
  getAction: (actionId: string) => CommandAction | undefined
}
