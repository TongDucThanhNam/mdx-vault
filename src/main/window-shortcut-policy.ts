import {
  getKeyBindingSignature,
  getReservedKeyBindingReason,
  RESERVED_KEY_BINDINGS,
  type ReservedKeyBindingCode
} from '../shared/keybindings'
import {
  getDefaultBindings,
  getWorkspaceActionDefinition,
  type KeyBinding,
  type KeybindingPlatform,
  type WorkspaceActionId
} from '../shared/workspace-actions'

export const CLOSE_ACTIVE_ITEM_ACTION_ID =
  'workbench.close-item' as const satisfies WorkspaceActionId

/**
 * Keep electron-toolkit's development/reload guards installed without letting
 * its default zoom guard consume renderer-owned reading-zoom chords.
 */
export const WINDOW_SHORTCUT_WATCHER_OPTIONS = {
  escToCloseWindow: false,
  zoom: true
} as const

export type NativeMenuItemSpec =
  | {
      readonly kind: 'role'
      readonly role: 'appMenu' | 'editMenu' | 'minimize' | 'zoom' | 'front'
    }
  | { readonly kind: 'separator' }
  | {
      readonly kind: 'submenu'
      readonly label: string
      readonly items: readonly NativeMenuItemSpec[]
    }

export type NativeApplicationMenuPolicy =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'template'
      readonly items: readonly NativeMenuItemSpec[]
    }

export interface NativeChordPolicyEntry {
  readonly binding: KeyBinding
  readonly code: ReservedKeyBindingCode
  readonly message: string
  readonly disposition: 'native-reserved' | 'renderer-routed'
  readonly routedActionId?: WorkspaceActionId
}

export interface WindowShortcutPolicy {
  readonly platform: KeybindingPlatform
  readonly applicationMenu: NativeApplicationMenuPolicy
  readonly rendererCloseAction: {
    readonly id: typeof CLOSE_ACTIVE_ITEM_ACTION_ID
    readonly title: string
    readonly bindings: readonly KeyBinding[]
  }
  readonly nativeChords: readonly NativeChordPolicyEntry[]
}

const MACOS_APPLICATION_MENU: NativeApplicationMenuPolicy = {
  kind: 'template',
  items: [
    // Electron expands these roles to the standard application and editing
    // commands. In particular, editMenu retains undo/cut/copy/paste/select-all.
    { kind: 'role', role: 'appMenu' },
    { kind: 'role', role: 'editMenu' },
    {
      kind: 'submenu',
      label: 'Window',
      items: [
        { kind: 'role', role: 'minimize' },
        { kind: 'role', role: 'zoom' },
        { kind: 'separator' },
        { kind: 'role', role: 'front' }
      ]
    }
  ]
}

/** Convert Node/Electron's broader platform value to the supported keymap set. */
export function normalizeWindowShortcutPlatform(platform: string): KeybindingPlatform {
  if (platform === 'darwin' || platform === 'win32') {
    return platform
  }
  return 'linux'
}

function isRoutedDefault(
  reservedBinding: KeyBinding,
  platform: KeybindingPlatform,
  actionId: WorkspaceActionId
): boolean {
  const reservedSignature = getKeyBindingSignature(reservedBinding, platform)
  return getDefaultBindings(actionId, platform).some(
    (binding) => getKeyBindingSignature(binding, platform) === reservedSignature
  )
}

/**
 * Pure source of truth for the Electron menu boundary. The same shared action
 * definitions and reserved-chord metadata used by renderer dispatch/settings
 * determine which native accelerators may remain installed.
 */
export function getWindowShortcutPolicy(rawPlatform: string): WindowShortcutPolicy {
  const platform = normalizeWindowShortcutPlatform(rawPlatform)
  const closeAction = getWorkspaceActionDefinition(CLOSE_ACTIVE_ITEM_ACTION_ID)
  if (!closeAction) {
    throw new Error(`Missing action definition: ${CLOSE_ACTIVE_ITEM_ACTION_ID}`)
  }

  const closeBindings = getDefaultBindings(CLOSE_ACTIVE_ITEM_ACTION_ID, platform).filter(
    (binding) =>
      getReservedKeyBindingReason(binding, platform, CLOSE_ACTIVE_ITEM_ACTION_ID) === null
  )

  const nativeChords: NativeChordPolicyEntry[] = RESERVED_KEY_BINDINGS.filter((definition) =>
    (definition.platforms as readonly string[]).includes(platform)
  ).map((definition) => {
    const routedActionId = definition.allowedActionIds?.find((actionId) =>
      isRoutedDefault(definition.binding, platform, actionId)
    )
    return {
      binding: definition.binding,
      code: definition.code,
      message: definition.message,
      disposition: routedActionId ? 'renderer-routed' : 'native-reserved',
      ...(routedActionId ? { routedActionId } : {})
    }
  })

  return {
    platform,
    applicationMenu: platform === 'darwin' ? MACOS_APPLICATION_MENU : { kind: 'none' },
    rendererCloseAction: {
      id: CLOSE_ACTIVE_ITEM_ACTION_ID,
      title: closeAction.title,
      bindings: closeBindings
    },
    nativeChords
  }
}
