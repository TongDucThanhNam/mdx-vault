import {
  ACTION_CONTEXT_PRECEDENCE,
  ACTION_ID_ALIASES,
  type ActionContext,
  canonicalizeActionId,
  getDefaultBindings,
  getWorkspaceActionDefinition,
  type KeyBinding,
  type KeybindingPlatform,
  resolveWorkspaceActionId,
  WORKSPACE_ACTION_DEFINITIONS,
  type WorkspaceActionDefinition,
  type WorkspaceActionId
} from './workspace-actions'

export type KeymapOverrides = Readonly<Record<string, readonly KeyBinding[] | undefined>>

export interface KeyEventLike {
  readonly key: string
  readonly code?: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly repeat?: boolean
  readonly isComposing?: boolean
}

export type KeyBindingNormalizationErrorCode =
  | 'empty'
  | 'multi-stroke'
  | 'modifier-only'
  | 'duplicate-modifier'
  | 'ambiguous-modifier'
  | 'unknown-modifier'
  | 'unknown-key'

export type KeyBindingNormalizationResult =
  | { readonly ok: true; readonly binding: KeyBinding }
  | {
      readonly ok: false
      readonly code: KeyBindingNormalizationErrorCode
      readonly message: string
    }

export type ReservedKeyBindingCode =
  | 'devtools'
  | 'reload'
  | 'native-edit'
  | 'native-window-close'
  | 'quit-application'
  | 'hide-application'
  | 'minimize-window'

export interface ReservedKeyBindingReason {
  readonly code: ReservedKeyBindingCode
  readonly message: string
}

export type UserKeyBindingValidationResult =
  | { readonly ok: true; readonly binding: KeyBinding }
  | {
      readonly ok: false
      readonly code:
        | KeyBindingNormalizationErrorCode
        | 'unsafe-unmodified-printable'
        | 'recorder-control'
        | 'reserved'
      readonly message: string
      readonly reserved?: ReservedKeyBindingReason
    }

const MODIFIER_ALIASES: Readonly<Record<string, 'Mod' | 'Ctrl' | 'Cmd' | 'Alt' | 'Shift'>> = {
  mod: 'Mod',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  cmd: 'Cmd',
  command: 'Cmd',
  meta: 'Cmd',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift'
}

const MODIFIER_ORDER = ['Mod', 'Ctrl', 'Cmd', 'Alt', 'Shift'] as const

const KEY_ALIASES: Readonly<Record<string, string>> = {
  esc: 'Escape',
  escape: 'Escape',
  return: 'Enter',
  enter: 'Enter',
  tab: 'Tab',
  space: 'Space',
  spacebar: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  insert: 'Insert',
  ins: 'Insert',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pgup: 'PageUp',
  pagedown: 'PageDown',
  pgdown: 'PageDown',
  pgdn: 'PageDown',
  arrowup: 'ArrowUp',
  up: 'ArrowUp',
  arrowdown: 'ArrowDown',
  down: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  left: 'ArrowLeft',
  arrowright: 'ArrowRight',
  right: 'ArrowRight',
  comma: ',',
  period: '.',
  slash: '/',
  semicolon: ';',
  quote: "'",
  backquote: '`',
  bracketleft: '[',
  bracketright: ']',
  backslash: '\\',
  minus: '-',
  equal: '=',
  plus: 'Plus'
}

const MODIFIER_KEYS = new Set([
  'Alt',
  'AltGraph',
  'Control',
  'Fn',
  'FnLock',
  'Meta',
  'Shift',
  'Symbol',
  'SymbolLock'
])

const SHIFTED_KEY_BY_BASE: Readonly<Record<string, string>> = {
  '1': '!',
  '2': '@',
  '3': '#',
  '4': '$',
  '5': '%',
  '6': '^',
  '7': '&',
  '8': '*',
  '9': '(',
  '0': ')',
  '-': '_',
  '=': 'Plus',
  '[': '{',
  ']': '}',
  '\\': '|',
  ';': ':',
  "'": '"',
  ',': '<',
  '.': '>',
  '/': '?',
  '`': '~'
}

const BASE_KEY_BY_SHIFTED = new Map(
  Object.entries(SHIFTED_KEY_BY_BASE).map(([base, shifted]) => [shifted, base])
)

function normalizeKeyName(rawKey: string): string | null {
  if (rawKey === ' ') return 'Space'
  if (rawKey === '+') return 'Plus'

  if (rawKey.length === 1) {
    if (/^[a-z]$/i.test(rawKey)) {
      return rawKey.toUpperCase()
    }
    return rawKey
  }

  const alias = KEY_ALIASES[rawKey.toLowerCase()]
  if (alias) {
    return alias
  }

  if (/^f(?:[1-9]|1[0-9]|2[0-4])$/i.test(rawKey)) {
    return rawKey.toUpperCase()
  }

  return null
}

function normalizationError(
  code: KeyBindingNormalizationErrorCode,
  message: string
): KeyBindingNormalizationResult {
  return { ok: false, code, message }
}

/** Normalize one logical key chord; key sequences are intentionally rejected. */
export function normalizeKeyBinding(input: string): KeyBindingNormalizationResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return normalizationError('empty', 'Choose a key together with any modifiers.')
  }

  if (/\s/.test(trimmed)) {
    return normalizationError('multi-stroke', 'Only one-keystroke bindings are supported.')
  }

  const parts = trimmed.split('+')
  if (parts.some((part) => part.length === 0)) {
    return normalizationError('unknown-key', 'The binding contains an empty key segment.')
  }

  const rawKey = parts.at(-1)!
  const rawModifiers = parts.slice(0, -1)
  const modifiers = new Set<(typeof MODIFIER_ORDER)[number]>()

  for (const rawModifier of rawModifiers) {
    const modifier = MODIFIER_ALIASES[rawModifier.toLowerCase()]
    if (!modifier) {
      return normalizationError(
        'unknown-modifier',
        `Unknown modifier “${rawModifier}”. Use Mod, Ctrl, Cmd, Alt, or Shift.`
      )
    }
    if (modifiers.has(modifier)) {
      return normalizationError('duplicate-modifier', `Modifier ${modifier} appears twice.`)
    }
    modifiers.add(modifier)
  }

  if (modifiers.has('Mod') && (modifiers.has('Ctrl') || modifiers.has('Cmd'))) {
    return normalizationError(
      'ambiguous-modifier',
      'Mod cannot be combined with Ctrl or Cmd in one binding.'
    )
  }

  if (MODIFIER_ALIASES[rawKey.toLowerCase()]) {
    return normalizationError('modifier-only', 'A binding must include a non-modifier key.')
  }

  let key = normalizeKeyName(rawKey)
  if (!key) {
    return normalizationError('unknown-key', `Unknown key “${rawKey}”.`)
  }

  // Store shifted punctuation as the character users see (`Mod+}`), while
  // retaining Shift in the effective signature used for exact event matching.
  if (modifiers.has('Shift') && SHIFTED_KEY_BY_BASE[key]) {
    key = SHIFTED_KEY_BY_BASE[key]
    modifiers.delete('Shift')
  } else if (modifiers.has('Shift') && BASE_KEY_BY_SHIFTED.has(key)) {
    modifiers.delete('Shift')
  }

  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier))
  return { ok: true, binding: [...orderedModifiers, key].join('+') }
}

/** Backward-compatible naming for settings normalization. */
export const normalizeKeyChord = normalizeKeyBinding

interface EffectiveKeyBinding {
  readonly key: string
  readonly ctrl: boolean
  readonly meta: boolean
  readonly alt: boolean
  readonly shift: boolean
}

function toEffectiveKeyBinding(
  binding: KeyBinding,
  platform: KeybindingPlatform
): EffectiveKeyBinding | null {
  const normalized = normalizeKeyBinding(binding)
  if (!normalized.ok) {
    return null
  }

  const parts = normalized.binding.split('+')
  const key = parts.at(-1)!
  const modifiers = new Set(parts.slice(0, -1))
  const primaryModifier = modifiers.has('Mod')

  return {
    key,
    ctrl: modifiers.has('Ctrl') || (primaryModifier && platform !== 'darwin'),
    meta: modifiers.has('Cmd') || (primaryModifier && platform === 'darwin'),
    alt: modifiers.has('Alt'),
    shift: modifiers.has('Shift') || BASE_KEY_BY_SHIFTED.has(key)
  }
}

function effectiveSignature(binding: EffectiveKeyBinding): string {
  return `${binding.ctrl ? 1 : 0}${binding.meta ? 1 : 0}${binding.alt ? 1 : 0}${binding.shift ? 1 : 0}:${binding.key}`
}

export function getKeyBindingSignature(
  binding: KeyBinding,
  platform: KeybindingPlatform
): string | null {
  const effective = toEffectiveKeyBinding(binding, platform)
  return effective ? effectiveSignature(effective) : null
}

function displayKey(key: string): string {
  return key === 'Plus' ? '+' : key
}

/** Display the effective physical chord from the same logical chord used to match. */
export function formatKeyBinding(binding: KeyBinding, platform: KeybindingPlatform): string | null {
  const normalized = normalizeKeyBinding(binding)
  if (!normalized.ok) {
    return null
  }

  const parts = normalized.binding.split('+')
  const key = parts.at(-1)!
  const logicalModifiers = parts.slice(0, -1)
  const physicalModifiers = new Set<string>()

  for (const modifier of logicalModifiers) {
    physicalModifiers.add(modifier === 'Mod' ? (platform === 'darwin' ? 'Cmd' : 'Ctrl') : modifier)
  }

  const orderedModifiers = ['Ctrl', 'Cmd', 'Alt', 'Shift'].filter((modifier) =>
    physicalModifiers.has(modifier)
  )
  return [...orderedModifiers, displayKey(key)].join('+')
}

function eventToEffectiveKeyBinding(event: KeyEventLike): EffectiveKeyBinding | null {
  if (MODIFIER_KEYS.has(event.key) || event.key === 'Dead' || event.key === 'Unidentified') {
    return null
  }

  const key = normalizeKeyName(event.key)
  if (!key) {
    return null
  }

  return {
    key,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey
  }
}

export function matchesKeyBinding(
  event: KeyEventLike,
  binding: KeyBinding,
  platform: KeybindingPlatform
): boolean {
  const eventBinding = eventToEffectiveKeyBinding(event)
  const expectedBinding = toEffectiveKeyBinding(binding, platform)
  return (
    eventBinding !== null &&
    expectedBinding !== null &&
    effectiveSignature(eventBinding) === effectiveSignature(expectedBinding)
  )
}

export interface KeyBindingFromEventOptions {
  /** Persist the platform's primary modifier as portable `Mod`. */
  readonly preferMod?: boolean
}

export function keyBindingFromEvent(
  event: KeyEventLike,
  platform: KeybindingPlatform,
  options: KeyBindingFromEventOptions = {}
): KeyBinding | null {
  const effective = eventToEffectiveKeyBinding(event)
  if (!effective) {
    return null
  }

  const modifiers: string[] = []
  const isOnlyPrimaryModifier =
    platform === 'darwin' ? effective.meta && !effective.ctrl : effective.ctrl && !effective.meta

  if ((options.preferMod ?? true) && isOnlyPrimaryModifier) {
    modifiers.push('Mod')
  } else {
    if (effective.ctrl) modifiers.push('Ctrl')
    if (effective.meta) modifiers.push('Cmd')
  }
  if (effective.alt) modifiers.push('Alt')
  if (effective.shift && !BASE_KEY_BY_SHIFTED.has(effective.key)) modifiers.push('Shift')

  const normalized = normalizeKeyBinding([...modifiers, effective.key].join('+'))
  return normalized.ok ? normalized.binding : null
}

interface ReservedKeyBindingDefinition extends ReservedKeyBindingReason {
  readonly binding: KeyBinding
  readonly platforms: readonly KeybindingPlatform[]
  readonly allowedActionIds?: readonly WorkspaceActionId[]
}

const ALL_PLATFORMS: readonly KeybindingPlatform[] = ['win32', 'linux', 'darwin']
const DESKTOP_PLATFORMS: readonly KeybindingPlatform[] = ['win32', 'linux']

/** Native/Electron chords that the renderer cannot safely promise to dispatch. */
export const RESERVED_KEY_BINDINGS: readonly ReservedKeyBindingDefinition[] = [
  {
    binding: 'F12',
    platforms: ALL_PLATFORMS,
    code: 'devtools',
    message: 'F12 is reserved for Electron development tools.'
  },
  {
    binding: 'Mod+Shift+I',
    platforms: DESKTOP_PLATFORMS,
    code: 'devtools',
    message: 'This chord is reserved for Electron development tools.'
  },
  {
    binding: 'Mod+Alt+I',
    platforms: ['darwin'],
    code: 'devtools',
    message: 'This chord is reserved for Electron development tools.'
  },
  {
    binding: 'Mod+R',
    platforms: ALL_PLATFORMS,
    code: 'reload',
    message: 'This chord is reserved for application reload.'
  },
  {
    binding: 'Mod+Shift+R',
    platforms: ALL_PLATFORMS,
    code: 'reload',
    message: 'This chord is reserved for application reload.'
  },
  {
    binding: 'Alt+F4',
    platforms: DESKTOP_PLATFORMS,
    code: 'native-window-close',
    message: 'Alt+F4 is owned by the operating system window manager.'
  },
  {
    binding: 'Cmd+Q',
    platforms: ['darwin'],
    code: 'quit-application',
    message: 'Cmd+Q is owned by the macOS Quit application menu role.'
  },
  {
    binding: 'Cmd+H',
    platforms: ['darwin'],
    code: 'hide-application',
    message: 'Cmd+H is owned by the macOS Hide application menu role.'
  },
  {
    binding: 'Cmd+Alt+H',
    platforms: ['darwin'],
    code: 'hide-application',
    message: 'Cmd+Alt+H is owned by the macOS Hide Others application menu role.'
  },
  {
    binding: 'Cmd+M',
    platforms: ['darwin'],
    code: 'minimize-window',
    message: 'Cmd+M is owned by the macOS Minimize window menu role.'
  },
  {
    binding: 'Cmd+Z',
    platforms: ['darwin'],
    code: 'native-edit',
    message: 'Cmd+Z is owned by the macOS Edit menu.'
  },
  {
    binding: 'Cmd+Shift+Z',
    platforms: ['darwin'],
    code: 'native-edit',
    message: 'Cmd+Shift+Z is owned by the macOS Edit menu.'
  },
  {
    binding: 'Cmd+X',
    platforms: ['darwin'],
    code: 'native-edit',
    message: 'Cmd+X is owned by the macOS Edit menu.'
  },
  {
    binding: 'Cmd+C',
    platforms: ['darwin'],
    code: 'native-edit',
    message: 'Cmd+C is owned by the macOS Edit menu.'
  },
  {
    binding: 'Cmd+V',
    platforms: ['darwin'],
    code: 'native-edit',
    message: 'Cmd+V is owned by the macOS Edit menu.'
  },
  {
    binding: 'Cmd+Shift+V',
    platforms: ['darwin'],
    code: 'native-edit',
    message: 'Cmd+Shift+V is owned by the macOS Edit menu.'
  },
  {
    binding: 'Cmd+A',
    platforms: ['darwin'],
    code: 'native-edit',
    message: 'Cmd+A is owned by the macOS Edit menu.'
  },
  {
    binding: 'Cmd+W',
    platforms: ['darwin'],
    code: 'native-window-close',
    message: 'Cmd+W is reserved for Close Active Item so it cannot close the native window.',
    allowedActionIds: ['workbench.close-item']
  }
]

/** Concise alias for settings catalogs. */
export const RESERVED_CHORDS = RESERVED_KEY_BINDINGS

/**
 * electron-toolkit matches these guards by physical key code and modifier
 * presence, not by an exact logical chord. Keep the renderer keymap at least
 * as broad so it never accepts a binding that the main process can consume.
 */
function getElectronToolkitReservedFamilyReason(
  binding: KeyBinding,
  platform: KeybindingPlatform
): ReservedKeyBindingReason | null {
  const effective = toEffectiveKeyBinding(binding, platform)
  if (!effective) {
    return null
  }

  if (
    effective.key === 'F12' ||
    (effective.key === 'I' &&
      ((effective.alt && effective.meta) || (effective.ctrl && effective.shift)))
  ) {
    return {
      code: 'devtools',
      message: 'This chord is reserved for Electron development tools.'
    }
  }

  if (effective.key === 'R' && (effective.ctrl || effective.meta)) {
    return {
      code: 'reload',
      message: 'This chord is reserved for application reload.'
    }
  }

  return null
}

export function getReservedKeyBindingReason(
  binding: KeyBinding,
  platform: KeybindingPlatform,
  actionId?: string
): ReservedKeyBindingReason | null {
  const signature = getKeyBindingSignature(binding, platform)
  if (!signature) {
    return null
  }

  const canonicalActionId = actionId ? canonicalizeActionId(actionId) : undefined
  for (const reserved of RESERVED_KEY_BINDINGS) {
    if (!reserved.platforms.includes(platform)) {
      continue
    }
    if (getKeyBindingSignature(reserved.binding, platform) !== signature) {
      continue
    }
    if (
      canonicalActionId &&
      reserved.allowedActionIds?.includes(canonicalActionId as WorkspaceActionId)
    ) {
      return null
    }
    return { code: reserved.code, message: reserved.message }
  }

  return getElectronToolkitReservedFamilyReason(binding, platform)
}

export const getReservedChordReason = getReservedKeyBindingReason

function isUnsafePrintableBinding(binding: KeyBinding, platform: KeybindingPlatform): boolean {
  const effective = toEffectiveKeyBinding(binding, platform)
  if (!effective || effective.ctrl || effective.meta || effective.alt) return false
  return effective.key === 'Space' || effective.key === 'Plus' || effective.key.length === 1
}

export function validateUserKeyBinding(
  input: string,
  platform: KeybindingPlatform,
  actionId?: string
): UserKeyBindingValidationResult {
  const normalized = normalizeKeyBinding(input)
  if (!normalized.ok) {
    return normalized
  }
  if (normalized.binding === 'Escape') {
    return {
      ok: false,
      code: 'recorder-control',
      message: 'Escape cancels key recording and cannot be recorded here.'
    }
  }
  if (isUnsafePrintableBinding(normalized.binding, platform)) {
    return {
      ok: false,
      code: 'unsafe-unmodified-printable',
      message: 'Add Ctrl, Cmd, Alt, Shift, or Mod so typing is not captured by the application.'
    }
  }
  const reserved = getReservedKeyBindingReason(normalized.binding, platform, actionId)
  if (reserved) {
    return {
      ok: false,
      code: 'reserved',
      message: reserved.message,
      reserved
    }
  }
  return normalized
}

function ownOverride(
  overrides: KeymapOverrides,
  actionId: WorkspaceActionId
): readonly KeyBinding[] | undefined {
  if (Object.hasOwn(overrides, actionId)) {
    return overrides[actionId]
  }
  for (const [legacyId, canonicalId] of Object.entries(ACTION_ID_ALIASES)) {
    if (canonicalId === actionId && Object.hasOwn(overrides, legacyId)) {
      return overrides[legacyId]
    }
  }
  return undefined
}

function dedupeValidBindings(
  bindingsToNormalize: readonly KeyBinding[],
  platform: KeybindingPlatform,
  actionId: WorkspaceActionId
): KeyBinding[] {
  const result: KeyBinding[] = []
  const signatures = new Set<string>()
  for (const candidate of bindingsToNormalize) {
    const normalized = normalizeKeyBinding(candidate)
    if (!normalized.ok) continue
    if (getReservedKeyBindingReason(normalized.binding, platform, actionId)) continue
    const signature = getKeyBindingSignature(normalized.binding, platform)
    if (!signature || signatures.has(signature)) continue
    signatures.add(signature)
    result.push(normalized.binding)
  }
  return result
}

/** Missing override means defaults; an explicit empty array means unbound. */
export function getEffectiveBindings(
  actionId: string,
  platform: KeybindingPlatform,
  overrides: KeymapOverrides = {}
): readonly KeyBinding[] {
  const canonicalId = resolveWorkspaceActionId(actionId)
  if (!canonicalId) return []
  const override = ownOverride(overrides, canonicalId)
  return dedupeValidBindings(
    override === undefined ? getDefaultBindings(canonicalId, platform) : override,
    platform,
    canonicalId
  )
}

export interface KeyBindingConflict {
  readonly actionId: WorkspaceActionId
  readonly title: string
  readonly context: ActionContext
  readonly binding: KeyBinding
}

export function actionContextsOverlap(left: ActionContext, right: ActionContext): boolean {
  if (left === right) return true

  const modalContexts = new Set<ActionContext>(['Picker', 'Settings', 'Dialog', 'KeyRecorder'])
  if (modalContexts.has(left) || modalContexts.has(right)) return false

  if (left === 'Workspace' || right === 'Workspace') return true
  return (left === 'Editor' && right === 'Input') || (left === 'Input' && right === 'Editor')
}

export function findKeyBindingConflicts(
  actionId: string,
  binding: KeyBinding,
  platform: KeybindingPlatform,
  overrides: KeymapOverrides = {}
): readonly KeyBindingConflict[] {
  const canonicalId = resolveWorkspaceActionId(actionId)
  const target = canonicalId ? getWorkspaceActionDefinition(canonicalId) : undefined
  const signature = getKeyBindingSignature(binding, platform)
  if (!canonicalId || !target || !signature) return []

  const conflicts: KeyBindingConflict[] = []
  for (const definition of WORKSPACE_ACTION_DEFINITIONS) {
    if (
      definition.id === canonicalId ||
      !actionContextsOverlap(target.context, definition.context)
    ) {
      continue
    }
    const matchingBinding = getEffectiveBindings(definition.id, platform, overrides).find(
      (candidate) => getKeyBindingSignature(candidate, platform) === signature
    )
    if (matchingBinding) {
      conflicts.push({
        actionId: definition.id,
        title: definition.title,
        context: definition.context,
        binding: matchingBinding
      })
    }
  }
  return conflicts
}

export type AssignKeyBindingResult =
  | {
      readonly ok: true
      readonly binding: KeyBinding
      readonly overrides: KeymapOverrides
      readonly displacedActionIds: readonly WorkspaceActionId[]
    }
  | {
      readonly ok: false
      readonly code: 'unknown-action' | 'invalid-binding' | 'conflict'
      readonly message: string
      readonly conflicts: readonly KeyBindingConflict[]
      readonly validation?: UserKeyBindingValidationResult
    }

function withoutEquivalentBinding(
  bindingsToFilter: readonly KeyBinding[],
  binding: KeyBinding,
  platform: KeybindingPlatform
): KeyBinding[] {
  const signature = getKeyBindingSignature(binding, platform)
  return bindingsToFilter.filter(
    (candidate) => getKeyBindingSignature(candidate, platform) !== signature
  )
}

/**
 * Assign a binding. With `replaceConflicts`, every overlapping action loses
 * only the colliding effective chord in the same atomic override object.
 */
export function assignKeyBinding(
  overrides: KeymapOverrides,
  actionId: string,
  input: string,
  platform: KeybindingPlatform,
  options: { readonly replaceConflicts?: boolean } = {}
): AssignKeyBindingResult {
  const canonicalId = resolveWorkspaceActionId(actionId)
  if (!canonicalId) {
    return {
      ok: false,
      code: 'unknown-action',
      message: `Unknown keybindable action “${actionId}”.`,
      conflicts: []
    }
  }

  const validation = validateUserKeyBinding(input, platform, canonicalId)
  if (!validation.ok) {
    return {
      ok: false,
      code: 'invalid-binding',
      message: validation.message,
      conflicts: [],
      validation
    }
  }

  const conflicts = findKeyBindingConflicts(canonicalId, validation.binding, platform, overrides)
  if (conflicts.length > 0 && !options.replaceConflicts) {
    return {
      ok: false,
      code: 'conflict',
      message: `The binding is already used by ${conflicts.map((conflict) => conflict.title).join(', ')}.`,
      conflicts
    }
  }

  const next: Record<string, readonly KeyBinding[] | undefined> = { ...overrides }
  const targetBindings = getEffectiveBindings(canonicalId, platform, overrides)
  const targetWithoutDuplicate = withoutEquivalentBinding(
    targetBindings,
    validation.binding,
    platform
  )
  next[canonicalId] = [...targetWithoutDuplicate, validation.binding]

  for (const conflict of conflicts) {
    next[conflict.actionId] = withoutEquivalentBinding(
      getEffectiveBindings(conflict.actionId, platform, overrides),
      validation.binding,
      platform
    )
  }

  for (const [legacyId, aliasTarget] of Object.entries(ACTION_ID_ALIASES)) {
    if (aliasTarget === canonicalId) delete next[legacyId]
  }

  return {
    ok: true,
    binding: validation.binding,
    overrides: next,
    displacedActionIds: conflicts.map((conflict) => conflict.actionId)
  }
}

export function removeKeyBinding(
  overrides: KeymapOverrides,
  actionId: string,
  binding: KeyBinding,
  platform: KeybindingPlatform
): KeymapOverrides {
  const canonicalId = resolveWorkspaceActionId(actionId)
  if (!canonicalId) return overrides
  const next: Record<string, readonly KeyBinding[] | undefined> = {
    ...overrides,
    [canonicalId]: withoutEquivalentBinding(
      getEffectiveBindings(canonicalId, platform, overrides),
      binding,
      platform
    )
  }
  removeLegacyOverrideIds(next, canonicalId)
  return next
}

export function unbindAction(overrides: KeymapOverrides, actionId: string): KeymapOverrides {
  const canonicalId = resolveWorkspaceActionId(actionId)
  if (!canonicalId) return overrides
  const next: Record<string, readonly KeyBinding[] | undefined> = {
    ...overrides,
    [canonicalId]: []
  }
  removeLegacyOverrideIds(next, canonicalId)
  return next
}

function removeLegacyOverrideIds(
  overrides: Record<string, readonly KeyBinding[] | undefined>,
  canonicalId: WorkspaceActionId
): void {
  for (const [legacyId, aliasTarget] of Object.entries(ACTION_ID_ALIASES)) {
    if (aliasTarget === canonicalId) delete overrides[legacyId]
  }
}

export function resetKeymapOverride(overrides: KeymapOverrides, actionId: string): KeymapOverrides {
  const canonicalId = resolveWorkspaceActionId(actionId)
  if (!canonicalId) return overrides
  const next: Record<string, readonly KeyBinding[] | undefined> = { ...overrides }
  delete next[canonicalId]
  removeLegacyOverrideIds(next, canonicalId)
  return next
}

const BLOCKING_CONTEXTS = new Set<ActionContext>(['Picker', 'Settings', 'Dialog', 'KeyRecorder'])

const MODAL_HAZARDOUS_DEFAULTS: readonly {
  readonly actionId: WorkspaceActionId
  readonly binding: KeyBinding
}[] = [
  { actionId: 'file.open', binding: 'Mod+P' },
  { actionId: 'workbench.close-item', binding: 'Mod+W' }
]

function getModalHazardousDefault(
  event: KeyEventLike,
  platform: KeybindingPlatform,
  contexts: readonly ActionContext[]
): WorkspaceActionId | null {
  if (
    !contexts.includes('Picker') &&
    !contexts.includes('Settings') &&
    !contexts.includes('Dialog')
  ) {
    return null
  }

  return (
    MODAL_HAZARDOUS_DEFAULTS.find(({ binding }) => matchesKeyBinding(event, binding, platform))
      ?.actionId ?? null
  )
}

const EDITOR_OWNED_BINDINGS: readonly KeyBinding[] = [
  'Mod+A',
  'Mod+B',
  'Mod+C',
  'Mod+F',
  'Mod+V',
  'Mod+Shift+V',
  'Mod+X',
  'Mod+Z',
  'Mod+Shift+Z',
  'Ctrl+Y'
]

const EDITOR_OWNED_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Backspace',
  'Delete',
  'End',
  'Enter',
  'Home',
  'Tab'
])

const DIALOG_OWNED_KEYS = new Set(['Enter', 'Space', 'Tab'])

const EDITOR_OWNED_WORKSPACE_EXCEPTIONS: Readonly<
  Partial<Record<WorkspaceActionId, readonly KeyBinding[]>>
> = {
  'workbench.mru-next': ['Ctrl+Tab'],
  'workbench.mru-previous': ['Ctrl+Shift+Tab']
}

export function isEditorOwnedKeyBinding(
  binding: KeyBinding,
  platform: KeybindingPlatform
): boolean {
  const signature = getKeyBindingSignature(binding, platform)
  if (
    EDITOR_OWNED_BINDINGS.some(
      (candidate) => getKeyBindingSignature(candidate, platform) === signature
    )
  ) {
    return true
  }

  const effective = toEffectiveKeyBinding(binding, platform)
  return effective ? EDITOR_OWNED_KEYS.has(effective.key) : false
}

function isEditorOwnedWorkspaceException(
  actionId: WorkspaceActionId,
  binding: KeyBinding,
  platform: KeybindingPlatform
): boolean {
  const signature = getKeyBindingSignature(binding, platform)
  return (EDITOR_OWNED_WORKSPACE_EXCEPTIONS[actionId] ?? []).some(
    (candidate) => getKeyBindingSignature(candidate, platform) === signature
  )
}

function isDialogOwnedKeyBinding(binding: KeyBinding, platform: KeybindingPlatform): boolean {
  const effective = toEffectiveKeyBinding(binding, platform)
  return effective
    ? !effective.ctrl &&
        !effective.meta &&
        !effective.alt &&
        (!effective.shift || effective.key === 'Tab') &&
        DIALOG_OWNED_KEYS.has(effective.key)
    : false
}

export type KeyBindingGuardReason = 'modal-context' | 'key-recorder' | 'repeat' | 'conflict'

export type KeyBindingResolution =
  | {
      readonly kind: 'dispatch'
      readonly actionId: WorkspaceActionId
      readonly binding: KeyBinding
      readonly preventDefault: true
    }
  | {
      readonly kind: 'guard'
      readonly reason: KeyBindingGuardReason
      readonly actionIds: readonly WorkspaceActionId[]
      readonly preventDefault: true
    }
  | {
      readonly kind: 'none'
      readonly reason: 'composition' | 'no-match' | 'editor-owned' | 'focused-control' | 'disabled'
      readonly preventDefault: false
    }

export interface ResolveKeyBindingOptions {
  readonly platform: KeybindingPlatform
  /** Most-specific context first; Workspace is appended when omitted. */
  readonly activeContexts?: readonly ActionContext[]
  readonly overrides?: KeymapOverrides
  readonly isActionEnabled?: (actionId: WorkspaceActionId) => boolean
}

function normalizedContextStack(contexts: readonly ActionContext[] | undefined): ActionContext[] {
  const result: ActionContext[] = []
  for (const context of contexts ?? ['Workspace']) {
    if (!result.includes(context)) result.push(context)
  }
  if (!result.includes('Workspace')) result.push('Workspace')
  return result
}

function eventSignature(event: KeyEventLike): string | null {
  const effective = eventToEffectiveKeyBinding(event)
  return effective ? effectiveSignature(effective) : null
}

interface MatchingAction {
  readonly definition: WorkspaceActionDefinition & { readonly id: WorkspaceActionId }
  readonly binding: KeyBinding
}

function matchingActions(
  event: KeyEventLike,
  platform: KeybindingPlatform,
  overrides: KeymapOverrides
): MatchingAction[] {
  const signature = eventSignature(event)
  if (!signature) return []

  const matches: MatchingAction[] = []
  for (const definition of WORKSPACE_ACTION_DEFINITIONS) {
    const binding = getEffectiveBindings(definition.id, platform, overrides).find(
      (candidate) => getKeyBindingSignature(candidate, platform) === signature
    )
    if (binding) {
      matches.push({
        definition: definition as WorkspaceActionDefinition & { readonly id: WorkspaceActionId },
        binding
      })
    }
  }
  return matches
}

/**
 * Pure shortcut resolution. Callers prevent the native event only when this
 * returns `preventDefault: true`, and dispatch only the returned stable ID.
 */
export function resolveKeyBinding(
  event: KeyEventLike,
  options: ResolveKeyBindingOptions
): KeyBindingResolution {
  const contexts = normalizedContextStack(options.activeContexts)
  if (contexts.includes('KeyRecorder')) {
    return {
      kind: 'guard',
      reason: 'key-recorder',
      actionIds: [],
      preventDefault: true
    }
  }

  const modalHazardousActionId = getModalHazardousDefault(event, options.platform, contexts)
  if (modalHazardousActionId) {
    return {
      kind: 'guard',
      reason: 'modal-context',
      actionIds: [modalHazardousActionId],
      preventDefault: true
    }
  }

  if (event.isComposing) {
    return { kind: 'none', reason: 'composition', preventDefault: false }
  }

  const eventBinding = keyBindingFromEvent(event, options.platform, { preferMod: true })
  if (
    eventBinding &&
    contexts.includes('Dialog') &&
    isDialogOwnedKeyBinding(eventBinding, options.platform)
  ) {
    return { kind: 'none', reason: 'focused-control', preventDefault: false }
  }

  const matches = matchingActions(event, options.platform, options.overrides ?? {})
  if (matches.length === 0) {
    return { kind: 'none', reason: 'no-match', preventDefault: false }
  }

  if (
    eventBinding &&
    (contexts.includes('Editor') || contexts.includes('Input')) &&
    isEditorOwnedKeyBinding(eventBinding, options.platform) &&
    !matches.some(
      (match) =>
        contexts.includes(match.definition.context) &&
        (match.definition.context === 'Editor' || match.definition.context === 'Input')
    ) &&
    !matches.some((match) =>
      isEditorOwnedWorkspaceException(match.definition.id, match.binding, options.platform)
    )
  ) {
    return { kind: 'none', reason: 'editor-owned', preventDefault: false }
  }

  const blockingContext = contexts
    .filter((context) => BLOCKING_CONTEXTS.has(context))
    .sort((left, right) => ACTION_CONTEXT_PRECEDENCE[left] - ACTION_CONTEXT_PRECEDENCE[right])[0]

  if (blockingContext) {
    const ownedMatches = matches.filter((match) => match.definition.context === blockingContext)
    if (ownedMatches.length === 0) {
      return {
        kind: 'guard',
        reason: 'modal-context',
        actionIds: matches.map((match) => match.definition.id),
        preventDefault: true
      }
    }
  }

  const reachable = matches.filter((match) => contexts.includes(match.definition.context))
  if (reachable.length === 0) {
    return { kind: 'none', reason: 'no-match', preventDefault: false }
  }

  const bestPrecedence = Math.min(
    ...reachable.map((match) => ACTION_CONTEXT_PRECEDENCE[match.definition.context])
  )
  const winners = reachable.filter(
    (match) => ACTION_CONTEXT_PRECEDENCE[match.definition.context] === bestPrecedence
  )

  if (winners.length > 1) {
    return {
      kind: 'guard',
      reason: 'conflict',
      actionIds: winners.map((winner) => winner.definition.id),
      preventDefault: true
    }
  }

  const winner = winners[0]
  if (!(options.isActionEnabled?.(winner.definition.id) ?? true)) {
    return { kind: 'none', reason: 'disabled', preventDefault: false }
  }
  if (event.repeat && !winner.definition.allowRepeat) {
    return {
      kind: 'guard',
      reason: 'repeat',
      actionIds: [winner.definition.id],
      preventDefault: true
    }
  }

  return {
    kind: 'dispatch',
    actionId: winner.definition.id,
    binding: winner.binding,
    preventDefault: true
  }
}
