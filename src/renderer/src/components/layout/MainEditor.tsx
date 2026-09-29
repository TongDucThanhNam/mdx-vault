import { Blocks, Save } from 'lucide-react'
import { lazy, Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react'
import { AiSelectionActionPalette } from '@/ai/panels/AiSelectionActionPalette'
import type { CommandActionRegistry } from '@/commands/actions'
import { EmptyState } from '@/components/EmptyState'
import { EditorHeader } from '@/components/layout/EditorHeader'
import { EditorTabs } from '@/components/layout/EditorTabs'
import { NoVaultFilePreview, VaultImagePreview } from '@/components/layout/VaultFilePreview'
import { WorkspaceStart } from '@/components/layout/WorkspaceStart'
import { Button } from '@/components/ui/button'
import { type ViewMode, ViewModeToggle } from '@/components/ViewModeToggle'
import { EditorAppearance } from '@/editor/EditorAppearance'
import type { GotoDefinitionTarget } from '@/editor/goto-definition'
import { MdxEditor } from '@/editor/MdxEditor'
import { GraphLoadingSurface } from '@/graph/GraphLoadingSurface'
import { loadGraphSurface } from '@/graph/load-graph-surface'
import { useGraphPreload } from '@/graph/useGraphPreload'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import { usePhysicalZoomModifier } from '@/hooks/usePhysicalZoomModifier'
import type { ReadingZoomController } from '@/hooks/useReadingZoom'
import type { TextFileEditorController } from '@/hooks/useTextFileEditor'
import type { WorkbenchController } from '@/hooks/useWorkbench'
import { useI18n } from '@/i18n/useI18n'
import { formatError } from '@/lib/format-error'
import { MdxPreview } from '@/preview/MdxPreview'
import { resolvePreviewImageSource } from '@/preview/preview-image'
import { isEditableTextPath, isNotePath, isPreviewableVaultImagePath } from '@/vault/file-kind'
import type { VaultTreeFile } from '@/vault/types'
import { focusAfterViewModeSwitch } from '@/workbench/document-focus'
import { resolveInteractiveProjectPath } from '../../../../shared/interactive-authoring'
import {
  formatWikilinkSubpath,
  parseWikilinkTarget,
  resolveWikilinkHeading,
  resolveWikilinkTarget,
  type WikilinkSubpath
} from '../../../../shared/wikilinks'

const LazyGraphSurface = lazy(async () => {
  const module = await loadGraphSurface()
  return { default: module.GraphSurface }
})
const loadTextFileEditor = () => import('@/editor/TextFileEditor')
const loadInteractiveProofWorkbench = () => import('@/interactive/InteractiveProofWorkbench')
const LazyTextFileEditor = lazy(async () => ({
  default: (await loadTextFileEditor()).TextFileEditor
}))
const LazyInteractiveProofWorkbench = lazy(async () => ({
  default: (await loadInteractiveProofWorkbench()).InteractiveProofWorkbench
}))

interface MainEditorProps {
  hasVault: boolean
  showFileExtensions: boolean
  viewMode: ViewMode
  readingFullView: boolean
  selectedPath: string | null
  editorTabs: WorkbenchController
  commandActions: CommandActionRegistry
  editor: NoteEditorController
  textEditor: TextFileEditorController
  noteIndex: NoteIndexController
  noteActions: NoteActionsController
  editorInteractions: EditorInteractionsController
  onReadingActiveHeadingChange: (headingId: string | null) => void
  onReadingCompileStateChange: (path: string, status: 'pending' | 'error' | 'ready') => void
  readingZoom: ReadingZoomController
  vaultTreeFiles: readonly VaultTreeFile[]
  starterProofProjectRoot: string | null
  onConsumeStarterProofConsent: (projectRoot: string) => void
  onCopyPath: (relativePath: string) => void
  onCopyRelativePath: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
  onBookmarkNote: (relativePath: string, title: string) => void | Promise<void>
  onError: (message: string | null) => void
}

export function MainEditor({
  hasVault,
  showFileExtensions,
  viewMode,
  readingFullView,
  selectedPath,
  editorTabs,
  commandActions,
  editor,
  textEditor,
  noteIndex,
  noteActions,
  editorInteractions,
  onReadingActiveHeadingChange,
  onReadingCompileStateChange,
  readingZoom,
  vaultTreeFiles,
  starterProofProjectRoot,
  onConsumeStarterProofConsent,
  onCopyPath,
  onCopyRelativePath,
  onRevealInExplorer,
  onBookmarkNote,
  onError
}: MainEditorProps): React.JSX.Element {
  useGraphPreload()
  const { t } = useI18n()
  const [imageMetadata, setImageMetadata] = useState<{
    relativePath: string
    width: number
    height: number
  } | null>(null)
  const interactiveProjectPath = selectedPath ? resolveInteractiveProjectPath(selectedPath) : null
  const noteSelected = isNotePath(selectedPath) && !interactiveProjectPath
  const imageSelected = isPreviewableVaultImagePath(selectedPath)
  const textSelected = isEditableTextPath(selectedPath) || interactiveProjectPath?.kind === 'readme'
  const activeItem = editorTabs.activeItem
  const activeItemMissing = activeItem?.id === selectedPath && activeItem.missing
  const selectedImageMetadata = imageMetadata?.relativePath === selectedPath ? imageMetadata : null
  const { isDarwin, isPhysicalModifierDown } = usePhysicalZoomModifier()
  const lastEditableModeRef = useRef<'source' | 'live'>('live')
  const previousSurfaceRef = useRef<{ path: string | null; mode: ViewMode } | null>(null)
  const committedModeRef = useRef<ViewMode | null>(null)
  const readingAnchorRef = useRef<number | null>(null)
  const explicitRevealRef = useRef(false)
  const currentSurfaceRef = useRef({ path: selectedPath, mode: viewMode })
  currentSurfaceRef.current = { path: selectedPath, mode: viewMode }
  if (viewMode !== 'reading') lastEditableModeRef.current = viewMode
  if (
    previousSurfaceRef.current?.path === selectedPath &&
    previousSurfaceRef.current.mode !== 'reading' &&
    viewMode === 'reading'
  ) {
    readingAnchorRef.current = editorInteractions.editorSelection?.head ?? 0
    explicitRevealRef.current = false
  } else if (previousSurfaceRef.current?.path !== selectedPath) {
    readingAnchorRef.current = null
    explicitRevealRef.current = false
  }
  previousSurfaceRef.current = { path: selectedPath, mode: viewMode }
  useLayoutEffect(() => {
    focusAfterViewModeSwitch(committedModeRef.current, viewMode)
    committedModeRef.current = viewMode
  }, [viewMode])
  const { factor: readingZoomFactor, adjustFromWheel: adjustReadingZoomFromWheel } = readingZoom

  const revealFromReading = useCallback(
    (line: number): void => {
      explicitRevealRef.current = true
      void commandActions.dispatch(`view.${lastEditableModeRef.current}`)
      window.setTimeout(() => editorInteractions.revealEditorLine(line), 0)
    },
    [commandActions, editorInteractions]
  )

  const leaveReading = useCallback(
    (path: string, line: number): void => {
      if (
        currentSurfaceRef.current.path !== path ||
        currentSurfaceRef.current.mode === 'reading' ||
        explicitRevealRef.current
      )
        return
      window.setTimeout(() => editorInteractions.revealEditorLine(line), 0)
    },
    [editorInteractions]
  )

  const handleNavigateWikilink = useCallback(
    async (relativePath: string, subpath?: WikilinkSubpath | null): Promise<void> => {
      onError(null)

      try {
        const opened = await noteActions.navigateToNote(relativePath)

        if (!opened || subpath?.kind !== 'heading') {
          return
        }

        const headings = await window.indexApi.headingsOfNote(relativePath)
        const heading = resolveWikilinkHeading(headings, subpath)

        if (!heading) {
          onError(`Heading not found: ${relativePath}${formatWikilinkSubpath(subpath)}`)
          return
        }

        editorInteractions.revealHeading(heading)
      } catch (error) {
        onError(formatError(error))
      }
    },
    [editorInteractions, noteActions.navigateToNote, onError]
  )

  const handleNavigateDefinition = useCallback(
    (target: GotoDefinitionTarget): void => {
      if (target.type === 'component') {
        return
      }

      if (target.type === 'wikilink') {
        const reference = parseWikilinkTarget(target.value)
        const resolvedNote = resolveWikilinkTarget(
          noteIndex.indexNotes,
          target.value,
          selectedPath ?? undefined
        )
        if (!resolvedNote) {
          onError(`Wikilink target not found: [[${target.value}]]`)
          return
        }

        void handleNavigateWikilink(resolvedNote.relativePath, reference?.subpath)
        return
      }

      const resolvedPath = resolvePreviewImageSource(selectedPath, target.value)
      if (resolvedPath.kind !== 'vault') {
        const detail =
          resolvedPath.kind === 'error'
            ? resolvedPath.message
            : 'External URLs do not have vault definitions'
        onError(`Cannot open ${target.value}: ${detail}`)
        return
      }

      onError(null)
      noteActions.navigateToVaultFile(resolvedPath.relativePath)
    },
    [
      noteActions.navigateToVaultFile,
      noteIndex.indexNotes,
      handleNavigateWikilink,
      onError,
      selectedPath
    ]
  )

  return (
    <section
      aria-label="Document"
      data-document-surface="active"
      data-reading-surface={noteSelected && viewMode === 'reading' ? 'active' : undefined}
      tabIndex={-1}
      className="flex min-h-0 min-w-0 flex-col bg-background outline-none"
    >
      {readingFullView ? null : (
        <>
          <EditorTabs
            showFileExtensions={showFileExtensions}
            visiblePaths={vaultTreeFiles.map((file) => file.relativePath)}
            items={editorTabs.tabs}
            activeId={editorTabs.activeId}
            onActivate={(relativePath) => void editorTabs.openOrActivate(relativePath)}
            onClose={(relativePath) =>
              commandActions.dispatch('workbench.close-item', { id: relativePath })
            }
            onCloseItems={editorTabs.closeItems}
            onCopyPath={onCopyPath}
            onCopyRelativePath={onCopyRelativePath}
            onRevealInExplorer={onRevealInExplorer}
            closeShortcut={commandActions.getAction('workbench.close-item')?.hotkeys?.[0]}
          />
          {activeItem?.kind === 'graph' ? null : (
            <EditorHeader
              selectedPath={selectedPath}
              showFileExtensions={showFileExtensions}
              visiblePaths={vaultTreeFiles.map((file) => file.relativePath)}
            >
              {(noteSelected && viewMode !== 'reading') || textSelected ? (
                <EditorAppearance live={noteSelected && viewMode === 'live'} />
              ) : null}
              {noteSelected ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t('editor.newInteractive')}
                    title={t('editor.newInteractive')}
                    disabled={commandActions.getAction('interactive.create')?.disabled}
                    onClick={() => void commandActions.dispatch('interactive.create')}
                  >
                    <Blocks aria-hidden="true" />
                  </Button>
                  <ViewModeToggle
                    value={viewMode}
                    onChange={(mode) => void commandActions.dispatch(`view.${mode}`)}
                  />
                </>
              ) : selectedPath ? (
                <span className="px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground tabular-nums">
                  {imageSelected && selectedImageMetadata
                    ? `${selectedImageMetadata.width} × ${selectedImageMetadata.height} px`
                    : textSelected
                      ? `${getFileExtension(selectedPath)} · Editable`
                      : 'Read only'}
                </span>
              ) : null}
            </EditorHeader>
          )}
        </>
      )}
      {activeItemMissing && !readingFullView ? (
        <div
          role="status"
          className="shrink-0 border-b border-destructive bg-destructive/10 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-destructive"
        >
          File deleted outside mdx-vault · Session content is preserved · Autosave paused
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          {activeItem?.kind === 'graph' ? (
            <Suspense fallback={<GraphLoadingSurface />}>
              <LazyGraphSurface
                mode="global"
                vaultSessionId={editorTabs.state.sessionId}
                hasVault={hasVault}
                onOpenNote={(relativePath) => noteActions.navigateToNote(relativePath)}
                onBookmarkNote={onBookmarkNote}
                onCopyRelativePath={onCopyRelativePath}
                onRevealInExplorer={onRevealInExplorer}
              />
            </Suspense>
          ) : noteSelected ? (
            editor.isLoadingFile ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading file…
              </div>
            ) : editor.selectedPath !== selectedPath ? (
              <EmptyState
                icon={<Save className="size-5" aria-hidden="true" />}
                title={t('empty.noteUnavailable.title')}
                description={t('empty.noteUnavailable.description')}
              />
            ) : viewMode === 'reading' ? (
              <MdxPreview
                key={selectedPath}
                source={editor.content}
                selectedPath={selectedPath}
                readingZoomFactor={readingZoomFactor}
                notes={noteIndex.indexNotes}
                revealHeadingRequest={editorInteractions.previewHeadingRequest}
                onActiveHeadingChange={onReadingActiveHeadingChange}
                onNavigate={handleNavigateWikilink}
                onRevealLine={revealFromReading}
                initialSourceOffset={readingAnchorRef.current}
                onLeaveReading={(line) => leaveReading(selectedPath, line)}
                onCompileStateChange={(status) => onReadingCompileStateChange(selectedPath, status)}
                isDarwin={isDarwin}
                isPhysicalZoomModifierDown={isPhysicalModifierDown}
                onReadingZoomWheel={adjustReadingZoomFromWheel}
                onSourceChange={editor.setContent}
              />
            ) : (
              <>
                <MdxEditor
                  value={editor.content}
                  onChange={editor.setContent}
                  displayMode={viewMode}
                  notes={noteIndex.indexNotes}
                  sourceRelativePath={selectedPath}
                  commandActions={commandActions.actions}
                  insertRequest={noteActions.editorInsertRequest}
                  revealLineRequest={editorInteractions.revealLineRequest}
                  revealSourceRangeRequest={editorInteractions.revealSourceRangeRequest}
                  onSelectionChange={editorInteractions.handleEditorSelectionChange}
                  onCommandError={onError}
                  onNavigateToNote={handleNavigateWikilink}
                  onNavigateDefinition={handleNavigateDefinition}
                  onSaveImage={editor.handleSaveImage}
                />
                <AiSelectionActionPalette
                  open={editorInteractions.aiPaletteOpen}
                  position={editorInteractions.aiPalettePosition}
                  selectedText={editorInteractions.editorSelection?.text ?? ''}
                  hasSelection={editorInteractions.editorSelection?.hasSelection ?? false}
                  onClose={() => editorInteractions.setAiPaletteOpen(false)}
                  onPickAction={editorInteractions.handleAiActionPicked}
                />
              </>
            )
          ) : imageSelected && !activeItemMissing && editorTabs.activeImageObjectUrl ? (
            <VaultImagePreview
              key={`${selectedPath}:${editorTabs.activeImageObjectUrl}`}
              relativePath={selectedPath}
              objectUrl={editorTabs.activeImageObjectUrl}
              onDimensionsChange={({ width, height }) =>
                setImageMetadata({ relativePath: selectedPath, width, height })
              }
              onRevealInExplorer={() => onRevealInExplorer(selectedPath)}
            />
          ) : selectedPath && textSelected ? (
            textEditor.isLoadingFile ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading file…
              </div>
            ) : textEditor.selectedPath !== selectedPath ? (
              <NoVaultFilePreview
                relativePath={selectedPath}
                onRevealInExplorer={() => onRevealInExplorer(selectedPath)}
              />
            ) : interactiveProjectPath && !activeItemMissing ? (
              <Suspense fallback={null}>
                <LazyInteractiveProofWorkbench
                  activeRelativePath={selectedPath}
                  value={textEditor.content}
                  savedContent={textEditor.savedContent}
                  treeFiles={vaultTreeFiles}
                  vaultSessionId={editorTabs.state.sessionId}
                  starterConsented={starterProofProjectRoot === interactiveProjectPath.projectRoot}
                  onConsumeStarterConsent={() =>
                    onConsumeStarterProofConsent(interactiveProjectPath.projectRoot)
                  }
                  onChange={textEditor.setContent}
                  onSave={textEditor.saveCurrentFile}
                  onOpenFile={editorTabs.openOrActivate}
                  getSavedContent={() => textEditor.savedContentRef.current}
                  onRevealProject={onRevealInExplorer}
                />
              </Suspense>
            ) : (
              <Suspense fallback={null}>
                <LazyTextFileEditor
                  key={selectedPath}
                  relativePath={selectedPath}
                  value={textEditor.content}
                  onChange={textEditor.setContent}
                  onSelectionChange={editorInteractions.handleEditorSelectionChange}
                />
              </Suspense>
            )
          ) : selectedPath ? (
            <NoVaultFilePreview
              relativePath={selectedPath}
              onRevealInExplorer={() => onRevealInExplorer(selectedPath)}
            />
          ) : hasVault ? (
            <WorkspaceStart emptyVault={vaultTreeFiles.length === 0} actions={commandActions} />
          ) : (
            <EmptyState
              icon={<Save className="size-5" aria-hidden="true" />}
              title={t('empty.selectFile.title')}
              description={t('empty.selectFile.description')}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function getFileExtension(relativePath: string): string {
  const extension = relativePath.split('.').at(-1)
  return extension ? `.${extension.toLowerCase()}` : 'Text'
}
