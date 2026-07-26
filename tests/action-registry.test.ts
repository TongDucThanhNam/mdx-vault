import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createReadingZoomActionHandlers,
  isReadingZoomActionEnabled
} from '../src/renderer/src/commands/reading-zoom-actions'
import {
  actionContextsOverlap,
  formatKeyBinding,
  getKeyBindingSignature,
  getReservedKeyBindingReason,
  normalizeKeyBinding
} from '../src/shared/keybindings'
import {
  ACTION_CONTEXTS,
  ACTION_ID_ALIASES,
  canonicalizeActionId,
  getDefaultBindings,
  getWorkspaceActionDefinition,
  isStableActionId,
  KEYBINDABLE_ACTION_IDS,
  resolveWorkspaceActionId,
  SUPPORTED_KEYBINDING_PLATFORMS,
  WORKSPACE_ACTION_DEFINITIONS
} from '../src/shared/workspace-actions'

const REQUIRED_EXISTING_IDS = [
  'note.new',
  'note.new-template',
  'interactive.create',
  'note.daily',
  'note.random',
  'note.unique',
  'note.search',
  'insert.date',
  'insert.time',
  'view.source',
  'view.live',
  'view.reading',
  'note.export',
  'ai.toggle',
  'theme.toggle',
  'settings.open',
  'vault.open',
  'vault.empty-trash'
] as const

const REQUIRED_WORKBENCH_IDS = [
  'file.open',
  'command-palette.toggle',
  'file.save',
  'workbench.close-item',
  'workbench.reopen-closed-item',
  'workbench.mru-next',
  'workbench.mru-previous',
  'workbench.next-item',
  'workbench.previous-item',
  'workbench.focus-editor',
  'explorer.toggle-focus',
  'view.toggle-left-panel'
] as const

const REQUIRED_READING_ZOOM_IDS = ['view.zoom-in', 'view.zoom-out', 'view.zoom-reset'] as const
const REQUIRED_GRAPH_IDS = [
  'graph.open-global',
  'graph.fit-view',
  'graph.toggle-settings',
  'panel.showLocalGraph'
] as const
const REQUIRED_KNOWLEDGE_PANEL_IDS = [
  'panel.showOutline',
  'panel.showTags',
  'panel.showBacklinks',
  'panel.showOutgoingLinks',
  'panel.showProperties',
  'panel.showBookmarks',
  'panel.showFootnotes',
  'property.add'
] as const

describe('workspace action registry', () => {
  test('defines every stable ID exactly once and preserves existing actions', () => {
    const ids = WORKSPACE_ACTION_DEFINITIONS.map((definition) => definition.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(KEYBINDABLE_ACTION_IDS).toEqual(ids)

    for (const id of [
      ...REQUIRED_EXISTING_IDS,
      ...REQUIRED_WORKBENCH_IDS,
      ...REQUIRED_READING_ZOOM_IDS,
      ...REQUIRED_GRAPH_IDS,
      ...REQUIRED_KNOWLEDGE_PANEL_IDS
    ]) {
      expect(ids).toContain(id)
      expect(isStableActionId(id)).toBe(true)
      expect(getWorkspaceActionDefinition(id)?.id).toBe(id)
    }

    for (const definition of WORKSPACE_ACTION_DEFINITIONS) {
      expect(ACTION_CONTEXTS).toContain(definition.context)
      expect(definition.title.length).toBeGreaterThan(0)
      expect(definition.description.length).toBeGreaterThan(0)
      expect(definition.category.length).toBeGreaterThan(0)
      expect(definition.keybindable).toBe(true)
    }
  })

  test('migrates the legacy note finder ID without changing unknown IDs', () => {
    expect(ACTION_ID_ALIASES['note.open']).toBe('file.open')
    expect(canonicalizeActionId('note.open')).toBe('file.open')
    expect(resolveWorkspaceActionId('note.open')).toBe('file.open')
    expect(getWorkspaceActionDefinition('note.open')?.id).toBe('file.open')
    expect(canonicalizeActionId('plugin.unknown')).toBe('plugin.unknown')
    expect(resolveWorkspaceActionId('plugin.unknown')).toBeNull()
  })

  test('publishes the required Windows/Linux and macOS baseline defaults', () => {
    const expected = {
      'file.open': [['Mod+P'], ['Mod+P']],
      'command-palette.toggle': [['Mod+Shift+P', 'F1'], ['Mod+Shift+P']],
      'workbench.close-item': [['Mod+W', 'Ctrl+F4'], ['Mod+W']],
      'workbench.mru-next': [['Ctrl+Tab'], ['Ctrl+Tab']],
      'workbench.mru-previous': [['Ctrl+Shift+Tab'], ['Ctrl+Shift+Tab']],
      'workbench.next-item': [['Ctrl+PageDown'], ['Mod+}']],
      'workbench.previous-item': [['Ctrl+PageUp'], ['Mod+{']],
      'workbench.reopen-closed-item': [['Mod+Shift+T'], ['Mod+Shift+T']],
      'explorer.toggle-focus': [['Mod+Shift+E'], ['Mod+Shift+E']],
      'view.toggle-left-panel': [['Mod+B'], ['Mod+B']],
      'file.save': [['Mod+S'], ['Mod+S']],
      'note.search': [['Mod+Shift+F'], ['Mod+Shift+F']],
      'note.new': [['Mod+N'], ['Mod+N']],
      'settings.open': [['Mod+,'], ['Mod+,']],
      'view.zoom-in': [
        ['Mod+=', 'Mod+Plus', 'Cmd+=', 'Cmd+Plus'],
        ['Mod+=', 'Mod+Plus', 'Ctrl+=', 'Ctrl+Plus']
      ],
      'view.zoom-out': [
        ['Mod+-', 'Mod+_', 'Cmd+-', 'Cmd+_'],
        ['Mod+-', 'Mod+_', 'Ctrl+-', 'Ctrl+_']
      ],
      'view.zoom-reset': [
        ['Mod+0', 'Cmd+0'],
        ['Mod+0', 'Ctrl+0']
      ]
    } as const

    for (const [id, [windows, darwin]] of Object.entries(expected)) {
      expect(getDefaultBindings(id, 'win32')).toEqual(windows)
      expect(getDefaultBindings(id, 'linux')).toEqual(windows)
      expect(getDefaultBindings(id, 'darwin')).toEqual(darwin)
    }

    expect(formatKeyBinding('Mod+P', 'win32')).toBe('Ctrl+P')
    expect(formatKeyBinding('Mod+P', 'darwin')).toBe('Cmd+P')
    expect(formatKeyBinding('Mod+}', 'darwin')).toBe('Cmd+}')
  })

  test('removes the two conflicting legacy global defaults', () => {
    expect(getDefaultBindings('view.live', 'win32')).toEqual([])
    expect(getDefaultBindings('note.export', 'win32')).toEqual([])
    expect(getDefaultBindings('explorer.toggle-focus', 'win32')).toEqual(['Mod+Shift+E'])

    const allWindowsDefaults = WORKSPACE_ACTION_DEFINITIONS.flatMap((definition) =>
      getDefaultBindings(definition.id, 'win32')
    )
    expect(allWindowsDefaults).not.toContain('Mod+Shift+V')
  })

  test('keeps all defaults normalized, dispatchable, and collision-free', () => {
    for (const platform of SUPPORTED_KEYBINDING_PLATFORMS) {
      const seen: Array<{
        actionId: string
        context: (typeof WORKSPACE_ACTION_DEFINITIONS)[number]['context']
        signature: string
      }> = []

      for (const definition of WORKSPACE_ACTION_DEFINITIONS) {
        for (const binding of getDefaultBindings(definition.id, platform)) {
          const normalized = normalizeKeyBinding(binding)
          expect(normalized).toEqual({ ok: true, binding })
          expect(getReservedKeyBindingReason(binding, platform, definition.id)).toBeNull()
          const signature = getKeyBindingSignature(binding, platform)
          expect(signature).not.toBeNull()

          const collision = seen.find(
            (candidate) =>
              candidate.signature === signature &&
              actionContextsOverlap(candidate.context, definition.context)
          )
          expect(collision).toBeUndefined()
          seen.push({ actionId: definition.id, context: definition.context, signature: signature! })
        }
      }
    }
  })

  test('marks all required direct workbench controls as palette-visible', () => {
    const paletteIds = WORKSPACE_ACTION_DEFINITIONS.filter(
      (definition) => definition.paletteVisible
    ).map((definition) => definition.id)

    for (const id of [
      'workbench.focus-editor',
      'workbench.close-item',
      'workbench.next-item',
      'workbench.previous-item',
      'workbench.reopen-closed-item',
      'explorer.toggle-focus',
      'view.toggle-left-panel',
      ...REQUIRED_READING_ZOOM_IDS,
      ...REQUIRED_GRAPH_IDS,
      ...REQUIRED_KNOWLEDGE_PANEL_IDS
    ]) {
      expect(paletteIds).toContain(id)
    }
  })

  test('routes every Reading zoom action ID to its runtime handler', () => {
    const calls: string[] = []
    const handlers = createReadingZoomActionHandlers({
      zoomIn: () => calls.push('in'),
      zoomOut: () => calls.push('out'),
      reset: () => calls.push('reset')
    })

    expect(Object.keys(handlers)).toEqual(REQUIRED_READING_ZOOM_IDS)
    handlers['view.zoom-in']()
    handlers['view.zoom-out']()
    handlers['view.zoom-reset']()
    expect(calls).toEqual(['in', 'out', 'reset'])
  })

  test('enables Reading zoom only for an active note in Reading view', () => {
    expect(isReadingZoomActionEnabled('notes/active.mdx', 'reading')).toBe(true)
    expect(isReadingZoomActionEnabled('notes/active.mdx', 'source')).toBe(false)
    expect(isReadingZoomActionEnabled('notes/active.mdx', 'live')).toBe(false)
    expect(isReadingZoomActionEnabled(null, 'reading')).toBe(false)

    for (const id of REQUIRED_READING_ZOOM_IDS) {
      expect(getWorkspaceActionDefinition(id)).toMatchObject({
        context: 'Reading',
        allowRepeat: true
      })
    }
  })

  test('keeps one global keydown resolver with no standalone Reading zoom list', () => {
    const shortcutSource = readFileSync(
      fileURLToPath(new URL('../src/renderer/src/hooks/useKeyboardShortcuts.ts', import.meta.url)),
      'utf8'
    )
    const commandActionSource = readFileSync(
      fileURLToPath(new URL('../src/renderer/src/hooks/useCommandActions.ts', import.meta.url)),
      'utf8'
    )

    expect(shortcutSource.match(/window\.addEventListener\(['"]keydown['"]/g) ?? []).toHaveLength(1)
    expect(shortcutSource).not.toContain('useReadingZoomShortcuts')
    expect(commandActionSource).toContain('...createReadingZoomActionHandlers')
  })
})
