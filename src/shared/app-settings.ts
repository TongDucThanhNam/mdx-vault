import { validateUserKeyBinding } from './keybindings'
import {
  canonicalizeActionId,
  KEYBINDABLE_ACTION_IDS,
  type KeybindingPlatform
} from './workspace-actions'

export type AppTheme = 'light' | 'dark' | 'system'
export type AppLocale = 'system' | 'en' | 'vi'
export type UiDensity = 'comfortable' | 'compact'
export type FileTreeSortSetting = 'name' | 'modified-desc' | 'created-desc'
export type DefaultNoteViewSetting = 'source' | 'live' | 'reading'
export type EditorFontFamilySetting =
  | 'jetbrains-mono'
  | 'maple-mono'
  | 'ibm-plex-mono'
  | 'system-mono'
export type EditorFontWeightSetting = 'regular' | 'medium'
export type EditorTabSizeSetting = '2' | '4' | '8'
export type EditorWordWrapSetting = 'off' | 'viewport' | 'bounded'
export type EditorWhitespaceSetting = 'none' | 'all'
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
  version: 6
  theme: AppTheme
  locale: AppLocale
  density: UiDensity
  uiScale: number
  fileTreeSort: FileTreeSortSetting
  showFileExtensions: boolean
  defaultNoteView: DefaultNoteViewSetting
  editorFontSize: number
  editorFontFamily: EditorFontFamilySetting
  editorFontWeight: EditorFontWeightSetting
  editorLineHeight: number
  editorLigatures: boolean
  editorTabSize: EditorTabSizeSetting
  editorNoteWordWrap: EditorWordWrapSetting
  editorCodeWordWrap: EditorWordWrapSetting
  editorWrapColumn: number
  editorIndentGuides: boolean
  editorWhitespace: EditorWhitespaceSetting
  editorRuler: boolean
  pagePreview: PagePreviewSettings
  workbench: WorkbenchSettings
  keymapOverrides: KeymapOverrides
}

export interface AppSettingsPatch {
  theme?: AppTheme
  locale?: AppLocale
  density?: UiDensity
  uiScale?: number
  fileTreeSort?: FileTreeSortSetting
  showFileExtensions?: boolean
  defaultNoteView?: DefaultNoteViewSetting
  editorFontSize?: number
  editorFontFamily?: EditorFontFamilySetting
  editorFontWeight?: EditorFontWeightSetting
  editorLineHeight?: number
  editorLigatures?: boolean
  editorTabSize?: EditorTabSizeSetting
  editorNoteWordWrap?: EditorWordWrapSetting
  editorCodeWordWrap?: EditorWordWrapSetting
  editorWrapColumn?: number
  editorIndentGuides?: boolean
  editorWhitespace?: EditorWhitespaceSetting
  editorRuler?: boolean
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
export const DEFAULT_EDITOR_FONT_SIZE = 15
export const MIN_EDITOR_LINE_HEIGHT = 1.2
export const MAX_EDITOR_LINE_HEIGHT = 1.8
export const MIN_EDITOR_WRAP_COLUMN = 60
export const MAX_EDITOR_WRAP_COLUMN = 160
export const MIN_UI_SCALE = 90
export const MAX_UI_SCALE = 125
export const DEFAULT_UI_SCALE = 100
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
  description: 'Choose the light treatment used across the application.',
  control: 'choice',
  defaultValue: 'system',
  searchTerms: ['appearance', 'light', 'dark', 'system', 'edition'],
  options: [
    { value: 'light', label: 'Light', description: 'Bright instrument bench' },
    { value: 'dark', label: 'Dark', description: 'Low-light instrument bench' },
    { value: 'system', label: 'System', description: 'Follow this device' }
  ],
  normalize: normalizeTheme
} as const satisfies AppSettingDefinition<AppTheme>

const localeDefinition = {
  key: 'locale',
  category: 'General',
  label: 'Language',
  description: 'Choose the language used by application controls and messages.',
  control: 'choice',
  defaultValue: 'system',
  searchTerms: ['language', 'locale', 'english', 'vietnamese', 'tiếng việt'],
  options: [
    { value: 'system', label: 'System', description: 'Follow this device' },
    { value: 'en', label: 'English', description: 'Use English' },
    { value: 'vi', label: 'Tiếng Việt', description: 'Dùng tiếng Việt' }
  ],
  normalize: normalizeLocale
} as const satisfies AppSettingDefinition<AppLocale>

const densityDefinition = {
  key: 'density',
  category: 'General',
  label: 'Interface density',
  description: 'Choose the spacing used by application chrome and controls.',
  control: 'choice',
  defaultValue: 'comfortable',
  searchTerms: ['density', 'spacing', 'compact', 'comfortable', 'chrome'],
  options: [
    { value: 'comfortable', label: 'Comfortable', description: 'More space around controls' },
    { value: 'compact', label: 'Compact', description: 'Fit more controls without tiny text' }
  ],
  normalize: normalizeDensity
} as const satisfies AppSettingDefinition<UiDensity>

const uiScaleDefinition = {
  key: 'uiScale',
  category: 'General',
  label: 'Interface scale',
  description: 'Scale application chrome without changing note reading zoom.',
  control: 'range',
  defaultValue: DEFAULT_UI_SCALE,
  searchTerms: ['scale', 'zoom', 'interface', 'controls', 'accessibility'],
  range: { min: MIN_UI_SCALE, max: MAX_UI_SCALE, step: 5 },
  normalize: normalizeUiScale
} as const satisfies AppSettingDefinition<number>

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

const showFileExtensionsDefinition = {
  key: 'showFileExtensions',
  category: 'General',
  label: 'Show file extensions',
  description: 'Show .mdx and .md in navigation; ambiguous siblings always show extensions.',
  control: 'toggle',
  defaultValue: false,
  searchTerms: ['files', 'extensions', 'explorer', 'tabs', 'breadcrumb'],
  normalize: normalizeBooleanWithDefault(false)
} as const satisfies AppSettingDefinition<boolean>

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

const editorFontFamilyDefinition = {
  key: 'editorFontFamily',
  category: 'Editor',
  label: 'Font family',
  description: 'Choose the monospace face used by Source view and editable code files.',
  control: 'choice',
  defaultValue: 'jetbrains-mono',
  searchTerms: [
    'source',
    'font',
    'family',
    'jetbrains mono',
    'maple mono',
    'ibm plex mono',
    'cascadia'
  ],
  options: [
    {
      value: 'jetbrains-mono',
      label: 'JetBrains Mono',
      description: 'Clear code and Vietnamese diacritics'
    },
    { value: 'maple-mono', label: 'Maple Mono', description: 'Distinct source-editing voice' },
    { value: 'ibm-plex-mono', label: 'IBM Plex Mono', description: 'Neutral instrument text' },
    { value: 'system-mono', label: 'System Mono', description: 'Use the platform code face' }
  ],
  normalize: normalizeEditorFontFamily
} as const satisfies AppSettingDefinition<EditorFontFamilySetting>

const editorFontWeightDefinition = {
  key: 'editorFontWeight',
  category: 'Editor',
  label: 'Font weight',
  description: 'Set the base stroke weight without making syntax tokens artificially bold.',
  control: 'choice',
  defaultValue: 'regular',
  searchTerms: ['source', 'font', 'weight', 'regular', 'medium'],
  options: [
    { value: 'regular', label: 'Regular', description: 'Crisp, quiet source texture' },
    { value: 'medium', label: 'Medium', description: 'Stronger strokes on dense displays' }
  ],
  normalize: normalizeEditorFontWeight
} as const satisfies AppSettingDefinition<EditorFontWeightSetting>

const editorLineHeightDefinition = {
  key: 'editorLineHeight',
  category: 'Editor',
  label: 'Line height',
  description: 'Tune vertical rhythm independently from the source font size.',
  control: 'range',
  defaultValue: 1.6,
  searchTerms: ['source', 'line', 'height', 'spacing', 'density'],
  range: { min: MIN_EDITOR_LINE_HEIGHT, max: MAX_EDITOR_LINE_HEIGHT, step: 0.05 },
  normalize: normalizeEditorLineHeight
} as const satisfies AppSettingDefinition<number>

const editorLigaturesDefinition = {
  key: 'editorLigatures',
  category: 'Editor',
  label: 'Font ligatures',
  description: 'Combine supported operator sequences such as arrows without changing source text.',
  control: 'toggle',
  defaultValue: true,
  searchTerms: ['source', 'font', 'ligatures', 'operators', 'maple'],
  normalize: normalizeBooleanWithDefault(true)
} as const satisfies AppSettingDefinition<boolean>

const editorTabSizeDefinition = {
  key: 'editorTabSize',
  category: 'Editor',
  label: 'Tab size',
  description: 'Choose the indentation width used for tabs and structural guides.',
  control: 'choice',
  defaultValue: '2',
  searchTerms: ['source', 'tab', 'indent', 'spaces', 'width'],
  options: [
    { value: '2', label: '2 spaces', description: 'Compact MDX and web source' },
    { value: '4', label: '4 spaces', description: 'Roomier code indentation' },
    { value: '8', label: '8 spaces', description: 'Traditional tab width' }
  ],
  normalize: normalizeEditorTabSize
} as const satisfies AppSettingDefinition<EditorTabSizeSetting>

const editorNoteWordWrapDefinition = {
  key: 'editorNoteWordWrap',
  category: 'Editor',
  label: 'Live note wrapping',
  description: 'Control prose-oriented soft wrapping in the Markdown and MDX Live editor.',
  control: 'choice',
  defaultValue: 'bounded',
  searchTerms: ['source', 'note', 'markdown', 'mdx', 'word wrap', 'column'],
  options: [
    { value: 'bounded', label: 'Preferred column', description: 'Wrap at the configured column' },
    { value: 'viewport', label: 'Viewport', description: 'Wrap at the visible editor edge' },
    { value: 'off', label: 'Off', description: 'Keep every source line unwrapped' }
  ],
  normalize: normalizeEditorWordWrap
} as const satisfies AppSettingDefinition<EditorWordWrapSetting>

const editorCodeWordWrapDefinition = {
  key: 'editorCodeWordWrap',
  category: 'Editor',
  label: 'Source and code wrapping',
  description: 'Control raw MDX Source plus HTML, TypeScript, JSON and other code buffers.',
  control: 'choice',
  defaultValue: 'off',
  searchTerms: ['source', 'code', 'html', 'typescript', 'word wrap', 'horizontal scroll'],
  options: [
    { value: 'off', label: 'Off', description: 'Preserve code shape and indentation' },
    { value: 'viewport', label: 'Viewport', description: 'Wrap at the visible editor edge' },
    { value: 'bounded', label: 'Preferred column', description: 'Wrap at the configured column' }
  ],
  normalize: normalizeEditorWordWrap
} as const satisfies AppSettingDefinition<EditorWordWrapSetting>

const editorWrapColumnDefinition = {
  key: 'editorWrapColumn',
  category: 'Editor',
  label: 'Preferred column',
  description: 'Set the shared wrap and ruler column for bounded source editing.',
  control: 'range',
  defaultValue: 88,
  searchTerms: ['source', 'wrap', 'ruler', 'column', 'line length'],
  range: { min: MIN_EDITOR_WRAP_COLUMN, max: MAX_EDITOR_WRAP_COLUMN, step: 4 },
  normalize: normalizeEditorWrapColumn
} as const satisfies AppSettingDefinition<number>

const editorIndentGuidesDefinition = {
  key: 'editorIndentGuides',
  category: 'Editor',
  label: 'Indent guides',
  description: 'Show quiet structural guides inside leading indentation.',
  control: 'toggle',
  defaultValue: true,
  searchTerms: ['source', 'indent', 'guides', 'structure', 'nesting'],
  normalize: normalizeBooleanWithDefault(true)
} as const satisfies AppSettingDefinition<boolean>

const editorWhitespaceDefinition = {
  key: 'editorWhitespace',
  category: 'Editor',
  label: 'Whitespace',
  description: 'Choose whether spaces and tabs are visible in Source view.',
  control: 'choice',
  defaultValue: 'none',
  searchTerms: ['source', 'whitespace', 'spaces', 'tabs', 'invisible'],
  options: [
    { value: 'none', label: 'Hidden', description: 'Keep the buffer visually quiet' },
    { value: 'all', label: 'Show all', description: 'Reveal spaces and tabs' }
  ],
  normalize: normalizeEditorWhitespace
} as const satisfies AppSettingDefinition<EditorWhitespaceSetting>

const editorRulerDefinition = {
  key: 'editorRuler',
  category: 'Editor',
  label: 'Column ruler',
  description: 'Show a subtle guide at the preferred source column.',
  control: 'toggle',
  defaultValue: true,
  searchTerms: ['source', 'ruler', 'column', 'line length', 'guide'],
  normalize: normalizeBooleanWithDefault(true)
} as const satisfies AppSettingDefinition<boolean>

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
  locale: localeDefinition,
  density: densityDefinition,
  uiScale: uiScaleDefinition,
  fileTreeSort: fileTreeSortDefinition,
  showFileExtensions: showFileExtensionsDefinition,
  defaultNoteView: defaultNoteViewDefinition,
  editorFontSize: editorFontSizeDefinition,
  editorFontFamily: editorFontFamilyDefinition,
  editorFontWeight: editorFontWeightDefinition,
  editorLineHeight: editorLineHeightDefinition,
  editorLigatures: editorLigaturesDefinition,
  editorTabSize: editorTabSizeDefinition,
  editorNoteWordWrap: editorNoteWordWrapDefinition,
  editorCodeWordWrap: editorCodeWordWrapDefinition,
  editorWrapColumn: editorWrapColumnDefinition,
  editorIndentGuides: editorIndentGuidesDefinition,
  editorWhitespace: editorWhitespaceDefinition,
  editorRuler: editorRulerDefinition,
  pagePreviewEnabled: pagePreviewEnabledDefinition,
  pagePreviewRequireModifier: pagePreviewRequireModifierDefinition,
  activateOnClose: activateOnCloseDefinition,
  whenClosingWithNoTabs: whenClosingWithNoTabsDefinition,
  keymapOverrides: keymapOverridesDefinition
} as const

export const APP_THEME_VALUES = choiceValues(APP_SETTINGS_CATALOG.theme.options)
export const APP_LOCALE_VALUES = choiceValues(APP_SETTINGS_CATALOG.locale.options)
export const UI_DENSITY_VALUES = choiceValues(APP_SETTINGS_CATALOG.density.options)
export const FILE_TREE_SORT_VALUES = choiceValues(APP_SETTINGS_CATALOG.fileTreeSort.options)
export const DEFAULT_NOTE_VIEW_VALUES = choiceValues(APP_SETTINGS_CATALOG.defaultNoteView.options)
export const EDITOR_FONT_FAMILY_VALUES = choiceValues(APP_SETTINGS_CATALOG.editorFontFamily.options)
export const EDITOR_FONT_WEIGHT_VALUES = choiceValues(APP_SETTINGS_CATALOG.editorFontWeight.options)
export const EDITOR_TAB_SIZE_VALUES = choiceValues(APP_SETTINGS_CATALOG.editorTabSize.options)
export const EDITOR_WORD_WRAP_VALUES = choiceValues(APP_SETTINGS_CATALOG.editorNoteWordWrap.options)
export const EDITOR_WHITESPACE_VALUES = choiceValues(APP_SETTINGS_CATALOG.editorWhitespace.options)
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
  version: 6,
  theme: APP_SETTINGS_CATALOG.theme.defaultValue,
  locale: APP_SETTINGS_CATALOG.locale.defaultValue,
  density: APP_SETTINGS_CATALOG.density.defaultValue,
  uiScale: APP_SETTINGS_CATALOG.uiScale.defaultValue,
  fileTreeSort: APP_SETTINGS_CATALOG.fileTreeSort.defaultValue,
  showFileExtensions: APP_SETTINGS_CATALOG.showFileExtensions.defaultValue,
  defaultNoteView: APP_SETTINGS_CATALOG.defaultNoteView.defaultValue,
  editorFontSize: APP_SETTINGS_CATALOG.editorFontSize.defaultValue,
  editorFontFamily: APP_SETTINGS_CATALOG.editorFontFamily.defaultValue,
  editorFontWeight: APP_SETTINGS_CATALOG.editorFontWeight.defaultValue,
  editorLineHeight: APP_SETTINGS_CATALOG.editorLineHeight.defaultValue,
  editorLigatures: APP_SETTINGS_CATALOG.editorLigatures.defaultValue,
  editorTabSize: APP_SETTINGS_CATALOG.editorTabSize.defaultValue,
  editorNoteWordWrap: APP_SETTINGS_CATALOG.editorNoteWordWrap.defaultValue,
  editorCodeWordWrap: APP_SETTINGS_CATALOG.editorCodeWordWrap.defaultValue,
  editorWrapColumn: APP_SETTINGS_CATALOG.editorWrapColumn.defaultValue,
  editorIndentGuides: APP_SETTINGS_CATALOG.editorIndentGuides.defaultValue,
  editorWhitespace: APP_SETTINGS_CATALOG.editorWhitespace.defaultValue,
  editorRuler: APP_SETTINGS_CATALOG.editorRuler.defaultValue,
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

export function normalizeLocale(value: unknown): AppLocale {
  return value === 'system' || value === 'en' || value === 'vi'
    ? value
    : APP_SETTINGS_CATALOG.locale.defaultValue
}

export function normalizeDensity(value: unknown): UiDensity {
  return value === 'comfortable' || value === 'compact'
    ? value
    : APP_SETTINGS_CATALOG.density.defaultValue
}

export function normalizeUiScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return APP_SETTINGS_CATALOG.uiScale.defaultValue
  }
  const { min, max, step } = APP_SETTINGS_CATALOG.uiScale.range
  const clamped = Math.min(max, Math.max(min, value))
  return Math.round(clamped / step) * step
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

export function normalizeEditorFontFamily(value: unknown): EditorFontFamilySetting {
  return value === 'jetbrains-mono' ||
    value === 'maple-mono' ||
    value === 'ibm-plex-mono' ||
    value === 'system-mono'
    ? value
    : APP_SETTINGS_CATALOG.editorFontFamily.defaultValue
}

export function normalizeEditorFontWeight(value: unknown): EditorFontWeightSetting {
  return value === 'regular' || value === 'medium'
    ? value
    : APP_SETTINGS_CATALOG.editorFontWeight.defaultValue
}

export function normalizeEditorLineHeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return APP_SETTINGS_CATALOG.editorLineHeight.defaultValue
  }
  const { min, max, step } = APP_SETTINGS_CATALOG.editorLineHeight.range
  const clamped = Math.min(max, Math.max(min, value))
  return Number((Math.round(clamped / step) * step).toFixed(2))
}

export function normalizeEditorTabSize(value: unknown): EditorTabSizeSetting {
  return value === '2' || value === '4' || value === '8'
    ? value
    : APP_SETTINGS_CATALOG.editorTabSize.defaultValue
}

export function normalizeEditorWordWrap(value: unknown): EditorWordWrapSetting {
  return value === 'off' || value === 'viewport' || value === 'bounded'
    ? value
    : APP_SETTINGS_CATALOG.editorNoteWordWrap.defaultValue
}

export function normalizeEditorWrapColumn(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return APP_SETTINGS_CATALOG.editorWrapColumn.defaultValue
  }
  const { min, max, step } = APP_SETTINGS_CATALOG.editorWrapColumn.range
  const clamped = Math.min(max, Math.max(min, value))
  return Math.round(clamped / step) * step
}

export function normalizeEditorWhitespace(value: unknown): EditorWhitespaceSetting {
  return value === 'none' || value === 'all'
    ? value
    : APP_SETTINGS_CATALOG.editorWhitespace.defaultValue
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
