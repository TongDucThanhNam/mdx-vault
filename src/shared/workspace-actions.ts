/**
 * Framework-free metadata for application-level workbench actions.
 *
 * Runtime handlers deliberately live in the renderer. Main-process settings
 * normalization, shortcut dispatch, menus, the command palette, and Settings
 * can all consume this stable catalog without importing React or Electron.
 */

export const SUPPORTED_KEYBINDING_PLATFORMS = ['win32', 'linux', 'darwin'] as const

export type KeybindingPlatform = (typeof SUPPORTED_KEYBINDING_PLATFORMS)[number]

/** A normalized, single-keystroke logical chord such as `Mod+Shift+P`. */
export type KeyBinding = string

export const ACTION_CONTEXTS = [
  'Workspace',
  'Editor',
  'Reading',
  'Explorer',
  'Input',
  'Picker',
  'Settings',
  'Dialog',
  'KeyRecorder'
] as const

export type ActionContext = (typeof ACTION_CONTEXTS)[number]

/**
 * Smaller values are more specific. The resolver uses this only after an
 * action is known to be valid in the active context stack.
 */
export const ACTION_CONTEXT_PRECEDENCE: Readonly<Record<ActionContext, number>> = {
  KeyRecorder: 0,
  Dialog: 10,
  Picker: 20,
  Settings: 20,
  Input: 30,
  Editor: 40,
  Reading: 40,
  Explorer: 40,
  Workspace: 100
}

export interface PlatformDefaultBindings {
  readonly win32: readonly KeyBinding[]
  readonly linux: readonly KeyBinding[]
  readonly darwin: readonly KeyBinding[]
}

export interface WorkspaceActionDefinition {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly category: string
  readonly keywords: readonly string[]
  readonly context: ActionContext
  readonly defaultBindings: PlatformDefaultBindings
  /** Whether holding a chord may dispatch repeated keydown events. */
  readonly allowRepeat: boolean
  /** Dynamic instance actions are intentionally absent from this catalog. */
  readonly keybindable: true
  readonly paletteVisible: boolean
}

function bindings(
  windowsAndLinux: readonly KeyBinding[] = [],
  darwin: readonly KeyBinding[] = windowsAndLinux
): PlatformDefaultBindings {
  return {
    win32: windowsAndLinux,
    linux: windowsAndLinux,
    darwin
  }
}

type WorkspaceActionDefinitionInput = Omit<
  WorkspaceActionDefinition,
  'allowRepeat' | 'keybindable' | 'keywords' | 'paletteVisible'
> &
  Partial<Pick<WorkspaceActionDefinition, 'allowRepeat' | 'keywords' | 'paletteVisible'>>

function action<const TDefinition extends WorkspaceActionDefinitionInput>(
  definition: TDefinition
): TDefinition &
  Pick<WorkspaceActionDefinition, 'allowRepeat' | 'keybindable' | 'keywords' | 'paletteVisible'> {
  return {
    ...definition,
    allowRepeat: definition.allowRepeat ?? false,
    keybindable: true,
    keywords: definition.keywords ?? [],
    paletteVisible: definition.paletteVisible ?? true
  } as TDefinition &
    Pick<WorkspaceActionDefinition, 'allowRepeat' | 'keybindable' | 'keywords' | 'paletteVisible'>
}

/**
 * Stable actions only. Template-instance actions such as
 * `template.insert:<path>` remain renderer-owned and non-keybindable.
 */
export const WORKSPACE_ACTION_DEFINITIONS = [
  action({
    id: 'note.new',
    title: 'New note',
    description: 'Create a blank MDX note.',
    category: 'Notes',
    keywords: ['create', 'file'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+N'])
  }),
  action({
    id: 'note.new-template',
    title: 'New note from template',
    description: 'Create a note and choose a vault template.',
    category: 'Notes',
    keywords: ['create', 'insert', 'template'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'note.daily',
    title: "Open today's daily note",
    description: 'Open or create the journal note for today.',
    category: 'Notes',
    keywords: ['journal', 'today'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'note.random',
    title: 'Open random note',
    description: 'Open a random indexed note from this vault.',
    category: 'Notes',
    keywords: ['shuffle'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'note.unique',
    title: 'Create unique note',
    description: 'Create a timestamp-prefixed MDX note.',
    category: 'Notes',
    keywords: ['zettelkasten', 'timestamp'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'file.open',
    title: 'Open file',
    description: 'Find and open any visible file in the current vault.',
    category: 'Navigation',
    keywords: ['file finder', 'quick open', 'quick switcher', 'note'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+P'])
  }),
  action({
    id: 'command-palette.toggle',
    title: 'Command palette',
    description: 'Find and run an application action.',
    category: 'Navigation',
    keywords: ['actions', 'commands'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+Shift+P', 'F1'], ['Mod+Shift+P'])
  }),
  action({
    id: 'note.search',
    title: 'Project search',
    description: 'Search indexed note content in the current vault.',
    category: 'Navigation',
    keywords: ['find', 'search notes'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+Shift+F'])
  }),
  action({
    id: 'file.save',
    title: 'Save active item',
    description: 'Save the active item when it supports editing.',
    category: 'File',
    keywords: ['write', 'persist'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+S'])
  }),
  action({
    id: 'workbench.close-item',
    title: 'Close active item',
    description: 'Safely close the active workbench item.',
    category: 'Workbench',
    keywords: ['tab', 'document'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+W', 'Ctrl+F4'], ['Mod+W'])
  }),
  action({
    id: 'workbench.reopen-closed-item',
    title: 'Reopen closed item',
    description: 'Reopen the most recently closed existing item.',
    category: 'Workbench',
    keywords: ['restore', 'tab'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+Shift+T'])
  }),
  action({
    id: 'workbench.mru-next',
    title: 'Next recently used item',
    description: 'Move forward through the most-recently-used item switcher.',
    category: 'Workbench',
    keywords: ['tab', 'switcher', 'recent'],
    context: 'Workspace',
    defaultBindings: bindings(['Ctrl+Tab']),
    allowRepeat: true
  }),
  action({
    id: 'workbench.mru-previous',
    title: 'Previous recently used item',
    description: 'Move backward through the most-recently-used item switcher.',
    category: 'Workbench',
    keywords: ['tab', 'switcher', 'recent'],
    context: 'Workspace',
    defaultBindings: bindings(['Ctrl+Shift+Tab']),
    allowRepeat: true
  }),
  action({
    id: 'workbench.next-item',
    title: 'Next tab',
    description: 'Activate the next item in visual tab order.',
    category: 'Workbench',
    keywords: ['tab', 'visual order'],
    context: 'Workspace',
    defaultBindings: bindings(['Ctrl+PageDown'], ['Mod+}']),
    allowRepeat: true
  }),
  action({
    id: 'workbench.previous-item',
    title: 'Previous tab',
    description: 'Activate the previous item in visual tab order.',
    category: 'Workbench',
    keywords: ['tab', 'visual order'],
    context: 'Workspace',
    defaultBindings: bindings(['Ctrl+PageUp'], ['Mod+{']),
    allowRepeat: true
  }),
  action({
    id: 'workbench.focus-editor',
    title: 'Focus editor',
    description: 'Move focus to the active editor or document surface.',
    category: 'Workbench',
    keywords: ['document', 'writing'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'graph.open-global',
    title: 'Open Graph view',
    description: 'Open the vault-wide note graph as a workbench item.',
    category: 'Graph',
    keywords: ['network', 'links', 'vault'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'graph.fit-view',
    title: 'Graph: Fit view',
    description: 'Fit the visible graph topology within its viewport.',
    category: 'Graph',
    keywords: ['center', 'zoom', 'canvas'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'graph.toggle-settings',
    title: 'Graph: Toggle settings',
    description: 'Open or close settings for the visible graph.',
    category: 'Graph',
    keywords: ['filters', 'groups', 'forces'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'explorer.toggle-focus',
    title: 'Explorer: Toggle focus',
    description: 'Show or focus the Explorer, or return focus to the active document.',
    category: 'Navigation',
    keywords: ['files', 'project panel', 'sidebar'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+Shift+E'])
  }),
  action({
    id: 'view.toggle-left-panel',
    title: 'View: Toggle left panel',
    description: 'Show or hide the left panel without changing the active item.',
    category: 'View',
    keywords: ['explorer', 'sidebar'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+B'])
  }),
  action({
    id: 'panel.showOutline',
    title: 'Context: Open Outline',
    description: 'Show the current note outline in the context panel.',
    category: 'Context',
    keywords: ['sidebar', 'headings', 'navigation'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'panel.showTags',
    title: 'Context: Open Tags',
    description: 'Show vault tags in the context panel.',
    category: 'Context',
    keywords: ['sidebar', 'metadata'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'panel.showBacklinks',
    title: 'Context: Open Backlinks',
    description: 'Show linked and unlinked backlinks for the current note.',
    category: 'Context',
    keywords: ['sidebar', 'incoming links', 'mentions'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'panel.showOutgoingLinks',
    title: 'Context: Open Outgoing Links',
    description: 'Show outgoing links and unlinked mentions for the current note.',
    category: 'Context',
    keywords: ['sidebar', 'links', 'mentions'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'panel.showProperties',
    title: 'Context: Open Properties',
    description: 'Show file and vault properties in the context panel.',
    category: 'Context',
    keywords: ['sidebar', 'frontmatter', 'metadata'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'panel.showBookmarks',
    title: 'Context: Open Bookmarks',
    description: 'Show durable vault bookmarks in the context panel.',
    category: 'Context',
    keywords: ['sidebar', 'saved', 'favorites'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'panel.showFootnotes',
    title: 'Context: Open Footnotes',
    description: 'Show definitions and references for the current note.',
    category: 'Context',
    keywords: ['sidebar', 'references', 'citations'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'panel.showLocalGraph',
    title: 'Context: Open Local Graph',
    description: 'Show the local note graph in the context panel.',
    category: 'Context',
    keywords: ['sidebar', 'links', 'network', 'neighbors'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'property.add',
    title: 'Add property',
    description: 'Add a source-preserving property to the current note.',
    category: 'Properties',
    keywords: ['frontmatter', 'metadata', 'field'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'insert.date',
    title: 'Insert current date',
    description: 'Insert today at the editor cursor.',
    category: 'Insert',
    keywords: ['template', 'today'],
    context: 'Editor',
    defaultBindings: bindings()
  }),
  action({
    id: 'insert.time',
    title: 'Insert current time',
    description: 'Insert the current local time at the editor cursor.',
    category: 'Insert',
    keywords: ['template', 'clock'],
    context: 'Editor',
    defaultBindings: bindings()
  }),
  action({
    id: 'view.source',
    title: 'Source view',
    description: 'Show the MDX editor only.',
    category: 'View',
    keywords: ['editor'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'view.live',
    title: 'Live Preview view',
    description: 'Show Markdown with inline formatting in the editor.',
    category: 'View',
    keywords: ['editor', 'preview'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'view.reading',
    title: 'Reading view',
    description: 'Show the rendered note for reading.',
    category: 'View',
    keywords: ['rendered'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'view.zoom-in',
    title: 'Reading view: Zoom in',
    description: 'Increase the Reading view zoom level.',
    category: 'View',
    keywords: ['preview', 'reading', 'scale'],
    context: 'Reading',
    defaultBindings: bindings(
      ['Mod+=', 'Mod+Plus', 'Cmd+=', 'Cmd+Plus'],
      ['Mod+=', 'Mod+Plus', 'Ctrl+=', 'Ctrl+Plus']
    ),
    allowRepeat: true
  }),
  action({
    id: 'view.zoom-out',
    title: 'Reading view: Zoom out',
    description: 'Decrease the Reading view zoom level.',
    category: 'View',
    keywords: ['preview', 'reading', 'scale'],
    context: 'Reading',
    defaultBindings: bindings(
      ['Mod+-', 'Mod+_', 'Cmd+-', 'Cmd+_'],
      ['Mod+-', 'Mod+_', 'Ctrl+-', 'Ctrl+_']
    ),
    allowRepeat: true
  }),
  action({
    id: 'view.zoom-reset',
    title: 'Reading view: Reset zoom',
    description: 'Reset the Reading view zoom level to 100%.',
    category: 'View',
    keywords: ['preview', 'reading', 'scale', '100%'],
    context: 'Reading',
    defaultBindings: bindings(['Mod+0', 'Cmd+0'], ['Mod+0', 'Ctrl+0']),
    allowRepeat: true
  }),
  action({
    id: 'note.export',
    title: 'Export current note',
    description: 'Open export options for the selected note.',
    category: 'Notes',
    keywords: ['static', 'html', 'snapshot'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'ai.toggle',
    title: 'Toggle AI assistant',
    description: 'Show or hide the assistant panel.',
    category: 'AI',
    keywords: ['assistant'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+Shift+A'])
  }),
  action({
    id: 'theme.toggle',
    title: 'Toggle theme',
    description: 'Switch between light and dark appearance.',
    category: 'App',
    keywords: ['dark', 'light'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'settings.open',
    title: 'Open Settings',
    description: 'Configure application, editor, workbench, and AI preferences.',
    category: 'App',
    keywords: ['preferences', 'configuration', 'keymap'],
    context: 'Workspace',
    defaultBindings: bindings(['Mod+,'])
  }),
  action({
    id: 'vault.open',
    title: 'Open vault',
    description: 'Choose a vault folder from disk.',
    category: 'Vault',
    keywords: ['folder', 'workspace'],
    context: 'Workspace',
    defaultBindings: bindings()
  }),
  action({
    id: 'vault.empty-trash',
    title: 'Empty trash',
    description: 'Permanently remove notes currently in trash.',
    category: 'Vault',
    keywords: ['delete', 'remove'],
    context: 'Workspace',
    defaultBindings: bindings()
  })
] as const satisfies readonly WorkspaceActionDefinition[]

export type WorkspaceActionId = (typeof WORKSPACE_ACTION_DEFINITIONS)[number]['id']

export const KEYBINDABLE_ACTION_IDS = WORKSPACE_ACTION_DEFINITIONS.map(
  (definition) => definition.id
) as readonly WorkspaceActionId[]

const WORKSPACE_ACTION_ID_SET: ReadonlySet<string> = new Set(KEYBINDABLE_ACTION_IDS)

const DEFINITIONS_BY_ID: ReadonlyMap<WorkspaceActionId, WorkspaceActionDefinition> = new Map(
  WORKSPACE_ACTION_DEFINITIONS.map((definition) => [definition.id, definition])
)

/** IDs persisted by earlier command-palette builds. */
export const ACTION_ID_ALIASES: Readonly<Record<string, WorkspaceActionId>> = {
  'note.open': 'file.open'
}

export function canonicalizeActionId(actionId: string): string {
  return ACTION_ID_ALIASES[actionId] ?? actionId
}

export function isWorkspaceActionId(actionId: string): actionId is WorkspaceActionId {
  return WORKSPACE_ACTION_ID_SET.has(actionId)
}

/** Alias used by persistence code that talks in terms of stable action IDs. */
export const isStableActionId = isWorkspaceActionId

export function resolveWorkspaceActionId(actionId: string): WorkspaceActionId | null {
  const canonicalId = canonicalizeActionId(actionId)
  return isWorkspaceActionId(canonicalId) ? canonicalId : null
}

export function getWorkspaceActionDefinition(
  actionId: string
): WorkspaceActionDefinition | undefined {
  const canonicalId = resolveWorkspaceActionId(actionId)
  return canonicalId ? DEFINITIONS_BY_ID.get(canonicalId) : undefined
}

export function getDefaultBindings(
  actionId: string,
  platform: KeybindingPlatform
): readonly KeyBinding[] {
  return getWorkspaceActionDefinition(actionId)?.defaultBindings[platform] ?? []
}
