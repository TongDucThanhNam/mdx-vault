import {
  Command,
  Download,
  FileSearch,
  FolderOpen,
  Moon,
  Save,
  Search,
  Sparkles,
  Sun
} from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { AiSidePanel } from '@/ai/panels/AiSidePanel'
import type { CommandAction } from '@/commands/actions'
import { LeftPanel } from '@/components/layout/LeftPanel'
import { MainEditor } from '@/components/layout/MainEditor'
import { type NavigationPanel, RightPanel } from '@/components/layout/RightPanel'
import { Button } from '@/components/ui/button'
import type { ViewMode } from '@/components/ViewModeToggle'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import type { VaultSessionController } from '@/hooks/useVaultSession'
import { deriveNoteTitle } from '@/lib/note-title'
import { cn } from '@/lib/utils'
import type { VaultInfo } from '@/vault/types'

export type { NavigationPanel } from '@/components/layout/RightPanel'

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
          aiPanelOpen
            ? 'grid-cols-[280px_minmax(0,1fr)_320px_360px]'
            : 'grid-cols-[280px_minmax(0,1fr)_320px]'
        )}
      >
        <LeftPanel
          vault={vault}
          editor={editor}
          noteIndex={noteIndex}
          vaultSession={vaultSession}
          setCreateNoteOpen={setCreateNoteOpen}
          setEmptyTrashOpen={setEmptyTrashOpen}
          onRequestDelete={onRequestDelete}
        />
        <MainEditor
          viewMode={viewMode}
          commandActions={commandActions}
          editor={editor}
          noteIndex={noteIndex}
          noteActions={noteActions}
          editorInteractions={editorInteractions}
          setViewMode={setViewMode}
          onError={onError}
        />
        <RightPanel
          navigationPanel={navigationPanel}
          editor={editor}
          noteIndex={noteIndex}
          noteActions={noteActions}
          editorInteractions={editorInteractions}
          setNavigationPanel={setNavigationPanel}
        />

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
