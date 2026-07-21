import { useEffect, useRef } from 'react'
import type { CommandActionRegistry } from '@/commands/actions'
import type { GlobalSurfaceId } from '@/hooks/useGlobalSurface'
import { deriveKeyboardContexts, type FocusedKeyboardContext } from '@/input/keyboard-context'
import { type KeymapOverrides, resolveKeyBinding } from '../../../shared/keybindings'
import type {
  KeyBinding,
  KeybindingPlatform,
  WorkspaceActionId
} from '../../../shared/workspace-actions'

export interface UseKeyboardShortcutsOptions {
  registry: CommandActionRegistry
  keymapOverrides: KeymapOverrides
  activeSurface: GlobalSurfaceId | null
  dialogOpen: boolean
  keyRecorderActive: boolean
  mruSwitchActive: boolean
  onCommitMru: () => Promise<boolean>
  onCancelMru: () => void
}

type MruActionId = Extract<WorkspaceActionId, 'workbench.mru-next' | 'workbench.mru-previous'>

type ModifierKey = 'Alt' | 'Control' | 'Meta' | 'Shift'

interface MruKeyboardSession {
  binding: KeyBinding
  releaseKey: ModifierKey | null
}

const MRU_ACTION_IDS: ReadonlySet<WorkspaceActionId> = new Set<MruActionId>([
  'workbench.mru-next',
  'workbench.mru-previous'
])

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const latestOptionsRef = useRef(options)
  const mruSessionRef = useRef<MruKeyboardSession | null>(null)
  const mruFinishingRef = useRef(false)
  const wasMruSwitchActiveRef = useRef(options.mruSwitchActive)
  latestOptionsRef.current = options

  useEffect(() => {
    if (!options.mruSwitchActive && wasMruSwitchActiveRef.current) {
      mruSessionRef.current = null
      mruFinishingRef.current = false
    }
    wasMruSwitchActiveRef.current = options.mruSwitchActive
  }, [options.mruSwitchActive])

  useEffect(() => {
    const finishMru = (result: 'commit' | 'cancel'): void => {
      const current = latestOptionsRef.current
      if (mruFinishingRef.current || (!current.mruSwitchActive && mruSessionRef.current === null)) {
        return
      }

      mruFinishingRef.current = true
      mruSessionRef.current = null
      if (result === 'cancel') {
        current.onCancelMru()
        return
      }

      void current.onCommitMru()
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      const current = latestOptionsRef.current
      const ownsMruKeyboardInput =
        !current.keyRecorderActive &&
        !current.dialogOpen &&
        current.activeSurface === null &&
        (current.mruSwitchActive || mruSessionRef.current !== null)

      if (ownsMruKeyboardInput && !event.isComposing && event.key === 'Escape') {
        event.preventDefault()
        finishMru('cancel')
        return
      }

      if (ownsMruKeyboardInput && !event.isComposing && event.key === 'Enter') {
        event.preventDefault()
        finishMru('commit')
        return
      }

      const platform = getKeybindingPlatform()
      const resolution = resolveKeyBinding(event, {
        platform,
        activeContexts: deriveActiveContexts(current),
        overrides: current.keymapOverrides,
        isActionEnabled: current.registry.isEnabled
      })

      if (resolution.preventDefault) {
        event.preventDefault()
      }

      if (resolution.kind !== 'dispatch') {
        return
      }

      if (current.mruSwitchActive && !MRU_ACTION_IDS.has(resolution.actionId)) {
        return
      }

      if (MRU_ACTION_IDS.has(resolution.actionId)) {
        if (mruFinishingRef.current) {
          return
        }
        if (!mruSessionRef.current) {
          mruSessionRef.current = {
            binding: resolution.binding,
            releaseKey: getTriggerModifier(resolution.binding, platform)
          }
        }
      }

      void current.registry.dispatch(resolution.actionId).then((dispatched) => {
        if (
          MRU_ACTION_IDS.has(resolution.actionId) &&
          !dispatched &&
          !latestOptionsRef.current.mruSwitchActive
        ) {
          mruSessionRef.current = null
        }
      })
    }

    const handleKeyUp = (event: KeyboardEvent): void => {
      const releaseKey = mruSessionRef.current?.releaseKey
      if (releaseKey && event.key === releaseKey) {
        finishMru('commit')
      }
    }

    const handleWindowBlur = (): void => {
      if (mruSessionRef.current?.releaseKey) {
        finishMru('commit')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])
}

function deriveActiveContexts(options: UseKeyboardShortcutsOptions) {
  return deriveKeyboardContexts(options, getFocusedKeyboardContext())
}

function getFocusedKeyboardContext(): FocusedKeyboardContext {
  const focusedElement = document.activeElement
  if (!(focusedElement instanceof HTMLElement)) {
    return 'Workspace'
  }
  if (focusedElement.closest('.cm-editor')) {
    return 'Editor'
  }
  if (isTextInput(focusedElement)) {
    return 'Input'
  }
  if (
    focusedElement.closest(
      '[aria-modal="true"], [data-slot="dialog-content"], [data-slot="alert-dialog-content"]'
    )
  ) {
    return 'Dialog'
  }
  if (focusedElement.closest('[aria-label="Vault explorer"]')) {
    return 'Explorer'
  }
  if (focusedElement.closest('[data-reading-surface="active"]')) {
    return 'Reading'
  }
  return 'Workspace'
}

function isTextInput(element: HTMLElement): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable ||
    element.matches('[role="textbox"], [role="searchbox"], [role="combobox"]')
  )
}

function getTriggerModifier(binding: KeyBinding, platform: KeybindingPlatform): ModifierKey | null {
  const modifiers = new Set(binding.split('+').slice(0, -1))
  if (modifiers.has('Mod')) {
    return platform === 'darwin' ? 'Meta' : 'Control'
  }
  if (modifiers.has('Ctrl')) {
    return 'Control'
  }
  if (modifiers.has('Cmd')) {
    return 'Meta'
  }
  if (modifiers.has('Alt')) {
    return 'Alt'
  }
  if (modifiers.has('Shift')) {
    return 'Shift'
  }
  return null
}

function getKeybindingPlatform(): KeybindingPlatform {
  const platform = window.windowApi.platform
  return platform === 'darwin' || platform === 'win32' ? platform : 'linux'
}
