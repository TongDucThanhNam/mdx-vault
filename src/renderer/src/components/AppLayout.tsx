import {
  Command,
  Download,
  FilePlus,
  FileSearch,
  FolderOpen,
  Hash,
  Link2,
  ListTree,
  Moon,
  Save,
  Search,
  Sparkles,
  Sun,
  Trash2
} from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import { AiSelectionActionPalette } from '@/ai/panels/AiSelectionActionPalette'
import { AiSidePanel } from '@/ai/panels/AiSidePanel'
import type { CommandAction } from '@/commands/actions'
import { EmptyState } from '@/components/EmptyState'
import { SortMenu } from '@/components/SortMenu'
import { Button } from '@/components/ui/button'
import { type ViewMode, ViewModeToggle } from '@/components/ViewModeToggle'
import { MdxEditor } from '@/editor/MdxEditor'
import { FileTree } from '@/explorer/FileTree'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import type { VaultSessionController } from '@/hooks/useVaultSession'
import { deriveNoteTitle } from '@/lib/note-title'
import { cn } from '@/lib/utils'
import { computeWordCount } from '@/lib/word-count'
import { BacklinksPanel } from '@/panels/BacklinksPanel'
import { OutlinePanel } from '@/panels/OutlinePanel'
import { TagsPanel } from '@/panels/TagsPanel'
import { MdxPreview } from '@/preview/MdxPreview'
import type { VaultInfo } from '@/vault/types'

export type NavigationPanel = 'outline' | 'tags' | 'backlinks'

interface AppLayoutProps {
  vault: VaultInfo | null
  error: string | null
  theme: 'light' | 'dark' | 'system'
  resolvedTheme: 'light' | 'dark'
  viewMode: ViewMode
  navigationPanel: NavigationPanel
  aiPanelOpen: boolean
  commandActions: CommandAction[]
  editor: NoteEditorController
  noteIndex: NoteIndexController
  vaultSession: VaultSessionController
  noteActions: NoteActionsController
  editorInteractions: EditorInteractionsController
  toggleTheme: () => Promise<void>
  setViewMode: Dispatch<SetStateAction<ViewMode>>
  setNavigationPanel: Dispatch<SetStateAction<NavigationPanel>>
  setAiPanelOpen: Dispatch<SetStateAction<boolean>>
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>
  setQuickSwitcherOpen: Dispatch<SetStateAction<boolean>>
  setSearchOpen: Dispatch<SetStateAction<boolean>>
  setExportDialogOpen: Dispatch<SetStateAction<boolean>>
  setCreateNoteOpen: Dispatch<SetStateAction<boolean>>
  setEmptyTrashOpen: Dispatch<SetStateAction<boolean>>
  onRequestDelete: (relativePath: string) => void
  onError: (message: string | null) => void
}

export function AppLayout({
  vault,
  error,
  theme,
  resolvedTheme,
  viewMode,
  navigationPanel,
  aiPanelOpen,
  commandActions,
  editor,
  noteIndex,
  vaultSession,
  noteActions,
  editorInteractions,
  toggleTheme,
  setViewMode,
  setNavigationPanel,
  setAiPanelOpen,
  setCommandPaletteOpen,
  setQuickSwitcherOpen,
  setSearchOpen,
  setExportDialogOpen,
  setCreateNoteOpen,
  setEmptyTrashOpen,
  onRequestDelete,
  onError
}: AppLayoutProps): React.JSX.Element {
  const saveLabel = getSaveLabel({
    hasFile: editor.selectedPath !== null,
    isDirty: editor.isDirty,
    isSaving: editor.isSaving,
    lastSavedAt: editor.lastSavedAt
  })
  const wordCount = useMemo(() => computeWordCount(editor.content), [editor.content])
  const showEditor = viewMode !== 'preview'
  const showPreview = viewMode !== 'source'

  return (
    <>
      <a
        href="#workspace"
        className="sr-only fixed top-2 left-2 z-[60] border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-foreground shadow-[3px_3px_0_0_var(--foreground)] focus:not-sr-only"
      >
        Skip to workspace
      </a>
      <header className="sticky top-0 z-50 flex h-11 shrink-0 items-center justify-between border-b-2 border-foreground bg-foreground px-3 text-background">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="font-mono text-[13px] font-bold uppercase tracking-[0.15em] text-background">
            mdx-vault<span className="text-[var(--editorial-red)]">.</span>
          </div>
          {vault ? (
            <>
              <span className="font-mono text-[11px] uppercase tracking-widest text-background/35">
                /
              </span>
              <span className="truncate font-mono text-[11px] uppercase tracking-widest text-background/70">
                {vault.name}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <div
            className="mr-1 hidden font-mono text-[10px] uppercase tracking-widest text-background/65 sm:block"
            aria-live="polite"
          >
            {saveLabel}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-background/70 hover:bg-background hover:text-foreground"
            title="Command palette"
            aria-label="Command palette"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Command className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-background/70 hover:bg-background hover:text-foreground"
            title="Open note"
            aria-label="Open note"
            disabled={!vault}
            onClick={() => setQuickSwitcherOpen(true)}
          >
            <FileSearch className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-background/70 hover:bg-background hover:text-foreground"
            title="Search notes"
            aria-label="Search notes"
            disabled={!vault}
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="border-2 border-background text-background hover:bg-background hover:text-foreground"
            disabled={!editor.selectedPath || editor.isSaving || !editor.isDirty}
            onClick={() => void editor.saveCurrentFile()}
          >
            <Save className="size-4" aria-hidden="true" />
            Save
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-background/70 hover:bg-background hover:text-foreground"
            title="Export note (Ctrl+Shift+E)"
            aria-label="Export note"
            disabled={!editor.selectedPath}
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={aiPanelOpen ? 'default' : 'ghost'}
            className={
              aiPanelOpen
                ? 'bg-[var(--editorial-red)] text-white hover:bg-[var(--editorial-red)]/90'
                : 'text-background/70 hover:bg-background hover:text-foreground'
            }
            title="AI assistant (Ctrl+Shift+A)"
            aria-label="Toggle AI assistant"
            aria-pressed={aiPanelOpen}
            disabled={!vault}
            onClick={() => setAiPanelOpen((current) => !current)}
          >
            <Sparkles className="size-4" aria-hidden="true" />
          </Button>
          <ViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            disabled={!editor.selectedPath}
            dark
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-background/70 hover:bg-background hover:text-foreground"
            title={
              theme === 'system'
                ? `Theme: follow system (currently ${resolvedTheme})`
                : `Theme: ${theme}`
            }
            aria-label="Toggle dark mode"
            onClick={() => void toggleTheme()}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="border-2 border-background bg-background text-foreground shadow-[2px_2px_0_0_color-mix(in_srgb,var(--background)_55%,transparent)] hover:border-[var(--editorial-red)] hover:bg-[var(--editorial-red)] hover:text-white hover:shadow-none"
            onClick={() => void vaultSession.openVault()}
            disabled={vaultSession.isOpening}
          >
            <FolderOpen className="size-4" aria-hidden="true" />
            {vaultSession.isOpening ? 'Opening…' : 'Open vault'}
          </Button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="border-b-2 border-destructive bg-destructive/10 px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wider text-destructive"
        >
          {error}
        </div>
      ) : null}

      <main
        id="workspace"
        tabIndex={-1}
        className={cn(
          'grid min-h-0 flex-1 overflow-hidden',
          gridTemplateColumns(viewMode, aiPanelOpen)
        )}
      >
        <aside
          aria-label="Vault explorer"
          className="min-h-0 min-w-0 border-r-2 border-foreground bg-sidebar"
        >
          <div className="flex h-10 items-center justify-between border-b-2 border-foreground px-3">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Vault
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                title="New note"
                aria-label="New note"
                disabled={!vault}
                onClick={() => setCreateNoteOpen(true)}
              >
                <FilePlus className="size-3.5" aria-hidden="true" />
              </Button>
              <SortMenu
                sortMode={vaultSession.sortMode}
                onChange={vaultSession.handleSortModeChange}
                disabled={!vault}
              />
              <Button
                type="button"
                size="icon-sm"
                variant={vaultSession.trashCount > 0 ? 'outline' : 'ghost'}
                title={
                  vaultSession.trashCount > 0
                    ? `Trash (${vaultSession.trashCount} item${vaultSession.trashCount === 1 ? '' : 's'})`
                    : 'Trash is empty'
                }
                aria-label="Trash"
                disabled={!vault || vaultSession.trashCount === 0}
                onClick={() => setEmptyTrashOpen(true)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {vaultSession.trashCount > 0 ? (
                  <span className="ml-1 text-[11px] tabular-nums">{vaultSession.trashCount}</span>
                ) : null}
              </Button>
              <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {vault?.files.length ?? 0}
                <span className="sr-only"> files</span>
              </div>
            </div>
          </div>
          <div className="h-[calc(100%-2.5rem)] overflow-hidden">
            {vault ? (
              <FileTree
                files={vault.files}
                notes={noteIndex.indexNotes}
                selectedPath={editor.selectedPath}
                sortMode={vaultSession.sortMode}
                onSelectFile={(relativePath) => void editor.loadFile(relativePath)}
                onDeleteFile={onRequestDelete}
                onRenameFile={(fromRelativePath, toRelativePath) =>
                  void vaultSession.handleRename(fromRelativePath, toRelativePath)
                }
                onDuplicateFile={(relativePath) => void vaultSession.handleDuplicate(relativePath)}
                onRevealInExplorer={(relativePath) =>
                  void vaultSession.handleRevealInExplorer(relativePath)
                }
                onCopyPath={(relativePath) => void vaultSession.handleCopyPath(relativePath)}
              />
            ) : (
              <EmptyState
                icon={<FolderOpen className="size-5" aria-hidden="true" />}
                title="No vault open"
                description="Open a local folder to begin writing."
                action={
                  <Button type="button" size="sm" onClick={() => void vaultSession.openVault()}>
                    <FolderOpen className="size-4" aria-hidden="true" />
                    Open vault
                  </Button>
                }
              />
            )}
          </div>
        </aside>

        {showEditor ? (
          <section className="min-h-0 min-w-0 border-r-2 border-foreground bg-card/50">
            <div className="flex h-10 items-center justify-between border-b-2 border-foreground bg-[var(--paper-dark)] px-4">
              <div className="min-w-0 truncate font-mono text-[12px] font-medium tracking-tight">
                {editor.selectedPath ?? 'No file selected'}
              </div>
              <div
                className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-wider tabular-nums text-muted-foreground"
                aria-live="polite"
              >
                {editor.selectedPath ? (
                  <span title="Word / character count and estimated reading time">
                    {wordCount.words} words · {wordCount.chars} chars · {wordCount.readingMinutes}{' '}
                    min read
                  </span>
                ) : null}
                <span>{editor.isLoadingFile ? 'Loading…' : saveLabel}</span>
              </div>
            </div>
            <div className="relative h-[calc(100%-2.5rem)] min-h-0">
              {editor.selectedPath ? (
                editor.isLoadingFile ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Loading file…
                  </div>
                ) : (
                  <>
                    <MdxEditor
                      value={editor.content}
                      onChange={editor.setContent}
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
                  description="Choose a file in the vault to edit its source."
                />
              )}
            </div>
          </section>
        ) : null}

        {showPreview ? (
          <aside className="min-h-0 min-w-0 bg-background">
            <div className="flex h-10 items-center justify-between border-b-2 border-foreground bg-[var(--paper-dark)] px-4">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Preview
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant={navigationPanel === 'outline' ? 'outline' : 'ghost'}
                  title="Outline"
                  aria-label="Outline"
                  aria-pressed={navigationPanel === 'outline'}
                  onClick={() => setNavigationPanel('outline')}
                >
                  <ListTree className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={navigationPanel === 'tags' ? 'outline' : 'ghost'}
                  title="Tags"
                  aria-label="Tags"
                  aria-pressed={navigationPanel === 'tags'}
                  onClick={() => setNavigationPanel('tags')}
                >
                  <Hash className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={navigationPanel === 'backlinks' ? 'outline' : 'ghost'}
                  title="Backlinks"
                  aria-label="Backlinks"
                  aria-pressed={navigationPanel === 'backlinks'}
                  onClick={() => setNavigationPanel('backlinks')}
                >
                  <Link2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="grid h-[calc(100%-2.5rem)] min-h-0 grid-rows-[minmax(0,1fr)_220px]">
              <div className="min-h-0 overflow-hidden">
                <MdxPreview
                  source={editor.content}
                  selectedPath={editor.selectedPath}
                  notes={noteIndex.indexNotes}
                  revealHeadingRequest={editorInteractions.previewHeadingRequest}
                  onNavigate={noteActions.navigateToNote}
                  onRevealLine={editorInteractions.revealEditorLine}
                  onSourceChange={editor.setContent}
                />
              </div>
              <div className="min-h-0 overflow-hidden border-t-2 border-foreground bg-[var(--paper-dark)]">
                {navigationPanel === 'outline' ? (
                  <OutlinePanel
                    headings={noteIndex.outlineHeadings}
                    selectedPath={editor.selectedPath}
                    onSelectHeading={editorInteractions.revealHeading}
                  />
                ) : navigationPanel === 'tags' ? (
                  <TagsPanel
                    tags={noteIndex.tags}
                    selectedTag={noteIndex.selectedTag}
                    taggedNotes={noteIndex.taggedNotes}
                    isLoading={noteIndex.isLoadingTaggedNotes}
                    onSelectTag={noteIndex.setSelectedTag}
                    onSelectNote={noteActions.navigateToNote}
                  />
                ) : (
                  <BacklinksPanel
                    backlinks={noteIndex.backlinks}
                    selectedPath={editor.selectedPath}
                    onSelectNote={noteActions.navigateToNote}
                  />
                )}
              </div>
            </div>
          </aside>
        ) : null}

        {aiPanelOpen ? (
          <aside className="min-h-0 min-w-0 border-l-2 border-foreground bg-[var(--paper-dark)]">
            <AiSidePanel
              noteRelativePath={editor.selectedPath}
              noteTitle={editor.selectedPath ? deriveNoteTitle(editor.selectedPath) : 'No note'}
              noteContent={editor.content}
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
    </>
  )
}

function gridTemplateColumns(viewMode: ViewMode, aiPanelOpen: boolean): string {
  const showEditor = viewMode !== 'preview'
  const showPreview = viewMode !== 'source'

  if (showEditor && showPreview && aiPanelOpen) {
    return 'grid-cols-[280px_minmax(0,1fr)_minmax(340px,0.9fr)_360px]'
  }
  if ((showEditor || showPreview) && aiPanelOpen) {
    return 'grid-cols-[280px_minmax(0,1fr)_360px]'
  }
  if (showEditor && showPreview) {
    return 'grid-cols-[280px_minmax(0,1fr)_minmax(340px,0.9fr)]'
  }
  return 'grid-cols-[280px_minmax(0,1fr)]'
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
