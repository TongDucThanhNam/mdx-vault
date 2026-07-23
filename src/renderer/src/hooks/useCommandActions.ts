import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useMemo, useRef } from 'react'
import type { CommandAction, CommandActionRegistry } from '@/commands/actions'
import {
  createReadingZoomActionHandlers,
  type ReadingZoomActionHandlersInput
} from '@/commands/reading-zoom-actions'
import type { ViewMode } from '@/components/ViewModeToggle'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { WorkbenchController } from '@/hooks/useWorkbench'
import { formatError } from '@/lib/format-error'
import type { NoteTemplate, VaultInfo } from '@/vault/types'
import {
  formatKeyBinding,
  getEffectiveBindings,
  type KeymapOverrides
} from '../../../shared/keybindings'
import type { KnowledgePanelId } from '../../../shared/knowledge'
import {
  canonicalizeActionId,
  type KeybindingPlatform,
  resolveWorkspaceActionId,
  WORKSPACE_ACTION_DEFINITIONS,
  type WorkspaceActionId
} from '../../../shared/workspace-actions'

type RuntimeActionHandler = (input?: unknown) => unknown

interface UseCommandActionsOptions {
  vault: VaultInfo | null
  selectedPath: string | null
  indexNoteCount: number
  noteTemplates: NoteTemplate[]
  trashCount: number
  noteActions: NoteActionsController
  workbench: WorkbenchController
  keymapOverrides: KeymapOverrides
  openVault: () => Promise<void>
  toggleTheme: () => Promise<void>
  openCreateNote: () => void
  openFileFinder: () => void
  openCommandPalette: () => void
  openSearch: () => void
  openExport: () => void
  openSettings: () => void
  toggleAiPanel: () => void
  openEmptyTrash: () => void
  toggleLeftPanel: () => void
  toggleExplorerFocus: () => void
  showKnowledgePanel: (panel: KnowledgePanelId) => void
  addProperty: () => void
  focusEditor: () => void
  setViewMode: Dispatch<SetStateAction<ViewMode>>
  readingZoomEnabled: boolean
  readingZoomActions: ReadingZoomActionHandlersInput
  onError: (message: string | null) => void
}

export function useCommandActions({
  vault,
  selectedPath,
  indexNoteCount,
  noteTemplates,
  trashCount,
  noteActions,
  workbench,
  keymapOverrides,
  openVault,
  toggleTheme,
  openCreateNote,
  openFileFinder,
  openCommandPalette,
  openSearch,
  openExport,
  openSettings,
  toggleAiPanel,
  openEmptyTrash,
  toggleLeftPanel,
  toggleExplorerFocus,
  showKnowledgePanel,
  addProperty,
  focusEditor,
  setViewMode,
  readingZoomEnabled,
  readingZoomActions,
  onError
}: UseCommandActionsOptions): CommandActionRegistry {
  const platform = toKeybindingPlatform(window.windowApi.platform)
  const {
    zoomIn: zoomReadingIn,
    zoomOut: zoomReadingOut,
    reset: resetReadingZoom
  } = readingZoomActions
  const {
    createUniqueNote,
    insertCurrentDate,
    insertCurrentTime,
    insertTemplateAtCursor,
    openDailyNote,
    openRandomNote
  } = noteActions

  const handlers = useMemo<Readonly<Record<WorkspaceActionId, RuntimeActionHandler>>>(
    () => ({
      'note.new': openCreateNote,
      'note.new-template': openCreateNote,
      'note.daily': openDailyNote,
      'note.random': openRandomNote,
      'note.unique': createUniqueNote,
      'file.open': openFileFinder,
      'command-palette.toggle': openCommandPalette,
      'note.search': openSearch,
      'file.save': workbench.saveActiveItem,
      'workbench.close-item': (input) => {
        const targetedId = getTargetItemId(input)
        return targetedId ? workbench.closeItem(targetedId) : workbench.closeActiveItem()
      },
      'workbench.reopen-closed-item': workbench.reopenClosedItem,
      'workbench.mru-next': () => workbench.startMruSwitch(1),
      'workbench.mru-previous': () => workbench.startMruSwitch(-1),
      'workbench.next-item': () => workbench.activateVisual(1),
      'workbench.previous-item': () => workbench.activateVisual(-1),
      'workbench.focus-editor': focusEditor,
      'explorer.toggle-focus': toggleExplorerFocus,
      'view.toggle-left-panel': toggleLeftPanel,
      'panel.showOutline': () => showKnowledgePanel('outline'),
      'panel.showTags': () => showKnowledgePanel('tags'),
      'panel.showBacklinks': () => showKnowledgePanel('backlinks'),
      'panel.showOutgoingLinks': () => showKnowledgePanel('outgoing'),
      'panel.showProperties': () => showKnowledgePanel('properties'),
      'panel.showBookmarks': () => showKnowledgePanel('bookmarks'),
      'panel.showFootnotes': () => showKnowledgePanel('footnotes'),
      'property.add': addProperty,
      'insert.date': insertCurrentDate,
      'insert.time': insertCurrentTime,
      'view.source': () => setViewMode('source'),
      'view.live': () => setViewMode('live'),
      'view.reading': () => setViewMode('reading'),
      ...createReadingZoomActionHandlers({
        zoomIn: zoomReadingIn,
        zoomOut: zoomReadingOut,
        reset: resetReadingZoom
      }),
      'note.export': openExport,
      'ai.toggle': toggleAiPanel,
      'theme.toggle': toggleTheme,
      'settings.open': openSettings,
      'vault.open': openVault,
      'vault.empty-trash': openEmptyTrash
    }),
    [
      createUniqueNote,
      addProperty,
      focusEditor,
      insertCurrentDate,
      insertCurrentTime,
      openCommandPalette,
      openCreateNote,
      openDailyNote,
      openEmptyTrash,
      openExport,
      openFileFinder,
      openRandomNote,
      openSearch,
      openSettings,
      openVault,
      resetReadingZoom,
      setViewMode,
      toggleAiPanel,
      toggleExplorerFocus,
      toggleLeftPanel,
      showKnowledgePanel,
      toggleTheme,
      zoomReadingIn,
      zoomReadingOut,
      workbench.activateVisual,
      workbench.closeActiveItem,
      workbench.closeItem,
      workbench.reopenClosedItem,
      workbench.saveActiveItem,
      workbench.startMruSwitch
    ]
  )

  const enabled = useMemo<Readonly<Record<WorkspaceActionId, boolean>>>(() => {
    const hasVault = vault !== null
    const hasNote = selectedPath !== null
    const hasActiveItem = workbench.activeItem !== null
    const activeEditable =
      workbench.activeItem?.kind === 'note' || workbench.activeItem?.kind === 'text'
    const hasSeveralItems = workbench.tabs.length > 1

    return {
      'note.new': hasVault,
      'note.new-template': hasVault,
      'note.daily': hasVault,
      'note.random': hasVault && indexNoteCount > 0,
      'note.unique': hasVault,
      'file.open': hasVault,
      'command-palette.toggle': true,
      'note.search': hasVault,
      'file.save': activeEditable,
      'workbench.close-item': true,
      'workbench.reopen-closed-item': workbench.state.closedIds.length > 0,
      'workbench.mru-next': hasSeveralItems,
      'workbench.mru-previous': hasSeveralItems,
      'workbench.next-item': hasSeveralItems,
      'workbench.previous-item': hasSeveralItems,
      'workbench.focus-editor': hasActiveItem,
      'explorer.toggle-focus': hasVault,
      'view.toggle-left-panel': true,
      'panel.showOutline': hasVault,
      'panel.showTags': hasVault,
      'panel.showBacklinks': hasNote,
      'panel.showOutgoingLinks': hasNote,
      'panel.showProperties': hasNote,
      'panel.showBookmarks': hasVault,
      'panel.showFootnotes': hasNote,
      'property.add': hasNote,
      'insert.date': hasNote,
      'insert.time': hasNote,
      'view.source': hasNote,
      'view.live': hasNote,
      'view.reading': hasNote,
      'view.zoom-in': readingZoomEnabled,
      'view.zoom-out': readingZoomEnabled,
      'view.zoom-reset': readingZoomEnabled,
      'note.export': hasNote,
      'ai.toggle': hasVault,
      'theme.toggle': true,
      'settings.open': true,
      'vault.open': true,
      'vault.empty-trash': hasVault && trashCount > 0
    }
  }, [
    indexNoteCount,
    readingZoomEnabled,
    selectedPath,
    trashCount,
    vault,
    workbench.activeItem,
    workbench.state.closedIds.length,
    workbench.tabs.length
  ])

  const dynamicHandlers = useMemo(() => {
    return new Map<string, RuntimeActionHandler>(
      noteTemplates.map((template) => [
        `template.insert:${template.relativePath}`,
        () => insertTemplateAtCursor(template)
      ])
    )
  }, [insertTemplateAtCursor, noteTemplates])

  const handlersRef = useRef(handlers)
  const enabledRef = useRef(enabled)
  const dynamicHandlersRef = useRef(dynamicHandlers)
  handlersRef.current = handlers
  enabledRef.current = enabled
  dynamicHandlersRef.current = dynamicHandlers

  const dispatch = useCallback(
    async (actionId: string, input?: unknown): Promise<boolean> => {
      const canonicalId = canonicalizeActionId(actionId)
      const stableActionId = resolveWorkspaceActionId(canonicalId)
      const stableHandler = stableActionId ? handlersRef.current[stableActionId] : undefined
      const dynamicHandler = dynamicHandlersRef.current.get(canonicalId)

      if (stableActionId && !enabledRef.current[stableActionId]) {
        return false
      }

      const handler = stableHandler ?? dynamicHandler
      if (!handler) {
        return false
      }

      try {
        return (await handler(input)) !== false
      } catch (actionError) {
        onError(formatError(actionError))
        return false
      }
    },
    [onError]
  )

  const actions = useMemo<CommandAction[]>(() => {
    const stableActions = WORKSPACE_ACTION_DEFINITIONS.filter(
      (definition) => definition.paletteVisible
    ).map((definition): CommandAction => {
      const bindings = getEffectiveBindings(definition.id, platform, keymapOverrides)
      const hotkeys = bindings
        .map((binding) => formatKeyBinding(binding, platform))
        .filter((binding): binding is string => binding !== null)

      return {
        id: definition.id,
        stableActionId: definition.id,
        title: definition.title,
        description: definition.description,
        category: definition.category,
        keywords: [...definition.keywords],
        bindings,
        hotkeys,
        context: definition.context,
        disabled: !enabled[definition.id],
        run: (input) => dispatch(definition.id, input)
      }
    })

    const templateActions = noteTemplates.map(
      (template): CommandAction => ({
        id: `template.insert:${template.relativePath}`,
        title: `Insert template: ${template.name}`,
        description: `Insert ${template.relativePath} at the editor cursor.`,
        category: 'Templates',
        keywords: ['insert', 'template', template.name, template.relativePath],
        disabled: selectedPath === null,
        run: () => dispatch(`template.insert:${template.relativePath}`)
      })
    )

    return [...stableActions, ...templateActions]
  }, [dispatch, enabled, keymapOverrides, noteTemplates, platform, selectedPath])

  const actionsById = useMemo(
    () => new Map(actions.map((action) => [action.id, action])),
    [actions]
  )
  const actionsByIdRef = useRef(actionsById)
  actionsByIdRef.current = actionsById

  const getAction = useCallback(
    (actionId: string): CommandAction | undefined =>
      actionsByIdRef.current.get(canonicalizeActionId(actionId)),
    []
  )

  const isEnabled = useCallback(
    (actionId: WorkspaceActionId): boolean => enabledRef.current[actionId],
    []
  )

  return { actions, dispatch, isEnabled, getAction }
}

function getTargetItemId(input: unknown): string | null {
  if (!input || typeof input !== 'object' || !('id' in input)) {
    return null
  }

  return typeof input.id === 'string' ? input.id : null
}

function toKeybindingPlatform(platform: typeof window.windowApi.platform): KeybindingPlatform {
  return platform === 'darwin' || platform === 'win32' ? platform : 'linux'
}
