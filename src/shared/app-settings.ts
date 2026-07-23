import { validateUserKeyBinding } from './keybindings'
import {
  canonicalizeActionId,
  KEYBINDABLE_ACTION_IDS,
  type KeybindingPlatform
} from './workspace-actions'

export type AppTheme = 'light' | 'dark' | 'system'
export type FileTreeSortSetting = 'name' | 'modified-desc' | 'created-desc'
export type DefaultNoteViewSetting = 'source' | 'live' | 'reading'
export type ActivateOnCloseSetting = 'history' | 'right' | 'left'
export type WhenClosingWithNoTabsSetting = 'keep_window_open' | 'close_window'
export type KeymapOverrides = Record<string, string[]>
export type AppSettingsCategory = 'General' | 'Editor' | 'Workbench' | 'Keymap'
export type AppSettingControlKind = 'choice' | 'range' | 'toggle' | 'keymap'

export interface PagePreviewSettings {
  enabled: boolean
  requireModifier: boolean
}

export interface WorkbenchSettings {
  activateOnClose: ActivateOnCloseSetting
  whenClosingWithNoTabs: WhenClosingWithNoTabsSetting
}

export interface AppSettingsSnapshot {
  version: 5
  theme: AppTheme
  fileTreeSort: FileTreeSortSetting
  defaultNoteView: DefaultNoteViewSetting
  editorFontSize: number
  pagePreview: PagePreviewSettings
  workbench: WorkbenchSettings
  keymapOverrides: KeymapOverrides
}

export interface AppSettingsPatch {
  theme?: AppTheme
  fileTreeSort?: FileTreeSortSetting
  defaultNoteView?: DefaultNoteViewSetting
  editorFontSize?: number
  pagePreview?: Partial<PagePreviewSettings>
  workbench?: Partial<WorkbenchSettings>
  keymapOverrides?: KeymapOverrides
}

export interface AppSettingChoice<TValue extends string> {
  value: TValue
  label: string
  description: string
}

export interface AppSettingDefinition<TValue> {
  key: string
  category: AppSettingsCategory
  label: string
  description: string
  control: AppSettingControlKind
  defaultValue: TValue
  searchTerms: readonly string[]
  options?: readonly AppSettingChoice<Extract<TValue, string>>[]
  range?: Readonly<{ min: number; max: number; step: number }>
  normalize: (value: unknown, context?: AppSettingsNormalizationContext) => TValue
}

export interface AppSettingsNormalizationContext {
  platform: KeybindingPlatform
}

export const MIN_EDITOR_FONT_SIZE = 12
export const MAX_EDITOR_FONT_SIZE = 20
export const DEFAULT_EDITOR_FONT_SIZE = 13.5
export const MAX_KEYMAP_OVERRIDE_ACTIONS = 128
export const MAX_KEYMAP_BINDINGS_PER_ACTION = 8
export const MAX_KEYMAP_BINDING_LENGTH = 64
export const MAX_KEYMAP_ACTION_ID_LENGTH = 128

const MAX_KEYMAP_BINDING_CANDIDATES_PER_ACTION = MAX_KEYMAP_BINDINGS_PER_ACTION * 4
const KEYBINDABLE_ACTION_ID_SET = new Set<string>(KEYBINDABLE_ACTION_IDS)

const themeDefinition = {
  key: 'theme',
  category: 'General',
  label: 'Theme',
  description: 'Choose the edition used across the application.',
  control: 'choice',
  defaultValue: 'system',
  searchTerms: ['appearance', 'light', 'dark', 'system', 'edition'],
  options: [
    { value: 'light', label: 'Light', description: 'Warm paper edition' },
    { value: 'dark', label: 'Dark', description: "Tonight's edition" },
    { value: 'system', label: 'System', description: 'Follow this device' }
  ],
  normalize: normalizeTheme
} as const satisfies AppSettingDefinition<AppTheme>

const fileTreeSortDefinition = {
  key: 'fileTreeSort',
  category: 'General',
  label: 'File tree sort',
  description: 'Change how files are ordered in the vault explorer.',
  control: 'choice',
  defaultValue: 'name',
  searchTerms: ['navigation', 'explorer', 'name', 'modified', 'created', 'order'],
  options: [
    { value: 'name', label: 'Name', description: 'A–Z by path' },
    { value: 'modified-desc', label: 'Modified', description: 'Recently edited first' },
    { value: 'created-desc', label: 'Created', description: 'Newest first' }
  ],
  normalize: normalizeFileTreeSort
} as const satisfies AppSettingDefinition<FileTreeSortSetting>

const editorFontSizeDefinition = {
  key: 'editorFontSize',
  category: 'Editor',
  label: 'Source editor font size',
  description: 'Set the text size used by MDX notes and editable plain-text files.',
  control: 'range',
  defaultValue: DEFAULT_EDITOR_FONT_SIZE,
  searchTerms: ['writing', 'source', 'font', 'size', 'markdown', 'mdx', 'text'],
  range: { min: MIN_EDITOR_FONT_SIZE, max: MAX_EDITOR_FONT_SIZE, step: 0.5 },
  normalize: normalizeEditorFontSize
} as const satisfies AppSettingDefinition<number>

const defaultNoteViewDefinition = {
  key: 'defaultNoteView',
  category: 'Editor',
  label: 'Default view for new tabs',
  description: 'Choose how a Markdown or MDX note opens when it gets a new tab.',
  control: 'choice',
  defaultValue: 'reading',
  searchTerms: ['open', 'tab', 'reading', 'live preview', 'source', 'markdown', 'mdx'],
  options: [
    {
      value: 'reading',
      label: 'Reading',
      description: 'Open the rendered note'
    },
    {
      value: 'live',
      label: 'Live preview',
      description: 'Edit with inline formatting'
    },
    {
      value: 'source',
      label: 'Source',
      description: 'Edit the raw MDX source'
    }
  ],
  normalize: normalizeDefaultNoteView
} as const satisfies AppSettingDefinition<DefaultNoteViewSetting>

const pagePreviewEnabledDefinition = {
  key: 'pagePreview.enabled',
  category: 'Editor',
  label: 'Page preview',
  description: 'Show a compact reading preview when a note link is held under the pointer.',
  control: 'toggle',
  defaultValue: true,
  searchTerms: ['hover', 'link', 'popover', 'reading', 'preview'],
  normalize: normalizeBooleanWithDefault(true)
} as const satisfies AppSettingDefinition<boolean>

const pagePreviewRequireModifierDefinition = {
  key: 'pagePreview.requireModifier',
  category: 'Editor',
  label: 'Require modifier key',
  description: 'Only show page previews while Command or Ctrl is held.',
  control: 'toggle',
  defaultValue: false,
  searchTerms: ['command', 'ctrl', 'control', 'modifier', 'hover', 'preview'],
  normalize: normalizeBooleanWithDefault(false)
} as const satisfies AppSettingDefinition<boolean>

const activateOnCloseDefinition = {
  key: 'workbench.activateOnClose',
  category: 'Workbench',
  label: 'Activate on close',
  description: 'Choose which surviving item becomes active after an active tab closes.',
  control: 'choice',
  defaultValue: 'history',
  searchTerms: ['tabs', 'close item', 'history', 'right', 'left', 'mru'],
  options: [
    {
      value: 'history',
      label: 'History',
      description: 'Return to the most recently used open item'
    },
    {
      value: 'right',
      label: 'Right',
      description: 'Choose the nearest item to the right, then left'
    },
    {
      value: 'left',
      label: 'Left',
      description: 'Choose the nearest item to the left, then right'
    }
  ],
  normalize: normalizeActivateOnClose
} as const satisfies AppSettingDefinition<ActivateOnCloseSetting>

const whenClosingWithNoTabsDefinition = {
  key: 'workbench.whenClosingWithNoTabs',
  category: 'Workbench',
  label: 'When closing with no tabs',
  description: 'Choose what Close Active Item does after the workbench is already empty.',
  control: 'choice',
  defaultValue: 'keep_window_open',
  searchTerms: ['tabs', 'close item', 'empty workbench', 'window', 'keep open', 'close window'],
  options: [
    {
      value: 'keep_window_open',
      label: 'Keep window open',
      description: 'Leave an empty workbench ready for another file'
    },
    {
      value: 'close_window',
      label: 'Close window',
      description: 'A second Close Active Item closes the native window'
    }
  ],
  normalize: normalizeWhenClosingWithNoTabs
} as const satisfies AppSettingDefinition<WhenClosingWithNoTabsSetting>

const keymapOverridesDefinition = {
  key: 'keymapOverrides',
  category: 'Keymap',
  label: 'Application key bindings',
  description: 'Add, remove, unbind, or reset single-keystroke application commands.',
  control: 'keymap',
  defaultValue: {} as KeymapOverrides,
  searchTerms: ['keymap', 'keys', 'shortcuts', 'commands', 'actions', 'bindings', 'chords'],
  normalize: (value: unknown, context?: AppSettingsNormalizationContext) =>
    normalizeKeymapOverrides(value, context?.platform ?? 'linux')
} as const satisfies AppSettingDefinition<KeymapOverrides>

/** Source of truth for renderer-visible, non-secret application settings. */
export const APP_SETTINGS_CATALOG = {
  theme: themeDefinition,
  fileTreeSort: fileTreeSortDefinition,
  defaultNoteView: defaultNoteViewDefinition,
  editorFontSize: editorFontSizeDefinition,
  pagePreviewEnabled: pagePreviewEnabledDefinition,
  pagePreviewRequireModifier: pagePreviewRequireModifierDefinition,
  activateOnClose: activateOnCloseDefinition,
  whenClosingWithNoTabs: whenClosingWithNoTabsDefinition,
  keymapOverrides: keymapOverridesDefinition
} as const

export const APP_THEME_VALUES = choiceValues(APP_SETTINGS_CATALOG.theme.options)
export const FILE_TREE_SORT_VALUES = choiceValues(APP_SETTINGS_CATALOG.fileTreeSort.options)
export const DEFAULT_NOTE_VIEW_VALUES = choiceValues(APP_SETTINGS_CATALOG.defaultNoteView.options)
export const ACTIVATE_ON_CLOSE_VALUES = choiceValues(APP_SETTINGS_CATALOG.activateOnClose.options)
export const WHEN_CLOSING_WITH_NO_TABS_VALUES = choiceValues(
  APP_SETTINGS_CATALOG.whenClosingWithNoTabs.options
)

export const APP_SETTINGS_DEFINITIONS = Object.values(APP_SETTINGS_CATALOG)

export const DEFAULT_WORKBENCH_SETTINGS: Readonly<WorkbenchSettings> = {
  activateOnClose: APP_SETTINGS_CATALOG.activateOnClose.defaultValue,
  whenClosingWithNoTabs: APP_SETTINGS_CATALOG.whenClosingWithNoTabs.defaultValue
}

export const DEFAULT_APP_SETTINGS_SNAPSHOT: Readonly<AppSettingsSnapshot> = {
  version: 5,
  theme: APP_SETTINGS_CATALOG.theme.defaultValue,
  fileTreeSort: APP_SETTINGS_CATALOG.fileTreeSort.defaultValue,
  defaultNoteView: APP_SETTINGS_CATALOG.defaultNoteView.defaultValue,
  editorFontSize: APP_SETTINGS_CATALOG.editorFontSize.defaultValue,
  pagePreview: {
    enabled: APP_SETTINGS_CATALOG.pagePreviewEnabled.defaultValue,
    requireModifier: APP_SETTINGS_CATALOG.pagePreviewRequireModifier.defaultValue
  },
  workbench: DEFAULT_WORKBENCH_SETTINGS,
  keymapOverrides: {}
}

interface SearchableAppSettingDefinition {
  key: string
  category: AppSettingsCategory
  label: string
  description: string
  searchTerms: readonly string[]
  options?: readonly {
    value: unknown
    label: string
    description: string
  }[]
}

export function appSettingSearchText(
  definitions: readonly SearchableAppSettingDefinition[]
): string {
  return definitions
    .flatMap((definition) => [
      definition.key,
      definition.category,
      definition.label,
      definition.description,
      ...definition.searchTerms,
      ...(definition.options?.flatMap((option) => [
        String(option.value),
        option.label,
        option.description
      ]) ?? [])
    ])
    .join(' ')
}

export function normalizeTheme(value: unknown): AppTheme {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : APP_SETTINGS_CATALOG.theme.defaultValue
}

export function normalizeFileTreeSort(value: unknown): FileTreeSortSetting {
  return value === 'name' || value === 'modified-desc' || value === 'created-desc'
    ? value
    : APP_SETTINGS_CATALOG.fileTreeSort.defaultValue
}

export function normalizeDefaultNoteView(value: unknown): DefaultNoteViewSetting {
  return value === 'source' || value === 'live' || value === 'reading'
    ? value
    : APP_SETTINGS_CATALOG.defaultNoteView.defaultValue
}

export function normalizeEditorFontSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return APP_SETTINGS_CATALOG.editorFontSize.defaultValue
  }
  const { min, max } = APP_SETTINGS_CATALOG.editorFontSize.range
  return Math.min(max, Math.max(min, value))
}

function normalizeBooleanWithDefault(defaultValue: boolean): (value: unknown) => boolean {
  return (value) => (typeof value === 'boolean' ? value : defaultValue)
}

export function normalizeActivateOnClose(value: unknown): ActivateOnCloseSetting {
  return value === 'history' || value === 'right' || value === 'left'
    ? value
    : APP_SETTINGS_CATALOG.activateOnClose.defaultValue
}

export function normalizeWhenClosingWithNoTabs(value: unknown): WhenClosingWithNoTabsSetting {
  return value === 'keep_window_open' || value === 'close_window'
    ? value
    : APP_SETTINGS_CATALOG.whenClosingWithNoTabs.defaultValue
}

export function normalizeKeymapOverrides(
  value: unknown,
  platform: KeybindingPlatform
): KeymapOverrides {
  if (!isRecord(value)) {
    return {}
  }

  const normalized: KeymapOverrides = {}
  let inspectedActionCount = 0

  for (const candidateId in value) {
    if (!Object.hasOwn(value, candidateId)) {
      continue
    }
    if (inspectedActionCount >= MAX_KEYMAP_OVERRIDE_ACTIONS) {
      break
    }
    inspectedActionCount += 1

    const candidateBindings = value[candidateId]
    if (!Array.isArray(candidateBindings)) {
      continue
    }

    const trimmedId = candidateId.trim()
    if (trimmedId.length === 0 || trimmedId.length > MAX_KEYMAP_ACTION_ID_LENGTH) {
      continue
    }

    const actionId = canonicalizeActionId(trimmedId)
    if (!actionId || !KEYBINDABLE_ACTION_ID_SET.has(actionId)) {
      continue
    }

    const bindings: string[] = []
    const candidateLimit = Math.min(
      candidateBindings.length,
      MAX_KEYMAP_BINDING_CANDIDATES_PER_ACTION
    )
    for (let index = 0; index < candidateLimit; index += 1) {
      const candidate = candidateBindings[index]
      if (bindings.length >= MAX_KEYMAP_BINDINGS_PER_ACTION || typeof candidate !== 'string') {
        continue
      }

      const binding = normalizeBindingForPersistence(candidate, actionId, platform)
      if (binding && !bindings.includes(binding)) {
        bindings.push(binding)
      }
    }

    // Only an explicitly empty source array means unbound. A corrupt non-empty
    // array falls back to defaults instead of silently disabling an action.
    if (candidateBindings.length === 0 || bindings.length > 0) {
      normalized[actionId] = bindings
    }
  }

  return normalized
}

function normalizeBindingForPersistence(
  value: string,
  actionId: string,
  platform: KeybindingPlatform
): string | null {
  const binding = value.trim()
  if (binding.length === 0 || binding.length > MAX_KEYMAP_BINDING_LENGTH) {
    return null
  }

  const validation = validateUserKeyBinding(binding, platform, actionId)
  return validation.ok ? validation.binding : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function choiceValues<TValue extends string>(
  options: readonly [AppSettingChoice<TValue>, ...AppSettingChoice<TValue>[]]
): readonly [TValue, ...TValue[]] {
  const [first, ...rest] = options
  return [first.value, ...rest.map((option) => option.value)]
}
