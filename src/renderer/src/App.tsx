import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { CommandPalette } from '@/commands/CommandPalette'
import { isReadingFullViewActionEnabled } from '@/commands/reading-full-view-action'
import { isReadingZoomActionEnabled } from '@/commands/reading-zoom-actions'
import { AppLayout } from '@/components/AppLayout'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MruTabSwitcher } from '@/components/layout/MruTabSwitcher'
import { ToastView } from '@/components/ToastView'
import type { ViewMode } from '@/components/ViewModeToggle'
import { SourceEditorPreferencesProvider } from '@/editor/editor-preferences'
import { CreateNoteDialog } from '@/explorer/CreateNoteDialog'
import { QuickSwitcher } from '@/explorer/QuickSwitcher'
import { ExportDialog } from '@/export/ExportDialog'
import { dispatchGraphSurfaceCommand } from '@/graph/graph-commands'
import { DEFAULT_APP_SETTINGS_SNAPSHOT, useAppSettings } from '@/hooks/useAppSettings'
import { useCommandActions } from '@/hooks/useCommandActions'
import { useEditorInteractions } from '@/hooks/useEditorInteractions'
import { useGlobalSurface } from '@/hooks/useGlobalSurface'
import { useInteractiveAuthoring } from '@/hooks/useInteractiveAuthoring'
import { useInterfacePreferences } from '@/hooks/useInterfacePreferences'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useKnowledgeUtilities } from '@/hooks/useKnowledgeUtilities'
import { useNoteActions } from '@/hooks/useNoteActions'
import { useNoteEditor } from '@/hooks/useNoteEditor'
import { useNoteIndex } from '@/hooks/useNoteIndex'
import { useReadingZoom } from '@/hooks/useReadingZoom'
import { useRecentNotes } from '@/hooks/useRecentNotes'
import { useTextFileEditor } from '@/hooks/useTextFileEditor'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/useToast'
import { useVaultSession } from '@/hooks/useVaultSession'
import { useWorkbench } from '@/hooks/useWorkbench'
import { I18nProvider } from '@/i18n/I18nProvider'
import { CreateInteractiveDialog } from '@/interactive/CreateInteractiveDialog'
import { deriveNoteTitle } from '@/lib/note-title'
import { PagePreviewSettingsProvider } from '@/preview/PagePreviewSettingsProvider'
import { ReadingPaperContext } from '@/preview/ReadingPaperContext'
import { SearchPane } from '@/search/SearchPane'
import { isNotePath } from '@/vault/file-kind'
import type { VaultInfo } from '@/vault/types'
import { focusActiveDocument, focusExplorer, isExplorerFocused } from '@/workbench/document-focus'
import { addBookmarkItem, type BookmarkTarget } from '../../shared/bookmarks'
import type { InteractiveCreateResult } from '../../shared/interactive-authoring'
import type { KnowledgePanelId } from '../../shared/knowledge'
import { resolveWikilinkHeading, type WikilinkSubpath } from '../../shared/wikilinks'

interface DeleteRequest {
  relativePath: string
}

const LazySettingsDialog = lazy(async () => {
  const module = await import('@/settings/SettingsDialog')
  return { default: module.SettingsDialog }
})

function App(): React.JSX.Element {
  const [vault, setVault] = useState<VaultInfo | null>(null)
  const [selectedVaultPath, setSelectedVaultPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [activeRightPanel, setActiveRightPanel] = useState<KnowledgePanelId>('outline')
  const [propertyAddRequest, setPropertyAddRequest] = useState(0)
  const [searchBookmark, setSearchBookmark] = useState({ query: '', requestId: 0 })
  const [readingFullView, setReadingFullView] = useState(false)
  const [createNoteDirectory, setCreateNoteDirectory] = useState<string | null>(null)
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null)
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false)
  const [keyRecorderActive, setKeyRecorderActive] = useState(false)
  const [settingsMounted, setSettingsMounted] = useState(false)
  const [starterProofProjectRoot, setStarterProofProjectRoot] = useState<string | null>(null)

  const { toast, showToast } = useToast()
  const globalSurface = useGlobalSurface()
  const settingsOpen = globalSurface.isSurfaceOpen('settings')
  useEffect(() => {
    if (settingsOpen) setSettingsMounted(true)
  }, [settingsOpen])
  const appSettings = useAppSettings({ onError: setError })
  const { toggle: toggleTheme, resolvedTheme } = useTheme({ settings: appSettings })
  const settingsSnapshot = appSettings.snapshot ?? DEFAULT_APP_SETTINGS_SNAPSHOT
  const effectiveTheme =
    settingsSnapshot.theme === 'system' ? resolvedTheme : settingsSnapshot.theme
  const readingPaper = settingsSnapshot.readingPaper === 'light' ? 'light' : effectiveTheme
  useInterfacePreferences({
    density: settingsSnapshot.density,
    uiScale: settingsSnapshot.uiScale
  })
  const { recordRecentNote } = useRecentNotes()
  const editor = useNoteEditor({
    onError: setError,
    onRecentNote: recordRecentNote,
    showToast
  })
  const textEditor = useTextFileEditor({ onError: setError })
  const readingZoom = useReadingZoom()
  const selectedNotePath = isNotePath(selectedVaultPath) ? editor.selectedPath : null
  const readingFullViewEnabled = isReadingFullViewActionEnabled(selectedNotePath, viewMode)
  const readingFullViewActive = readingFullViewEnabled && readingFullView

  useEffect(() => {
    if (!readingFullViewEnabled) {
      setReadingFullView(false)
    }
  }, [readingFullViewEnabled])

  const toggleReadingFullView = useCallback((): void => {
    setReadingFullView((current) => !current)
  }, [])

  const noteIndex = useNoteIndex({
    vault,
    selectedPath: selectedNotePath,
    onError: setError
  })
  const knowledge = useKnowledgeUtilities({
    vaultKey: vault?.name ?? null,
    selectedPath: selectedNotePath,
    editor,
    noteIndex,
    onError: setError
  })
  const editorTabs = useWorkbench({
    vault,
    editor,
    textEditor,
    viewMode,
    setViewMode,
    setSelectedVaultPath,
    defaultNoteView: settingsSnapshot.defaultNoteView,
    activateOnClose: settingsSnapshot.workbench.activateOnClose,
    whenClosingWithNoTabs: settingsSnapshot.workbench.whenClosingWithNoTabs,
    onError: setError,
    showToast
  })
  useEffect(() => {
    setStarterProofProjectRoot(null)
  }, [editorTabs.state.sessionId])
  const vaultSession = useVaultSession({
    vault,
    setVault,
    workbench: editorTabs,
    noteIndex,
    appSettings,
    onError: setError,
    showToast
  })
  const noteActions = useNoteActions({
    vault,
    indexNotes: noteIndex.indexNotes,
    editor,
    vaultSession,
    setViewMode,
    onError: setError,
    showToast
  })
  const editorInteractions = useEditorInteractions({ editor, setAiPanelOpen })
  const navigateWithSubpath = useCallback(
    async (relativePath: string, subpath?: WikilinkSubpath | null): Promise<boolean> => {
      const opened = await noteActions.navigateToNote(relativePath)
      if (!opened || !subpath) return opened
      const headings = await window.indexApi.headingsOfNote(relativePath)
      const heading = resolveWikilinkHeading(headings, subpath)
      if (heading) editorInteractions.revealHeading(heading)
      return opened
    },
    [editorInteractions.revealHeading, noteActions.navigateToNote]
  )
  const openFileFinder = useCallback(
    () => globalSurface.openSurface('file-finder'),
    [globalSurface.openSurface]
  )
  const openCommandPalette = useCallback(
    () => globalSurface.openSurface('command-palette'),
    [globalSurface.openSurface]
  )
  const openProjectSearch = useCallback(() => {
    setSearchBookmark((current) => ({ query: '', requestId: current.requestId + 1 }))
    globalSurface.openSurface('project-search')
  }, [globalSurface.openSurface])
  const openCreateNote = useCallback(() => {
    setCreateNoteDirectory(null)
    globalSurface.openSurface('create-note')
  }, [globalSurface.openSurface])
  const openCreateNoteInFolder = useCallback(
    (directoryPath: string) => {
      setCreateNoteDirectory(directoryPath)
      globalSurface.openSurface('create-note')
    },
    [globalSurface.openSurface]
  )
  const openCreateInteractiveDialog = useCallback(
    () => globalSurface.openSurface('create-interactive'),
    [globalSurface.openSurface]
  )
  const openExport = useCallback(
    () => globalSurface.openSurface('export'),
    [globalSurface.openSurface]
  )
  const openSettings = useCallback(
    () => globalSurface.openSurface('settings'),
    [globalSurface.openSurface]
  )
  const toggleLeftPanel = useCallback((): void => {
    setLeftPanelOpen((current) => {
      if ((current && isExplorerFocused()) || document.activeElement === document.body) {
        window.setTimeout(() => focusActiveDocument(), 0)
      }
      return !current
    })
  }, [])
  const toggleExplorerFocus = useCallback((): void => {
    if (document.activeElement === document.body) {
      focusActiveDocument()
      return
    }
    if (!leftPanelOpen) {
      setLeftPanelOpen(true)
      window.setTimeout(() => focusExplorer(), 0)
      return
    }

    if (isExplorerFocused()) {
      focusActiveDocument()
    } else {
      focusExplorer()
    }
  }, [leftPanelOpen])
  const showKnowledgePanel = useCallback((panel: KnowledgePanelId): void => {
    setActiveRightPanel(panel)
    setRightPanelOpen(true)
  }, [])
  const fitGraphView = useCallback((): void => {
    dispatchGraphSurfaceCommand('fit-view')
  }, [])
  const toggleGraphSettings = useCallback((): void => {
    dispatchGraphSurfaceCommand('toggle-settings')
  }, [])
  const openBookmarkedSearch = useCallback(
    (query: string): void => {
      setSearchBookmark((current) => ({ query, requestId: current.requestId + 1 }))
      globalSurface.openSurface('project-search')
    },
    [globalSurface.openSurface]
  )
  const addBookmark = useCallback(
    async (target: BookmarkTarget, title: string | null = null): Promise<void> => {
      if (!knowledge.bookmarks) return
      const next = addBookmarkItem(knowledge.bookmarks, {
        id: crypto.randomUUID(),
        title,
        target
      })
      if (await knowledge.saveBookmarks(next)) {
        showToast('Bookmark added')
      }
    },
    [knowledge.bookmarks, knowledge.saveBookmarks, showToast]
  )
  const handleStarterCreated = useCallback((result: InteractiveCreateResult): void => {
    setStarterProofProjectRoot(result.projectRoot)
  }, [])
  const consumeStarterProofConsent = useCallback((projectRoot: string): void => {
    setStarterProofProjectRoot((current) => (current === projectRoot ? null : current))
  }, [])
  const interactiveAuthoring = useInteractiveAuthoring({
    hasVault: vault !== null,
    editable: viewMode === 'source' || viewMode === 'live',
    selectedNotePath,
    editorSelection: editorInteractions.editorSelection,
    editor,
    workbench: editorTabs,
    refreshVaultSnapshot: vaultSession.refreshVaultSnapshot,
    openDialog: openCreateInteractiveDialog,
    onStarterCreated: handleStarterCreated,
    onError: setError,
    showToast
  })
  const commandActions = useCommandActions({
    vault,
    selectedPath: selectedNotePath,
    indexNoteCount: noteIndex.indexNotes.length,
    noteTemplates: noteIndex.noteTemplates,
    trashCount: vaultSession.trashCount,
    noteActions,
    workbench: editorTabs,
    keymapOverrides: settingsSnapshot.keymapOverrides,
    openVault: vaultSession.openVault,
    toggleTheme,
    toggleReadingPaper: () =>
      appSettings
        .updateSettings({
          readingPaper: settingsSnapshot.readingPaper === 'light' ? 'follow-theme' : 'light'
        })
        .then(() => undefined),
    openCreateNote,
    openCreateInteractive: interactiveAuthoring.openCreateDialog,
    interactiveCreateEnabled: interactiveAuthoring.canCreate,
    openFileFinder,
    openCommandPalette,
    openSearch: openProjectSearch,
    openExport,
    openSettings,
    toggleAiPanel: () => setAiPanelOpen((current) => !current),
    openEmptyTrash: () => setEmptyTrashOpen(true),
    toggleLeftPanel,
    toggleExplorerFocus,
    showKnowledgePanel,
    graphSurfaceActive:
      editorTabs.activeItem?.kind === 'graph' ||
      (rightPanelOpen && activeRightPanel === 'local-graph' && selectedNotePath !== null),
    fitGraphView,
    toggleGraphSettings,
    addProperty: () => {
      showKnowledgePanel('properties')
      setPropertyAddRequest((current) => current + 1)
    },
    focusEditor: focusActiveDocument,
    setViewMode,
    viewMode,
    readingSource: editor.content,
    revealEditorLine: editorInteractions.revealEditorLine,
    readingFullViewEnabled,
    toggleReadingFullView,
    readingZoomEnabled: isReadingZoomActionEnabled(selectedNotePath, viewMode),
    readingZoomActions: readingZoom,
    onError: setError
  })

  useKeyboardShortcuts({
    registry: commandActions,
    keymapOverrides: settingsSnapshot.keymapOverrides,
    activeSurface: globalSurface.activeSurface,
    dialogOpen:
      vaultSession.renameRequest !== null ||
      deleteRequest !== null ||
      emptyTrashOpen ||
      editorTabs.pendingMissingCloseItem !== null,
    keyRecorderActive,
    mruSwitchActive: editorTabs.state.mruSwitch !== null,
    onCommitMru: editorTabs.commitMruSwitch,
    onCancelMru: editorTabs.cancelMruSwitch
  })

  return (
    <I18nProvider locale={settingsSnapshot.locale}>
      <ReadingPaperContext.Provider value={readingPaper}>
        <PagePreviewSettingsProvider settings={settingsSnapshot.pagePreview}>
          <SourceEditorPreferencesProvider
            settings={settingsSnapshot}
            onChange={appSettings.updateSettings}
            isPending={appSettings.isLoading || appSettings.isPending}
          >
            <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
              <AppLayout
                vault={vault}
                selectedVaultPath={selectedVaultPath}
                selectedNotePath={selectedNotePath}
                error={error}
                viewMode={viewMode}
                readingFullView={readingFullViewActive}
                aiPanelOpen={aiPanelOpen}
                leftPanelOpen={leftPanelOpen}
                rightPanelOpen={rightPanelOpen}
                density={settingsSnapshot.density}
                uiScale={settingsSnapshot.uiScale}
                panelWidths={{
                  leftPanelWidth: settingsSnapshot.leftPanelWidth,
                  rightPanelWidth: settingsSnapshot.rightPanelWidth,
                  aiPanelWidth: settingsSnapshot.aiPanelWidth
                }}
                onPanelWidthChange={(key, width) =>
                  void appSettings.updateSettings({ [key]: width })
                }
                showFileExtensions={settingsSnapshot.showFileExtensions}
                commandActions={commandActions}
                editor={editor}
                textEditor={textEditor}
                noteIndex={noteIndex}
                vaultSession={vaultSession}
                noteActions={noteActions}
                editorInteractions={editorInteractions}
                editorTabs={editorTabs}
                readingZoom={readingZoom}
                starterProofProjectRoot={starterProofProjectRoot}
                onConsumeStarterProofConsent={consumeStarterProofConsent}
                knowledge={knowledge}
                activeRightPanel={activeRightPanel}
                propertyAddRequest={propertyAddRequest}
                setRightPanelOpen={setRightPanelOpen}
                setActiveRightPanel={setActiveRightPanel}
                onOpenSearch={openBookmarkedSearch}
                onCreateNoteInFolder={openCreateNoteInFolder}
                onAddBookmark={addBookmark}
                onNavigateWithSubpath={navigateWithSubpath}
                onRequestDelete={(relativePath) => setDeleteRequest({ relativePath })}
                onError={setError}
              />

              <QuickSwitcher
                open={globalSurface.isSurfaceOpen('file-finder')}
                files={vault?.treeFiles ?? null}
                notes={noteIndex.indexNotes}
                openItemIds={editorTabs.state.mruIds}
                recentItemIds={[...editorTabs.state.mruIds, ...editorTabs.state.closedIds]}
                onOpenChange={(open) => {
                  if (!open) {
                    editorTabs.cancelPendingNavigation()
                  }
                  globalSurface.setSurfaceOpen('file-finder', open)
                }}
                onSelectFile={async (relativePath) => {
                  const opened = await editorTabs.openOrActivate(relativePath, { focus: false })
                  if (opened) {
                    globalSurface.completeSurface('file-finder')
                  }
                  return opened
                }}
                onCreateNote={async (query) => {
                  await noteActions.createNoteFromSwitcher(query)
                  globalSurface.completeSurface('file-finder')
                }}
              />
              <CommandPalette
                open={globalSurface.isSurfaceOpen('command-palette')}
                actions={commandActions.actions}
                onOpenChange={(open) => {
                  if (!open) {
                    editorTabs.cancelPendingNavigation()
                  }
                  globalSurface.setSurfaceOpen('command-palette', open)
                }}
                onComplete={() => globalSurface.completeSurface('command-palette')}
                onError={setError}
              />
              <SearchPane
                open={globalSurface.isSurfaceOpen('project-search')}
                initialQuery={searchBookmark.query}
                initialQueryRequest={searchBookmark.requestId}
                onBookmarkQuery={(query) =>
                  addBookmark({ kind: 'search', query }, `Search: ${query}`)
                }
                onOpenChange={(open) => {
                  if (!open) {
                    editorTabs.cancelPendingNavigation()
                  }
                  globalSurface.setSurfaceOpen('project-search', open)
                }}
                onSelectResult={async (result) => {
                  const opened = await noteActions.navigateToNote(result.note.relativePath)
                  if (opened) {
                    if (result.heading) {
                      editorInteractions.revealHeading(result.heading)
                    }
                    globalSurface.completeSurface('project-search')
                  }
                  return opened
                }}
              />
              <ExportDialog
                open={globalSurface.isSurfaceOpen('export')}
                onOpenChange={(open) => globalSurface.setSurfaceOpen('export', open)}
                noteRelativePath={selectedNotePath}
                noteTitle={selectedNotePath ? deriveNoteTitle(selectedNotePath) : ''}
              />
              <CreateNoteDialog
                open={globalSurface.isSurfaceOpen('create-note')}
                directoryPath={createNoteDirectory}
                onOpenChange={(open) => {
                  globalSurface.setSurfaceOpen('create-note', open)
                  if (!open) {
                    setCreateNoteDirectory(null)
                  }
                }}
                onCreate={async (relativePath, content) => {
                  await vaultSession.createNote(relativePath, content)
                  globalSurface.completeSurface('create-note')
                }}
              />
              <CreateInteractiveDialog
                open={globalSurface.isSurfaceOpen('create-interactive')}
                isCreating={interactiveAuthoring.isCreating}
                onOpenChange={(open) => {
                  if (!open) {
                    interactiveAuthoring.cancelCreateDialog()
                  }
                  globalSurface.setSurfaceOpen('create-interactive', open)
                }}
                onCreate={async (form) => {
                  await interactiveAuthoring.createInteractive(form)
                  globalSurface.completeSurface('create-interactive')
                }}
              />
              {settingsMounted ? (
                <Suspense fallback={null}>
                  <LazySettingsDialog
                    open={settingsOpen}
                    onOpenChange={(open) => globalSurface.setSurfaceOpen('settings', open)}
                    onOpenAnotherVault={vaultSession.openVault}
                    appSettings={appSettings}
                    onKeyRecorderChange={setKeyRecorderActive}
                  />
                </Suspense>
              ) : null}
              <MruTabSwitcher
                state={editorTabs.state.mruSwitch}
                items={editorTabs.tabs}
                onCommit={(relativePath) => void editorTabs.openOrActivate(relativePath)}
                onCancel={editorTabs.cancelMruSwitch}
              />
              <ConfirmDialog
                open={editorTabs.pendingMissingCloseItem !== null}
                onOpenChange={(open) => {
                  if (!open) {
                    editorTabs.cancelDiscardMissingClose()
                  }
                }}
                title={`Discard changes to "${editorTabs.pendingMissingCloseItem ? deriveNoteTitle(editorTabs.pendingMissingCloseItem.relativePath) : ''}"?`}
                description={
                  <>
                    This file was deleted outside mdx-vault, so its in-memory changes cannot be
                    saved to the original path. Discard closes the tab without recreating the file.
                  </>
                }
                confirmLabel="Discard and close"
                destructive
                onConfirm={async () => {
                  await editorTabs.confirmDiscardMissingClose()
                }}
              />
              <ConfirmDialog
                open={vaultSession.renameRequest !== null}
                onOpenChange={(open) => {
                  if (!open && !vaultSession.vaultOpsPending) {
                    vaultSession.setRenameRequest(null)
                  }
                }}
                title={`Update ${vaultSession.renameRequest?.plan.linkCount ?? 0} link${vaultSession.renameRequest?.plan.linkCount === 1 ? '' : 's'} in ${vaultSession.renameRequest?.plan.noteCount ?? 0} note${vaultSession.renameRequest?.plan.noteCount === 1 ? '' : 's'}?`}
                description={
                  <>
                    Renaming to{' '}
                    <code className="bg-foreground px-1 py-0.5 font-mono text-xs text-background">
                      {vaultSession.renameRequest?.toRelativePath ?? ''}
                    </code>{' '}
                    can update every link that currently resolves to this note. Display aliases will
                    stay unchanged.
                  </>
                }
                confirmLabel="Update links"
                secondaryLabel="Don't update"
                isPending={vaultSession.vaultOpsPending}
                onConfirm={async () => {
                  if (vaultSession.renameRequest) {
                    await vaultSession.commitRename(
                      vaultSession.renameRequest.fromRelativePath,
                      vaultSession.renameRequest.toRelativePath,
                      true
                    )
                  }
                }}
                onSecondary={async () => {
                  if (vaultSession.renameRequest) {
                    await vaultSession.commitRename(
                      vaultSession.renameRequest.fromRelativePath,
                      vaultSession.renameRequest.toRelativePath,
                      false
                    )
                  }
                }}
              />
              <ConfirmDialog
                open={deleteRequest !== null}
                onOpenChange={(open) => {
                  if (!open) {
                    setDeleteRequest(null)
                  }
                }}
                title={`Delete "${deleteRequest ? deriveNoteTitle(deleteRequest.relativePath) : ''}"?`}
                description={
                  <>
                    The note will be moved to{' '}
                    <code className="bg-foreground px-1 py-0.5 font-mono text-xs text-background">
                      {'.trash/'}
                    </code>
                    . You can recover it from there with your file manager, or use “Empty trash” to
                    remove it permanently.
                  </>
                }
                confirmLabel="Move to trash"
                destructive
                isPending={vaultSession.vaultOpsPending}
                onConfirm={async () => {
                  if (deleteRequest) {
                    await vaultSession.handleDelete(deleteRequest.relativePath)
                  }
                }}
              />
              <ConfirmDialog
                open={emptyTrashOpen}
                onOpenChange={setEmptyTrashOpen}
                title="Empty trash?"
                description={
                  <>
                    This permanently deletes{' '}
                    <strong className="text-foreground">
                      {vaultSession.trashCount} item{vaultSession.trashCount === 1 ? '' : 's'}
                    </strong>{' '}
                    from{' '}
                    <code className="bg-foreground px-1 py-0.5 font-mono text-xs text-background">
                      {'.trash/'}
                    </code>
                    . This cannot be undone.
                  </>
                }
                confirmLabel="Empty trash"
                destructive
                isPending={vaultSession.vaultOpsPending}
                onConfirm={vaultSession.handleEmptyTrash}
              />
              {toast ? (
                <ToastView key={toast.key} message={toast.message} variant={toast.variant} />
              ) : null}
            </div>
          </SourceEditorPreferencesProvider>
        </PagePreviewSettingsProvider>
      </ReadingPaperContext.Provider>
    </I18nProvider>
  )
}

export default App
