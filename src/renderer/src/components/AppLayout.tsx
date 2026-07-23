import { Activity, type Dispatch, type SetStateAction, useState } from 'react'
import { AiSidePanel } from '@/ai/panels/AiSidePanel'
import type { CommandActionRegistry } from '@/commands/actions'
import { AppStatusBar } from '@/components/AppStatusBar'
import { AppTopBar } from '@/components/AppTopBar'
import { LeftPanel } from '@/components/layout/LeftPanel'
import { MainEditor } from '@/components/layout/MainEditor'
import { RightPanel } from '@/components/layout/RightPanel'
import type { ViewMode } from '@/components/ViewModeToggle'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { KnowledgeUtilitiesController } from '@/hooks/useKnowledgeUtilities'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import type { ReadingZoomController } from '@/hooks/useReadingZoom'
import type { TextFileEditorController } from '@/hooks/useTextFileEditor'
import type { VaultSessionController } from '@/hooks/useVaultSession'
import type { WorkbenchController } from '@/hooks/useWorkbench'
import { deriveNoteTitle } from '@/lib/note-title'
import type { VaultInfo } from '@/vault/types'
import type { BookmarkTarget } from '../../../shared/bookmarks'
import type { KnowledgePanelId, SourceRange } from '../../../shared/knowledge'
import type { WikilinkSubpath } from '../../../shared/wikilinks'

interface AppLayoutProps {
  vault: VaultInfo | null
  selectedVaultPath: string | null
  selectedNotePath: string | null
  error: string | null
  viewMode: ViewMode
  aiPanelOpen: boolean
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  commandActions: CommandActionRegistry
  editor: NoteEditorController
  textEditor: TextFileEditorController
  noteIndex: NoteIndexController
  vaultSession: VaultSessionController
  noteActions: NoteActionsController
  editorInteractions: EditorInteractionsController
  editorTabs: WorkbenchController
  readingZoom: ReadingZoomController
  knowledge: KnowledgeUtilitiesController
  activeRightPanel: KnowledgePanelId
  propertyAddRequest: number
  setRightPanelOpen: Dispatch<SetStateAction<boolean>>
  setActiveRightPanel: Dispatch<SetStateAction<KnowledgePanelId>>
  onOpenSearch: (query: string) => void
  onAddBookmark: (target: BookmarkTarget, title?: string | null) => void | Promise<void>
  onNavigateWithSubpath: (
    relativePath: string,
    subpath?: WikilinkSubpath | null
  ) => Promise<boolean>
  onRequestDelete: (relativePath: string) => void
  onError: (message: string | null) => void
}

export function AppLayout({
  vault,
  selectedVaultPath,
  selectedNotePath,
  error,
  viewMode,
  aiPanelOpen,
  leftPanelOpen,
  rightPanelOpen,
  commandActions,
  editor,
  textEditor,
  noteIndex,
  vaultSession,
  noteActions,
  editorInteractions,
  editorTabs,
  readingZoom,
  knowledge,
  activeRightPanel,
  propertyAddRequest,
  setRightPanelOpen,
  setActiveRightPanel,
  onOpenSearch,
  onAddBookmark,
  onNavigateWithSubpath,
  onRequestDelete,
  onError
}: AppLayoutProps): React.JSX.Element {
  const [explorerRevealRequest, setExplorerRevealRequest] = useState<{
    path: string
    requestId: number
  } | null>(null)
  const noteSelected = selectedNotePath !== null
  const textSelected = selectedVaultPath !== null && textEditor.selectedPath === selectedVaultPath
  const activeEditor = textSelected ? textEditor : editor
  const activeEditorPath = selectedNotePath ?? (textSelected ? textEditor.selectedPath : null)
  const activeEditorAvailable = noteSelected || textSelected
  const activeIsDirty = activeEditorAvailable ? activeEditor.isDirty : false
  const activeIsLoading = activeEditorAvailable ? activeEditor.isLoadingFile : false
  const activeIsSaving = activeEditorAvailable ? activeEditor.isSaving : false
  const activeLastSavedAt = activeEditorAvailable ? activeEditor.lastSavedAt : null
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
        selectedPath={activeEditorPath}
        viewMode={viewMode}
        commandActions={commandActions}
        editorAvailable={
          activeEditorPath !== null &&
          !activeEditor.isLoadingFile &&
          (textSelected || viewMode !== 'reading')
        }
        isOpeningVault={vaultSession.isOpening}
        isSaving={activeIsSaving}
        isDirty={activeIsDirty}
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        aiPanelOpen={aiPanelOpen}
        onRevealNote={() => {
          if (activeEditorPath) {
            void vaultSession.handleRevealInExplorer(activeEditorPath)
          }
        }}
        onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
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
        <Activity mode={leftPanelOpen ? 'visible' : 'hidden'}>
          <LeftPanel
            vault={vault}
            selectedPath={selectedVaultPath}
            noteIndex={noteIndex}
            vaultSession={vaultSession}
            commandActions={commandActions}
            revealRequest={explorerRevealRequest}
            onRequestDelete={onRequestDelete}
            onAddBookmark={onAddBookmark}
          />
        </Activity>
        <MainEditor
          viewMode={viewMode}
          selectedPath={selectedVaultPath}
          editorTabs={editorTabs}
          commandActions={commandActions}
          editor={editor}
          textEditor={textEditor}
          noteIndex={noteIndex}
          noteActions={noteActions}
          editorInteractions={editorInteractions}
          readingZoom={readingZoom}
          onRevealInExplorer={(relativePath) =>
            void vaultSession.handleRevealInExplorer(relativePath)
          }
          onError={onError}
        />
        <Activity mode={rightPanelOpen ? 'visible' : 'hidden'}>
          <RightPanel
            activePanel={activeRightPanel}
            selectedPath={selectedNotePath}
            source={editor.savedContent}
            isDirty={editor.isDirty}
            propertyAddRequest={propertyAddRequest}
            noteIndex={noteIndex}
            knowledge={knowledge}
            onActivePanelChange={setActiveRightPanel}
            onSelectHeading={editorInteractions.revealHeading}
            onBookmarkHeading={(heading) => {
              if (selectedNotePath) {
                void onAddBookmark(
                  {
                    kind: 'heading',
                    relativePath: selectedNotePath,
                    heading: heading.text
                  },
                  heading.text
                )
              }
            }}
            onRevealRange={(range: SourceRange) => {
              void commandActions.dispatch('view.source')
              window.setTimeout(() => editorInteractions.revealEditorRange(range), 0)
            }}
            onSelectNote={noteActions.navigateToNote}
            onSelectBookmarkHeading={(relativePath, heading) =>
              void onNavigateWithSubpath(relativePath, {
                kind: 'heading',
                segments: [heading]
              })
            }
            onSelectBookmarkFolder={(relativePath) => {
              if (!leftPanelOpen) {
                void commandActions.dispatch('view.toggle-left-panel')
              }
              setExplorerRevealRequest((current) => ({
                path: relativePath,
                requestId: (current?.requestId ?? 0) + 1
              }))
            }}
            onOpenSearch={onOpenSearch}
          />
        </Activity>

        <Activity mode={aiPanelOpen ? 'visible' : 'hidden'}>
          <aside className="min-h-0 min-w-0 border-l-2 border-foreground bg-chrome">
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
        </Activity>
      </main>

      <AppStatusBar
        selectedPath={activeEditorPath}
        selectedVaultPath={selectedVaultPath}
        content={activeEditorAvailable ? activeEditor.content : ''}
        isLoadingFile={activeIsLoading}
        isDirty={activeIsDirty}
        isSaving={activeIsSaving}
        lastSavedAt={activeLastSavedAt}
        leftPanelOpen={leftPanelOpen}
        rightPanelOpen={rightPanelOpen}
        aiPanelOpen={aiPanelOpen}
        hasVault={vault !== null}
        readingZoomFactor={
          selectedNotePath && viewMode === 'reading' ? readingZoom.factor : undefined
        }
        onToggleLeftPanel={() => void commandActions.dispatch('view.toggle-left-panel')}
        onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
        onToggleAiPanel={() => void commandActions.dispatch('ai.toggle')}
        onResetReadingZoom={() => void commandActions.dispatch('view.zoom-reset')}
      />
    </>
  )
}
