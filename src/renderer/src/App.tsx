import { useRef, useState } from 'react'
import { CommandPalette } from '@/commands/CommandPalette'
import { AppLayout, type NavigationPanel } from '@/components/AppLayout'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ToastView } from '@/components/ToastView'
import type { ViewMode } from '@/components/ViewModeToggle'
import { CreateNoteDialog } from '@/explorer/CreateNoteDialog'
import { QuickSwitcher } from '@/explorer/QuickSwitcher'
import { ExportDialog } from '@/export/ExportDialog'
import { useCommandActions } from '@/hooks/useCommandActions'
import { useEditorFontSize } from '@/hooks/useEditorFontSize'
import { useEditorInteractions } from '@/hooks/useEditorInteractions'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useNoteActions } from '@/hooks/useNoteActions'
import { useNoteEditor } from '@/hooks/useNoteEditor'
import { useNoteIndex } from '@/hooks/useNoteIndex'
import { useRecentNotes } from '@/hooks/useRecentNotes'
import { useTextFileEditor } from '@/hooks/useTextFileEditor'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/hooks/useToast'
import { useVaultSession } from '@/hooks/useVaultSession'
import { deriveNoteTitle } from '@/lib/note-title'
import { SearchPane } from '@/search/SearchPane'
import { SettingsDialog } from '@/settings/SettingsDialog'
import { isEditableTextPath, isNotePath } from '@/vault/file-kind'
import type { VaultInfo } from '@/vault/types'

interface DeleteRequest {
  relativePath: string
}

function App(): React.JSX.Element {
  const { theme, setTheme, toggle: toggleTheme } = useTheme()
  const [vault, setVault] = useState<VaultInfo | null>(null)
  const [selectedVaultPath, setSelectedVaultPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [navigationPanel, setNavigationPanel] = useState<NavigationPanel>('outline')
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [createNoteOpen, setCreateNoteOpen] = useState(false)
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null)
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { toast, showToast } = useToast()
  const { editorFontSize, setEditorFontSize } = useEditorFontSize({ onError: setError })
  const { recentNotePaths, recordRecentNote } = useRecentNotes()
  const editor = useNoteEditor({
    onError: setError,
    onRecentNote: recordRecentNote,
    showToast
  })
  const textEditor = useTextFileEditor({ onError: setError })
  const selectedNotePath = isNotePath(selectedVaultPath) ? editor.selectedPath : null
  const selectedTextPath =
    isEditableTextPath(selectedVaultPath) && textEditor.selectedPath === selectedVaultPath
      ? textEditor.selectedPath
      : null
  const selectedEditablePath = selectedNotePath ?? selectedTextPath
  const selectedNotePathRef = useRef(selectedNotePath)
  selectedNotePathRef.current = selectedNotePath
  const selectedEditablePathRef = useRef(selectedEditablePath)
  selectedEditablePathRef.current = selectedEditablePath
  const noteIndex = useNoteIndex({
    vault,
    selectedPath: selectedNotePath,
    onError: setError
  })
  const vaultSession = useVaultSession({
    vault,
    selectedVaultPath,
    setVault,
    setSelectedVaultPath,
    editor,
    textEditor,
    noteIndex,
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
  const commandActions = useCommandActions({
    vault,
    selectedPath: selectedNotePath,
    indexNoteCount: noteIndex.indexNotes.length,
    noteTemplates: noteIndex.noteTemplates,
    trashCount: vaultSession.trashCount,
    noteActions,
    openVault: vaultSession.openVault,
    toggleTheme,
    setCreateNoteOpen,
    setQuickSwitcherOpen,
    setSearchOpen,
    setExportDialogOpen,
    setAiPanelOpen,
    setSettingsOpen,
    setEmptyTrashOpen,
    setViewMode
  })

  useKeyboardShortcuts({
    selectedPathRef: selectedNotePathRef,
    savePathRef: selectedEditablePathRef,
    saveCurrentFile: selectedTextPath ? textEditor.saveCurrentFile : editor.saveCurrentFile,
    setViewMode,
    setCommandPaletteOpen,
    setQuickSwitcherOpen,
    setCreateNoteOpen,
    setSearchOpen,
    setAiPanelOpen,
    setExportDialogOpen,
    setSettingsOpen
  })

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AppLayout
        vault={vault}
        selectedVaultPath={selectedVaultPath}
        selectedNotePath={selectedNotePath}
        error={error}
        viewMode={viewMode}
        navigationPanel={navigationPanel}
        aiPanelOpen={aiPanelOpen}
        commandActions={commandActions}
        editor={editor}
        textEditor={textEditor}
        noteIndex={noteIndex}
        vaultSession={vaultSession}
        noteActions={noteActions}
        editorInteractions={editorInteractions}
        setViewMode={setViewMode}
        setNavigationPanel={setNavigationPanel}
        setAiPanelOpen={setAiPanelOpen}
        setCommandPaletteOpen={setCommandPaletteOpen}
        setCreateNoteOpen={setCreateNoteOpen}
        setEmptyTrashOpen={setEmptyTrashOpen}
        onRequestDelete={(relativePath) => setDeleteRequest({ relativePath })}
        onError={setError}
      />

      <QuickSwitcher
        open={quickSwitcherOpen}
        notes={noteIndex.indexNotes}
        recentNotePaths={recentNotePaths}
        onOpenChange={setQuickSwitcherOpen}
        onSelectNote={noteActions.navigateToNote}
        onCreateNote={noteActions.createNoteFromSwitcher}
      />
      <CommandPalette
        open={commandPaletteOpen}
        actions={commandActions}
        onOpenChange={setCommandPaletteOpen}
        onError={setError}
      />
      <SearchPane
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectNote={noteActions.navigateToNote}
      />
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        noteRelativePath={selectedNotePath}
        noteTitle={selectedNotePath ? deriveNoteTitle(selectedNotePath) : ''}
      />
      <CreateNoteDialog
        open={createNoteOpen}
        onOpenChange={setCreateNoteOpen}
        onCreate={vaultSession.createNote}
      />
      <SettingsDialog
        open={settingsOpen}
        theme={theme}
        fileTreeSort={vaultSession.sortMode}
        editorFontSize={editorFontSize}
        onOpenChange={setSettingsOpen}
        onThemeChange={setTheme}
        onFileTreeSortChange={vaultSession.handleSortModeChange}
        onEditorFontSizeChange={setEditorFontSize}
        onOpenAnotherVault={vaultSession.openVault}
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
        onConfirm={() => {
          if (deleteRequest) {
            void vaultSession.handleDelete(deleteRequest.relativePath)
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
        onConfirm={() => void vaultSession.handleEmptyTrash()}
      />
      {toast ? <ToastView key={toast.key} message={toast.message} variant={toast.variant} /> : null}
    </div>
  )
}

export default App
