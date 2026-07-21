import type { ActionContext } from '../../../shared/workspace-actions'

export type FocusedKeyboardContext = Extract<
  ActionContext,
  'Dialog' | 'Editor' | 'Explorer' | 'Input' | 'Workspace'
>

export interface KeyboardContextState {
  readonly activeSurface: string | null
  readonly dialogOpen: boolean
  readonly keyRecorderActive: boolean
  readonly mruSwitchActive: boolean
}

function uniqueContexts(contexts: readonly ActionContext[]): ActionContext[] {
  return contexts.filter((context, index) => contexts.indexOf(context) === index)
}

/**
 * Pure context ordering for the global shortcut resolver. Focus ownership is
 * kept alongside the containing surface so native input behavior can win
 * before modal/background guards are considered.
 */
export function deriveKeyboardContexts(
  state: KeyboardContextState,
  focusedContext: FocusedKeyboardContext
): ActionContext[] {
  if (state.keyRecorderActive) {
    return ['KeyRecorder', 'Workspace']
  }

  const surfaceContext: ActionContext | null = state.dialogOpen
    ? 'Dialog'
    : state.activeSurface === 'settings'
      ? 'Settings'
      : state.activeSurface
        ? 'Picker'
        : null

  // The MRU switcher is itself aria-modal, but repeated Ctrl+Tab gestures
  // still belong to the workbench session that opened it.
  if (state.mruSwitchActive && surfaceContext === null) {
    return ['Workspace']
  }

  if (focusedContext === 'Input') {
    return uniqueContexts(['Input', ...(surfaceContext ? [surfaceContext] : []), 'Workspace'])
  }

  if (focusedContext === 'Dialog') {
    return uniqueContexts(['Dialog', ...(surfaceContext ? [surfaceContext] : []), 'Workspace'])
  }

  if (surfaceContext) {
    return [surfaceContext, 'Workspace']
  }

  return focusedContext === 'Workspace' ? ['Workspace'] : [focusedContext, 'Workspace']
}
