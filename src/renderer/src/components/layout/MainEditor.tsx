import { Save } from 'lucide-react'
import { useCallback, useState } from 'react'
import { AiSelectionActionPalette } from '@/ai/panels/AiSelectionActionPalette'
import type { CommandActionRegistry } from '@/commands/actions'
import { EmptyState } from '@/components/EmptyState'
import { EditorHeader } from '@/components/layout/EditorHeader'
import { EditorTabs } from '@/components/layout/EditorTabs'
import { NoVaultFilePreview, VaultImagePreview } from '@/components/layout/VaultFilePreview'
import { type ViewMode, ViewModeToggle } from '@/components/ViewModeToggle'
import type { GotoDefinitionTarget } from '@/editor/goto-definition'
import { MdxEditor } from '@/editor/MdxEditor'
import { TextFileEditor } from '@/editor/TextFileEditor'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import { usePhysicalZoomModifier } from '@/hooks/usePhysicalZoomModifier'
import type { ReadingZoomController } from '@/hooks/useReadingZoom'
import type { TextFileEditorController } from '@/hooks/useTextFileEditor'
import type { WorkbenchController } from '@/hooks/useWorkbench'
import { MdxPreview } from '@/preview/MdxPreview'
import { resolvePreviewImageSource } from '@/preview/preview-image'
import { isEditableTextPath, isNotePath, isPreviewableVaultImagePath } from '@/vault/file-kind'
import { resolveWikilinkTarget } from '../../../../shared/wikilinks'

interface MainEditorProps {
  viewMode: ViewMode
  selectedPath: string | null
  editorTabs: WorkbenchController
  commandActions: CommandActionRegistry
  editor: NoteEditorController
  textEditor: TextFileEditorController
  noteIndex: NoteIndexController
  noteActions: NoteActionsController
  editorInteractions: EditorInteractionsController
  readingZoom: ReadingZoomController
  onRevealInExplorer: (relativePath: string) => void
  onError: (message: string | null) => void
}

export function MainEditor({
  viewMode,
  selectedPath,
  editorTabs,
  commandActions,
  editor,
  textEditor,
  noteIndex,
  noteActions,
  editorInteractions,
  readingZoom,
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
  const textSelected = isEditableTextPath(selectedPath)
  const activeItem = editorTabs.activeItem
  const activeItemMissing = activeItem?.id === selectedPath && activeItem.missing
  const selectedImageMetadata = imageMetadata?.relativePath === selectedPath ? imageMetadata : null
  const { isDarwin, isPhysicalModifierDown } = usePhysicalZoomModifier()
  const { factor: readingZoomFactor, adjustFromWheel: adjustReadingZoomFromWheel } = readingZoom

  const handleNavigateDefinition = useCallback(
    (target: GotoDefinitionTarget): void => {
      if (target.type === 'component') {
        return
      }

      if (target.type === 'wikilink') {
        const resolvedNote = resolveWikilinkTarget(noteIndex.indexNotes, target.value)
        if (!resolvedNote) {
          onError(`Wikilink target not found: [[${target.value}]]`)
          return
        }

        onError(null)
        noteActions.navigateToNote(resolvedNote.relativePath)
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
      noteActions.navigateToNote,
      noteActions.navigateToVaultFile,
      noteIndex.indexNotes,
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
      className="flex min-h-0 min-w-0 flex-col border-r-2 border-foreground bg-background"
    >
      <EditorTabs
        items={editorTabs.tabs}
        activeId={editorTabs.activePath}
        onActivate={(relativePath) => void editorTabs.openOrActivate(relativePath)}
        onClose={(relativePath) =>
          commandActions.dispatch('workbench.close-item', { id: relativePath })
        }
      />
      <EditorHeader selectedPath={selectedPath}>
        {noteSelected ? (
          <ViewModeToggle
            value={viewMode}
            onChange={(mode) => void commandActions.dispatch(`view.${mode}`)}
          />
        ) : selectedPath ? (
          <span className="px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground tabular-nums">
            {imageSelected && selectedImageMetadata
              ? `${selectedImageMetadata.width} × ${selectedImageMetadata.height} px`
              : textSelected
                ? `${getFileExtension(selectedPath)} · Editable`
                : 'Read only'}
          </span>
        ) : null}
      </EditorHeader>
      {activeItemMissing ? (
        <div
          role="status"
          className="shrink-0 border-b border-destructive bg-destructive/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-destructive"
        >
          File deleted outside mdx-vault · Session content is preserved · Autosave paused
        </div>
      ) : null}
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
                commandActions={commandActions.actions}
                insertRequest={noteActions.editorInsertRequest}
                revealLineRequest={editorInteractions.revealLineRequest}
                onSelectionChange={editorInteractions.handleEditorSelectionChange}
                onCommandError={onError}
                onNavigateToNote={noteActions.navigateToNote}
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
        ) : textSelected ? (
          textEditor.isLoadingFile ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading file…
            </div>
          ) : textEditor.selectedPath !== selectedPath ? (
            <NoVaultFilePreview
              relativePath={selectedPath}
              onRevealInExplorer={() => onRevealInExplorer(selectedPath)}
            />
          ) : (
            <TextFileEditor
              key={selectedPath}
              relativePath={selectedPath}
              value={textEditor.content}
              onChange={textEditor.setContent}
            />
          )
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

function getFileExtension(relativePath: string): string {
  const extension = relativePath.split('.').at(-1)
  return extension ? `.${extension.toLowerCase()}` : 'Text'
}
