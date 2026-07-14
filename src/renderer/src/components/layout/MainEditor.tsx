import { Save } from 'lucide-react'
import { useMemo } from 'react'
import { AiSelectionActionPalette } from '@/ai/panels/AiSelectionActionPalette'
import type { CommandAction } from '@/commands/actions'
import { EmptyState } from '@/components/EmptyState'
import { type ViewMode, ViewModeToggle } from '@/components/ViewModeToggle'
import { MdxEditor } from '@/editor/MdxEditor'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import { computeWordCount } from '@/lib/word-count'
import { MdxPreview } from '@/preview/MdxPreview'

interface MainEditorProps {
  viewMode: ViewMode
  commandActions: CommandAction[]
  editor: NoteEditorController
  noteIndex: NoteIndexController
  noteActions: NoteActionsController
  editorInteractions: EditorInteractionsController
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>
  onError: (message: string | null) => void
}

export function MainEditor({
  viewMode,
  commandActions,
  editor,
  noteIndex,
  noteActions,
  editorInteractions,
  setViewMode,
  onError
}: MainEditorProps): React.JSX.Element {
  const saveLabel = getSaveLabel({
    hasFile: editor.selectedPath !== null,
    isDirty: editor.isDirty,
    isSaving: editor.isSaving,
    lastSavedAt: editor.lastSavedAt
  })
  const wordCount = useMemo(() => computeWordCount(editor.content), [editor.content])

  return (
    <section
      aria-label="Document"
      className="flex min-h-0 min-w-0 flex-col border-r-2 border-foreground bg-card/50"
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b-2 border-foreground bg-[var(--paper-dark)] px-4">
        <div className="min-w-0 truncate font-mono text-[12px] font-medium tracking-tight">
          {editor.selectedPath ?? 'No file selected'}
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewMode} disabled={!editor.selectedPath} />
      </div>

      <div className="relative min-h-0 flex-1">
        {editor.selectedPath ? (
          editor.isLoadingFile ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading file…
            </div>
          ) : viewMode === 'reading' ? (
            <MdxPreview
              source={editor.content}
              selectedPath={editor.selectedPath}
              notes={noteIndex.indexNotes}
              revealHeadingRequest={editorInteractions.previewHeadingRequest}
              onNavigate={noteActions.navigateToNote}
              onRevealLine={editorInteractions.revealEditorLine}
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
        ) : (
          <EmptyState
            icon={<Save className="size-5" aria-hidden="true" />}
            title="Select a note"
            description="Choose a file in the vault to begin writing."
          />
        )}
      </div>

      <div
        className="flex h-8 shrink-0 items-center justify-end gap-3 border-t-2 border-foreground bg-[var(--paper-dark)] px-4 font-mono text-[10px] uppercase tracking-wider tabular-nums text-muted-foreground"
        aria-live="polite"
      >
        {editor.selectedPath ? (
          <span title="Word / character count and estimated reading time">
            {wordCount.words} words · {wordCount.chars} chars · {wordCount.readingMinutes} min read
          </span>
        ) : null}
        <span>{editor.isLoadingFile ? 'Loading…' : saveLabel}</span>
      </div>
    </section>
  )
}

function getSaveLabel({
  hasFile,
  isDirty,
  isSaving,
  lastSavedAt
}: {
  hasFile: boolean
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
}): string {
  if (!hasFile) {
    return 'No file'
  }

  if (isSaving) {
    return 'Saving…'
  }

  if (isDirty) {
    return 'Unsaved'
  }

  if (lastSavedAt) {
    return `Saved ${lastSavedAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`
  }

  return 'Saved'
}
