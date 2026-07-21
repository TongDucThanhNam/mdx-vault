import { useCallback, useState } from 'react'
import { CommandPalette } from '@/commands/CommandPalette'
import { isReadingZoomActionEnabled } from '@/commands/reading-zoom-actions'
import { AppLayout } from '@/components/AppLayout'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MruTabSwitcher } from '@/components/layout/MruTabSwitcher'
import { ToastView } from '@/components/ToastView'
import type { ViewMode } from '@/components/ViewModeToggle'
import { CreateNoteDialog } from '@/explorer/CreateNoteDialog'
import { QuickSwitcher } from '@/explorer/QuickSwitcher'
import { ExportDialog } from '@/export/ExportDialog'
import { DEFAULT_APP_SETTINGS_SNAPSHOT, useAppSettings } from '@/hooks/useAppSettings'
import { useCommandActions } from '@/hooks/useCommandActions'
import { useEditorFontSize } from '@/hooks/useEditorFontSize'
import { useEditorInteractions } from '@/hooks/useEditorInteractions'
import { useGlobalSurface } from '@/hooks/useGlobalSurface'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
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
import { deriveNoteTitle } from '@/lib/note-title'
import { SearchPane } from '@/search/SearchPane'
import { SettingsDialog } from '@/settings/SettingsDialog'
import { isNotePath } from '@/vault/file-kind'
import type { VaultInfo } from '@/vault/types'
import { focusActiveDocument, focusExplorer, isExplorerFocused } from '@/workbench/document-focus'

interface DeleteRequest {
  relativePath: string
}

function App(): React.JSX.Element {
  const [vault, setVault] = useState<VaultInfo | null>(null)
  const [selectedVaultPath, setSelectedVaultPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null)
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false)
  const [keyRecorderActive, setKeyRecorderActive] = useState(false)

  const { toast, showToast } = useToast()
  const globalSurface = useGlobalSurface()
  const appSettings = useAppSettings({ onError: setError })
  const { toggle: toggleTheme } = useTheme({ settings: appSettings })
  const settingsSnapshot = appSettings.snapshot ?? DEFAULT_APP_SETTINGS_SNAPSHOT
  const { editorFontSize, setEditorFontSize } = useEditorFontSize({ onError: setError })
  const { recordRecentNote } = useRecentNotes()
  const editor = useNoteEditor({
    onError: setError,
    onRecentNote: recordRecentNote,
    showToast
  })
  const textEditor = useTextFileEditor({ onError: setError })
  const readingZoom = useReadingZoom()
  const selectedNotePath = isNotePath(selectedVaultPath) ? editor.selectedPath : null
  const noteIndex = useNoteIndex({
    vault,
    selectedPath: selectedNotePath,
    onError: setError
  })
  const editorTabs = useWorkbench({
    vault,
    editor,
    textEditor,
    viewMode,
    setViewMode,
    setSelectedVaultPath,
    activateOnClose: settingsSnapshot.workbench.activateOnClose,
    whenClosingWithNoTabs: settingsSnapshot.workbench.whenClosingWithNoTabs,
    onError: setError,
    showToast
  })
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
  const openFileFinder = useCallback(
    () => globalSurface.openSurface('file-finder'),
    [globalSurface.openSurface]
  )
  const openCommandPalette = useCallback(
    () => globalSurface.openSurface('command-palette'),
    [globalSurface.openSurface]
  )
  const openProjectSearch = useCallback(
    () => globalSurface.openSurface('project-search'),
    [globalSurface.openSurface]
  )
  const openCreateNote = useCallback(
    () => globalSurface.openSurface('create-note'),
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
      if (current && isExplorerFocused()) {
        window.setTimeout(() => focusActiveDocument(), 0)
      }
      return !current
    })
  }, [])
  const toggleExplorerFocus = useCallback((): void => {
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
    openCreateNote,
    openFileFinder,
    openCommandPalette,
    openSearch: openProjectSearch,
    openExport,
    openSettings,
    toggleAiPanel: () => setAiPanelOpen((current) => !current),
    openEmptyTrash: () => setEmptyTrashOpen(true),
    toggleLeftPanel,
    toggleExplorerFocus,
    focusEditor: focusActiveDocument,
    setViewMode,
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
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AppLayout
        vault={vault}
        selectedVaultPath={selectedVaultPath}
        selectedNotePath={selectedNotePath}
        error={error}
        viewMode={viewMode}
        aiPanelOpen={aiPanelOpen}
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        commandActions={commandActions}
        editor={editor}
        textEditor={textEditor}
        noteIndex={noteIndex}
        vaultSession={vaultSession}
        noteActions={noteActions}
        editorInteractions={editorInteractions}
        editorTabs={editorTabs}
        readingZoom={readingZoom}
        setRightPanelOpen={setRightPanelOpen}
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
        onOpenChange={(open) => {
          if (!open) {
            editorTabs.cancelPendingNavigation()
          }
          globalSurface.setSurfaceOpen('project-search', open)
        }}
        onSelectNote={async (relativePath) => {
          const opened = await noteActions.navigateToNote(relativePath)
          if (opened) {
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
        onOpenChange={(open) => globalSurface.setSurfaceOpen('create-note', open)}
        onCreate={async (relativePath, content) => {
          await vaultSession.createNote(relativePath, content)
          globalSurface.completeSurface('create-note')
        }}
      />
      <SettingsDialog
        open={globalSurface.isSurfaceOpen('settings')}
        editorFontSize={editorFontSize}
        onOpenChange={(open) => globalSurface.setSurfaceOpen('settings', open)}
        onEditorFontSizeChange={setEditorFontSize}
        onOpenAnotherVault={vaultSession.openVault}
        appSettings={appSettings}
        onKeyRecorderChange={setKeyRecorderActive}
      />
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
            This file was deleted outside mdx-vault, so its in-memory changes cannot be saved to the
            original path. Discard closes the tab without recreating the file.
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
            <code className="bg-foreground px-1 py-0.5 font-mono text-[11px] text-background">
              {vaultSession.renameRequest?.toRelativePath ?? ''}
            </code>{' '}
            can update every link that currently resolves to this note. Display aliases will stay
            unchanged.
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
            <code className="bg-foreground px-1 py-0.5 font-mono text-[11px] text-background">
              {'.trash/'}
            </code>
            . You can recover it from there with your file manager, or use “Empty trash” to remove
            it permanently.
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
            <code className="bg-foreground px-1 py-0.5 font-mono text-[11px] text-background">
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
      {toast ? <ToastView key={toast.key} message={toast.message} variant={toast.variant} /> : null}
    </div>
  )
}

export default App
