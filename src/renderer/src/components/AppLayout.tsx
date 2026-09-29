import {
  Activity,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import { AiSidePanel } from '@/ai/panels/AiSidePanel'
import type { CommandActionRegistry } from '@/commands/actions'
import { AppStatusBar } from '@/components/AppStatusBar'
import { AppTopBar } from '@/components/AppTopBar'
import { LeftPanel } from '@/components/layout/LeftPanel'
import { MainEditor } from '@/components/layout/MainEditor'
import { PanelSeparator } from '@/components/layout/PanelSeparator'
import { ResponsiveSupplementaryDock } from '@/components/layout/ResponsiveSupplementaryDock'
import { RightPanel } from '@/components/layout/RightPanel'
import type { PanelWidths } from '@/components/layout/workspace-layout'
import {
  resolveDockPolicy,
  resolveWorkspaceLayoutMode,
  useWorkspaceViewportWidth,
  workspaceGridTemplate
} from '@/components/layout/workspace-layout'
import type { ViewMode } from '@/components/ViewModeToggle'
import { resolveLocalGraphContext } from '@/graph/local-graph-state'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { KnowledgeUtilitiesController } from '@/hooks/useKnowledgeUtilities'
import { useLivingOutline } from '@/hooks/useLivingOutline'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import type { ReadingZoomController } from '@/hooks/useReadingZoom'
import type { TextFileEditorController } from '@/hooks/useTextFileEditor'
import type { VaultSessionController } from '@/hooks/useVaultSession'
import type { WorkbenchController } from '@/hooks/useWorkbench'
import { useI18n } from '@/i18n/useI18n'
import { completeInteractiveAiHandoff } from '@/interactive/interactive-ai-handoff'
import { deriveNoteTitle } from '@/lib/note-title'
import type { NoteHeadingResult, VaultInfo } from '@/vault/types'
import type { PanelWidthKey, UiDensity } from '../../../shared/app-settings'
import type { BookmarkTarget } from '../../../shared/bookmarks'
import type { KnowledgePanelId, SourceRange } from '../../../shared/knowledge'
import type { WikilinkSubpath } from '../../../shared/wikilinks'

interface AppLayoutProps {
  vault: VaultInfo | null
  selectedVaultPath: string | null
  selectedNotePath: string | null
  error: string | null
  viewMode: ViewMode
  readingFullView: boolean
  aiPanelOpen: boolean
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  density: UiDensity
  uiScale: number
  panelWidths: PanelWidths
  onPanelWidthChange: (key: PanelWidthKey, width: number) => void
  showFileExtensions: boolean
  commandActions: CommandActionRegistry
  onOpenAiSettings: () => void
  editor: NoteEditorController
  textEditor: TextFileEditorController
  noteIndex: NoteIndexController
  vaultSession: VaultSessionController
  noteActions: NoteActionsController
  editorInteractions: EditorInteractionsController
  editorTabs: WorkbenchController
  readingZoom: ReadingZoomController
  starterProofProjectRoot: string | null
  onConsumeStarterProofConsent: (projectRoot: string) => void
  knowledge: KnowledgeUtilitiesController
  activeRightPanel: KnowledgePanelId
  propertyAddRequest: number
  setRightPanelOpen: Dispatch<SetStateAction<boolean>>
  setActiveRightPanel: Dispatch<SetStateAction<KnowledgePanelId>>
  onOpenSearch: (query: string) => void
  onCreateNoteInFolder: (directoryPath: string) => void
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
  readingFullView,
  aiPanelOpen,
  leftPanelOpen,
  rightPanelOpen,
  density,
  uiScale,
  panelWidths,
  onPanelWidthChange,
  showFileExtensions,
  commandActions,
  onOpenAiSettings,
  editor,
  textEditor,
  noteIndex,
  vaultSession,
  noteActions,
  editorInteractions,
  editorTabs,
  readingZoom,
  starterProofProjectRoot,
  onConsumeStarterProofConsent,
  knowledge,
  activeRightPanel,
  propertyAddRequest,
  setRightPanelOpen,
  setActiveRightPanel,
  onOpenSearch,
  onCreateNoteInFolder,
  onAddBookmark,
  onNavigateWithSubpath,
  onRequestDelete,
  onError
}: AppLayoutProps): React.JSX.Element {
  const { t } = useI18n()
  const gridRef = useRef<HTMLElement>(null)
  const viewportWidth = useWorkspaceViewportWidth()
  const layoutMode = resolveWorkspaceLayoutMode(viewportWidth)
  const dockPolicy = resolveDockPolicy({
    widths: panelWidths,
    mode: layoutMode,
    viewportWidth,
    remPx: (16 * uiScale) / 100,
    leftPanelOpen,
    rightPanelOpen,
    aiPanelOpen
  })
  const fittedPanelWidths = dockPolicy.widths
  const effectiveLeftOpen = leftPanelOpen && !dockPolicy.collapsedLeft
  const [explorerRevealRequest, setExplorerRevealRequest] = useState<{
    path: string
    requestId: number
  } | null>(null)
  const [compileState, setCompileState] = useState<{
    path: string
    status: 'pending' | 'error' | 'ready'
  } | null>(null)
  const previousDocks = useRef({ left: leftPanelOpen, right: rightPanelOpen, ai: aiPanelOpen })
  const dockReturnFocus = useRef<{
    left: HTMLElement | null
    right: HTMLElement | null
    ai: HTMLElement | null
  }>({
    left: null,
    right: null,
    ai: null
  })
  useEffect(() => {
    const previous = previousDocks.current
    for (const [key, open, panelId] of [
      ['left', leftPanelOpen && effectiveLeftOpen, 'workspace-left-panel'],
      ['right', rightPanelOpen, 'supplementary-context-panel'],
      ['ai', aiPanelOpen, 'supplementary-ai-panel']
    ] as const) {
      if (open && !previous[key]) {
        dockReturnFocus.current[key] =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        document.getElementById(panelId)?.focus({ preventScroll: true })
      } else if (!open && previous[key] && (key !== 'left' || !leftPanelOpen)) {
        const previousFocus = dockReturnFocus.current[key]
        if (previousFocus?.isConnected && previousFocus.getClientRects().length > 0)
          previousFocus.focus({ preventScroll: true })
        else
          document
            .querySelector<HTMLElement>('[data-document-surface]')
            ?.focus({ preventScroll: true })
      }
    }
    previousDocks.current = { left: leftPanelOpen, right: rightPanelOpen, ai: aiPanelOpen }
  }, [leftPanelOpen, effectiveLeftOpen, rightPanelOpen, aiPanelOpen])

  useEffect(() => {
    if (!leftPanelOpen && !rightPanelOpen && !aiPanelOpen) return
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = document.activeElement
      if (aiPanelOpen && document.getElementById('supplementary-ai-panel')?.contains(target)) {
        event.preventDefault()
        void commandActions.dispatch('ai.toggle')
      } else if (
        rightPanelOpen &&
        document.getElementById('supplementary-context-panel')?.contains(target)
      ) {
        event.preventDefault()
        setRightPanelOpen(false)
      } else if (
        leftPanelOpen &&
        document.getElementById('workspace-left-panel')?.contains(target)
      ) {
        event.preventDefault()
        void commandActions.dispatch('view.toggle-left-panel')
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [leftPanelOpen, rightPanelOpen, aiPanelOpen, commandActions, setRightPanelOpen])
  const noteSelected = selectedNotePath !== null
  const textSelected = selectedVaultPath !== null && textEditor.selectedPath === selectedVaultPath
  const activeEditor = textSelected ? textEditor : editor
  const activeEditorPath = selectedNotePath ?? (textSelected ? textEditor.selectedPath : null)
  const activeEditorAvailable = noteSelected || textSelected
  const activeIsDirty = activeEditorAvailable ? activeEditor.isDirty : false
  const activeIsLoading = activeEditorAvailable ? activeEditor.isLoadingFile : false
  const activeIsSaving = activeEditorAvailable ? activeEditor.isSaving : false
  const activeLastSavedAt = activeEditorAvailable ? activeEditor.lastSavedAt : null
  const localGraphContext = resolveLocalGraphContext(editorTabs.activeItem)
  const livingOutline = useLivingOutline({
    sessionId: editorTabs.state.sessionId,
    selectedPath: selectedNotePath,
    editorPath: editor.selectedPath,
    source: editor.content,
    indexedHeadings: noteIndex.outlineHeadings,
    viewMode,
    cursorOffset: editorInteractions.editorSelection?.head ?? null
  })
  const gridTemplateColumns = workspaceGridTemplate({
    mode: layoutMode,
    leftPanelOpen: effectiveLeftOpen,
    rightPanelOpen,
    aiPanelOpen,
    readingFullView,
    widths: fittedPanelWidths
  })
  const bookmarkHeading = useCallback(
    (heading: NoteHeadingResult): void => {
      if (!selectedNotePath) return
      void onAddBookmark(
        { kind: 'heading', relativePath: selectedNotePath, heading: heading.text },
        heading.text
      )
    },
    [selectedNotePath, onAddBookmark]
  )

  return (
    <>
      <a
        href="#workspace"
        className="app-no-drag sr-only fixed top-2 left-2 z-[60] rounded-sm border border-border bg-background px-3 py-2 font-sans text-sm font-semibold text-foreground shadow-[var(--shadow-hard-sm)] focus:not-sr-only focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t('app.skipToWorkspace')}
      </a>
      {readingFullView ? null : (
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
      )}

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-12 left-1/2 z-[70] max-w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-destructive bg-popover px-4 py-2 font-sans text-sm font-medium text-destructive shadow-[var(--shadow-hard-sm)]"
        >
          {error}
        </div>
      ) : null}

      <main
        ref={gridRef}
        id="workspace"
        tabIndex={-1}
        data-reading-full-view={readingFullView ? 'active' : undefined}
        data-layout-mode={layoutMode}
        className="relative grid min-h-0 flex-1 overflow-hidden bg-background"
        style={{ gridTemplateColumns }}
      >
        <Activity mode={effectiveLeftOpen && !readingFullView ? 'visible' : 'hidden'}>
          <div
            id="workspace-left-panel"
            role="region"
            aria-label="Vault explorer dock"
            data-workspace-dock="left"
            tabIndex={-1}
            data-panel-width="leftPanelWidth"
            className="min-h-0 min-w-0 overflow-hidden border-r border-border bg-chrome"
          >
            <LeftPanel
              density={density}
              showFileExtensions={showFileExtensions}
              vault={vault}
              selectedPath={selectedVaultPath}
              noteIndex={noteIndex}
              vaultSession={vaultSession}
              commandActions={commandActions}
              revealRequest={explorerRevealRequest}
              onCreateNoteInFolder={onCreateNoteInFolder}
              onRequestDelete={onRequestDelete}
              onAddBookmark={onAddBookmark}
            />
          </div>
        </Activity>
        {effectiveLeftOpen && !readingFullView ? (
          <PanelSeparator
            panel="leftPanelWidth"
            width={fittedPanelWidths.leftPanelWidth}
            gridRef={gridRef}
            onCommit={onPanelWidthChange}
            documentFloor={dockPolicy.documentFloor}
          />
        ) : null}
        <MainEditor
          showFileExtensions={showFileExtensions}
          hasVault={vault !== null}
          viewMode={viewMode}
          readingFullView={readingFullView}
          selectedPath={selectedVaultPath}
          editorTabs={editorTabs}
          commandActions={commandActions}
          editor={editor}
          textEditor={textEditor}
          noteIndex={noteIndex}
          noteActions={noteActions}
          editorInteractions={editorInteractions}
          onReadingActiveHeadingChange={livingOutline.handleReadingActiveHeadingChange}
          onReadingCompileStateChange={(path, status) =>
            setCompileState((current) =>
              current?.path === path && current.status === status ? current : { path, status }
            )
          }
          readingZoom={readingZoom}
          vaultTreeFiles={vault?.treeFiles ?? []}
          starterProofProjectRoot={starterProofProjectRoot}
          onConsumeStarterProofConsent={onConsumeStarterProofConsent}
          onCopyPath={(relativePath) => void vaultSession.handleCopyPath(relativePath)}
          onCopyRelativePath={(relativePath) =>
            void vaultSession.handleCopyRelativePath(relativePath)
          }
          onRevealInExplorer={(relativePath) =>
            void vaultSession.handleRevealInExplorer(relativePath)
          }
          onBookmarkNote={(relativePath, title) =>
            onAddBookmark({ kind: 'file', relativePath }, title)
          }
          onError={onError}
        />
        {rightPanelOpen && !readingFullView ? (
          <PanelSeparator
            panel="rightPanelWidth"
            width={fittedPanelWidths.rightPanelWidth}
            gridRef={gridRef}
            onCommit={onPanelWidthChange}
            documentFloor={dockPolicy.documentFloor}
          />
        ) : null}
        <ResponsiveSupplementaryDock
          gridRef={gridRef}
          panelWidths={fittedPanelWidths}
          onPanelWidthChange={onPanelWidthChange}
          mode={layoutMode}
          contextOpen={rightPanelOpen && !readingFullView}
          aiOpen={aiPanelOpen && !readingFullView}
          contextPanel={
            <RightPanel
              hasVault={vault !== null}
              vaultSessionId={editorTabs.state.sessionId}
              activePanel={activeRightPanel}
              selectedPath={selectedNotePath}
              localGraphRoot={localGraphContext.rootRelativePath}
              localGraphUnavailableReason={localGraphContext.unavailableReason}
              source={editor.savedContent}
              isDirty={editor.isDirty}
              propertyAddRequest={propertyAddRequest}
              noteIndex={noteIndex}
              outlineHeadings={livingOutline.headings}
              activeHeadingId={livingOutline.activeHeadingId}
              knowledge={knowledge}
              onActivePanelChange={setActiveRightPanel}
              onSelectHeading={(heading) => {
                editorInteractions.revealHeading(heading)
                if (layoutMode !== 'wide') setRightPanelOpen(false)
              }}
              onBookmarkHeading={bookmarkHeading}
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
              onBookmarkNote={(relativePath, title) =>
                onAddBookmark({ kind: 'file', relativePath }, title)
              }
              onCopyRelativePath={(relativePath) =>
                void vaultSession.handleCopyRelativePath(relativePath)
              }
              onRevealInExplorer={(relativePath) =>
                void vaultSession.handleRevealInExplorer(relativePath)
              }
            />
          }
          aiPanel={
            <AiSidePanel
              noteRelativePath={selectedNotePath}
              noteTitle={selectedNotePath ? deriveNoteTitle(selectedNotePath) : 'No note'}
              noteContent={selectedNotePath ? editor.content : ''}
              selection={editorInteractions.selectionForAssistant}
              backlinks={noteIndex.backlinks.map((entry) => ({
                relativePath: entry.source.relativePath,
                display: entry.display
              }))}
              onApprovedPatch={(input) =>
                completeInteractiveAiHandoff(input, {
                  refreshVaultSnapshot: vaultSession.refreshVaultSnapshot,
                  getSelectedNotePath: () => editor.selectedPathRef.current,
                  readFile: window.vaultApi.readFile,
                  restoreNoteBuffer: editor.restoreFileBuffer,
                  openOrActivate: editorTabs.openOrActivate
                }).then(() => undefined)
              }
              onRequestActionPalette={editorInteractions.openAiPalette}
              onOpenAiSettings={onOpenAiSettings}
            />
          }
        />
      </main>

      {readingFullView ? null : (
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
          viewMode={noteSelected ? viewMode : null}
          compileStatus={
            selectedNotePath && viewMode === 'reading'
              ? compileState?.path === selectedNotePath
                ? compileState.status
                : 'pending'
              : null
          }
          cursorPosition={
            ((noteSelected && viewMode !== 'reading') || textSelected) &&
            editorInteractions.editorSelection
              ? {
                  line: editorInteractions.editorSelection.headLine,
                  column: editorInteractions.editorSelection.headColumn + 1
                }
              : null
          }
          readingZoomFactor={
            selectedNotePath && viewMode === 'reading' ? readingZoom.factor : undefined
          }
          onToggleLeftPanel={() => void commandActions.dispatch('view.toggle-left-panel')}
          onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
          onToggleAiPanel={() => void commandActions.dispatch('ai.toggle')}
          onResetReadingZoom={() => void commandActions.dispatch('view.zoom-reset')}
        />
      )}
    </>
  )
}
