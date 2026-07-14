import { Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AiSelectionActionPalette } from '@/ai/panels/AiSelectionActionPalette'
import type { CommandAction } from '@/commands/actions'
import { EmptyState } from '@/components/EmptyState'
import { EditorHeader } from '@/components/layout/EditorHeader'
import { NoVaultFilePreview, VaultImagePreview } from '@/components/layout/VaultFilePreview'
import { type ViewMode, ViewModeToggle } from '@/components/ViewModeToggle'
import { MdxEditor } from '@/editor/MdxEditor'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import { useReadingZoomShortcuts } from '@/hooks/useKeyboardShortcuts'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import { usePhysicalZoomModifier } from '@/hooks/usePhysicalZoomModifier'
import { useReadingZoom } from '@/hooks/useReadingZoom'
import { MdxPreview } from '@/preview/MdxPreview'
import { isNotePath, isPreviewableVaultImagePath } from '@/vault/file-kind'

interface MainEditorProps {
  viewMode: ViewMode
  selectedPath: string | null
  commandActions: CommandAction[]
  editor: NoteEditorController
  noteIndex: NoteIndexController
  noteActions: NoteActionsController
  editorInteractions: EditorInteractionsController
  setViewMode: (mode: ViewMode) => void
  onReadingZoomStatusChange: (status: ReadingZoomStatus | null) => void
  onRevealInExplorer: (relativePath: string) => void
  onError: (message: string | null) => void
}

export interface ReadingZoomStatus {
  factor: number
  reset: () => void
}

export function MainEditor({
  viewMode,
  selectedPath,
  commandActions,
  editor,
  noteIndex,
  noteActions,
  editorInteractions,
  setViewMode,
  onReadingZoomStatusChange,
  onRevealInExplorer,
  onError
}: MainEditorProps): React.JSX.Element {
  const [imageMetadata, setImageMetadata] = useState<{
    relativePath: string
    width: number
    height: number
  } | null>(null)
  const noteSelected = isNotePath(selectedPath)
  const imageSelected = isPreviewableVaultImagePath(selectedPath)
  const selectedImageMetadata = imageMetadata?.relativePath === selectedPath ? imageMetadata : null
  const { isDarwin, isPhysicalModifierDown } = usePhysicalZoomModifier()
  const {
    factor: readingZoomFactor,
    adjustFromWheel: adjustReadingZoomFromWheel,
    zoomIn: zoomReadingIn,
    zoomOut: zoomReadingOut,
    reset: resetReadingZoom
  } = useReadingZoom()

  useReadingZoomShortcuts({
    enabled: noteSelected && viewMode === 'reading',
    onZoomIn: zoomReadingIn,
    onZoomOut: zoomReadingOut,
    onResetZoom: resetReadingZoom
  })

  useEffect(() => {
    onReadingZoomStatusChange({ factor: readingZoomFactor, reset: resetReadingZoom })
  }, [onReadingZoomStatusChange, readingZoomFactor, resetReadingZoom])

  useEffect(() => {
    return () => onReadingZoomStatusChange(null)
  }, [onReadingZoomStatusChange])

  return (
    <section
      aria-label="Document"
      className="flex min-h-0 min-w-0 flex-col border-r-2 border-foreground bg-card/50"
    >
      <EditorHeader selectedPath={selectedPath}>
        {noteSelected ? (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        ) : selectedPath ? (
          <span className="px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground tabular-nums">
            {imageSelected && selectedImageMetadata
              ? `${selectedImageMetadata.width} × ${selectedImageMetadata.height} px`
              : 'Read only'}
          </span>
        ) : null}
      </EditorHeader>
      <div className="relative min-h-0 flex-1">
        {noteSelected ? (
          editor.isLoadingFile ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading file…
            </div>
          ) : editor.selectedPath !== selectedPath ? (
            <EmptyState
              icon={<Save className="size-5" aria-hidden="true" />}
              title="Note unavailable"
              description="The selected note could not be opened."
            />
          ) : viewMode === 'reading' ? (
            <MdxPreview
              source={editor.content}
              selectedPath={selectedPath}
              readingZoomFactor={readingZoomFactor}
              notes={noteIndex.indexNotes}
              revealHeadingRequest={editorInteractions.previewHeadingRequest}
              onNavigate={noteActions.navigateToNote}
              onRevealLine={editorInteractions.revealEditorLine}
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
                commandActions={commandActions}
                insertRequest={noteActions.editorInsertRequest}
                revealLineRequest={editorInteractions.revealLineRequest}
                onSelectionChange={editorInteractions.handleEditorSelectionChange}
                onCommandError={onError}
                onNavigateToNote={noteActions.navigateToNote}
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
        ) : imageSelected ? (
          <VaultImagePreview
            key={selectedPath}
            relativePath={selectedPath}
            onDimensionsChange={({ width, height }) =>
              setImageMetadata({ relativePath: selectedPath, width, height })
            }
            onRevealInExplorer={() => onRevealInExplorer(selectedPath)}
          />
        ) : selectedPath ? (
          <NoVaultFilePreview
            relativePath={selectedPath}
            onRevealInExplorer={() => onRevealInExplorer(selectedPath)}
          />
        ) : (
          <EmptyState
            icon={<Save className="size-5" aria-hidden="true" />}
            title="Select a file"
            description="Choose a file in the vault to begin writing."
          />
        )}
      </div>
    </section>
  )
}
