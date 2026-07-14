import { type Dispatch, type SetStateAction, useState } from 'react'
import { AiSidePanel } from '@/ai/panels/AiSidePanel'
import type { CommandAction } from '@/commands/actions'
import { AppStatusBar } from '@/components/AppStatusBar'
import { AppTopBar } from '@/components/AppTopBar'
import { LeftPanel } from '@/components/layout/LeftPanel'
import { MainEditor, type ReadingZoomStatus } from '@/components/layout/MainEditor'
import { type NavigationPanel, RightPanel } from '@/components/layout/RightPanel'
import type { ViewMode } from '@/components/ViewModeToggle'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import type { VaultSessionController } from '@/hooks/useVaultSession'
import { deriveNoteTitle } from '@/lib/note-title'
import type { VaultInfo } from '@/vault/types'

export type { NavigationPanel } from '@/components/layout/RightPanel'

interface AppLayoutProps {
  vault: VaultInfo | null
  selectedVaultPath: string | null
  selectedNotePath: string | null
  error: string | null
  viewMode: ViewMode
  navigationPanel: NavigationPanel
  aiPanelOpen: boolean
  commandActions: CommandAction[]
  editor: NoteEditorController
  noteIndex: NoteIndexController
  vaultSession: VaultSessionController
  noteActions: NoteActionsController
  editorInteractions: EditorInteractionsController
  setViewMode: Dispatch<SetStateAction<ViewMode>>
  setNavigationPanel: Dispatch<SetStateAction<NavigationPanel>>
  setAiPanelOpen: Dispatch<SetStateAction<boolean>>
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>
  setCreateNoteOpen: Dispatch<SetStateAction<boolean>>
  setEmptyTrashOpen: Dispatch<SetStateAction<boolean>>
  onRequestDelete: (relativePath: string) => void
  onError: (message: string | null) => void
}

export function AppLayout({
  vault,
  selectedVaultPath,
  selectedNotePath,
  error,
  viewMode,
  navigationPanel,
  aiPanelOpen,
  commandActions,
  editor,
  noteIndex,
  vaultSession,
  noteActions,
  editorInteractions,
  setViewMode,
  setNavigationPanel,
  setAiPanelOpen,
  setCommandPaletteOpen,
  setCreateNoteOpen,
  setEmptyTrashOpen,
  onRequestDelete,
  onError
}: AppLayoutProps): React.JSX.Element {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [readingZoomStatus, setReadingZoomStatus] = useState<ReadingZoomStatus | null>(null)
  const gridTemplateColumns = [
    leftPanelOpen ? '280px' : null,
    'minmax(0, 1fr)',
    rightPanelOpen ? '320px' : null,
    aiPanelOpen ? '360px' : null
  ]
    .filter((column): column is string => column !== null)
    .join(' ')

  return (
    <>
      <a
        href="#workspace"
        className="app-no-drag sr-only fixed top-2 left-2 z-[60] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground shadow-[3px_3px_0_0_var(--foreground)] focus:not-sr-only"
      >
        Skip to workspace
      </a>
      <AppTopBar
        vaultName={vault?.name ?? null}
        selectedPath={selectedNotePath}
        viewMode={viewMode}
        commandActions={commandActions}
        editorAvailable={
          selectedNotePath !== null && !editor.isLoadingFile && viewMode !== 'reading'
        }
        isOpeningVault={vaultSession.isOpening}
        isSaving={editor.isSaving}
        isDirty={editor.isDirty}
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        aiPanelOpen={aiPanelOpen}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onSave={() => void editor.saveCurrentFile()}
        onRevealNote={() => {
          if (selectedNotePath) {
            void vaultSession.handleRevealInExplorer(selectedNotePath)
          }
        }}
        onToggleLeftPanel={() => setLeftPanelOpen((current) => !current)}
        onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
        onToggleAi={() => setAiPanelOpen((current) => !current)}
      />

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-11 left-1/2 z-[70] max-w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 border-2 border-destructive bg-background px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-destructive shadow-[3px_3px_0_0_var(--destructive)]"
        >
          {error}
        </div>
      ) : null}

      <main
        id="workspace"
        tabIndex={-1}
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{ gridTemplateColumns }}
      >
        {leftPanelOpen ? (
          <LeftPanel
            vault={vault}
            selectedPath={selectedVaultPath}
            noteIndex={noteIndex}
            vaultSession={vaultSession}
            setCreateNoteOpen={setCreateNoteOpen}
            setEmptyTrashOpen={setEmptyTrashOpen}
            onRequestDelete={onRequestDelete}
          />
        ) : null}
        <MainEditor
          viewMode={viewMode}
          selectedPath={selectedVaultPath}
          commandActions={commandActions}
          editor={editor}
          noteIndex={noteIndex}
          noteActions={noteActions}
          editorInteractions={editorInteractions}
          setViewMode={setViewMode}
          onReadingZoomStatusChange={setReadingZoomStatus}
          onRevealInExplorer={(relativePath) =>
            void vaultSession.handleRevealInExplorer(relativePath)
          }
          onError={onError}
        />
        {rightPanelOpen ? (
          <RightPanel
            navigationPanel={navigationPanel}
            selectedPath={selectedNotePath}
            noteIndex={noteIndex}
            noteActions={noteActions}
            editorInteractions={editorInteractions}
            setNavigationPanel={setNavigationPanel}
          />
        ) : null}

        {aiPanelOpen ? (
          <aside className="min-h-0 min-w-0 border-l-2 border-foreground bg-[var(--paper-dark)]">
            <AiSidePanel
              noteRelativePath={selectedNotePath}
              noteTitle={selectedNotePath ? deriveNoteTitle(selectedNotePath) : 'No note'}
              noteContent={selectedNotePath ? editor.content : ''}
              selection={editorInteractions.selectionForAssistant}
              backlinks={noteIndex.backlinks.map((entry) => ({
                relativePath: entry.source.relativePath,
                display: entry.display
              }))}
              onWriteFile={editor.writeFileFromAssistant}
              onRequestActionPalette={editorInteractions.openAiPalette}
            />
          </aside>
        ) : null}
      </main>

      <AppStatusBar
        selectedPath={selectedNotePath}
        selectedVaultPath={selectedVaultPath}
        content={editor.content}
        isLoadingFile={editor.isLoadingFile}
        isDirty={editor.isDirty}
        isSaving={editor.isSaving}
        lastSavedAt={editor.lastSavedAt}
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        aiPanelOpen={aiPanelOpen}
        hasVault={vault !== null}
        readingZoomFactor={
          selectedNotePath && viewMode === 'reading' ? readingZoomStatus?.factor : undefined
        }
        onToggleLeftPanel={() => setLeftPanelOpen((current) => !current)}
        onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
        onToggleAiPanel={() => setAiPanelOpen((current) => !current)}
        onResetReadingZoom={() => readingZoomStatus?.reset()}
      />
    </>
  )
}
