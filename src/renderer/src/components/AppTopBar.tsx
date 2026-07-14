import { Sparkles } from 'lucide-react'
import type { CommandAction } from '@/commands/actions'
import { AppMenuBar } from '@/components/AppMenuBar'
import { Button } from '@/components/ui/button'
import type { ViewMode } from '@/components/ViewModeToggle'
import { WindowControls } from '@/components/WindowControls'

interface AppTopBarProps {
  vaultName: string | null
  selectedPath: string | null
  viewMode: ViewMode
  commandActions: CommandAction[]
  editorAvailable: boolean
  isOpeningVault: boolean
  isSaving: boolean
  isDirty: boolean
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  aiPanelOpen: boolean
  onSave: () => void
  onRevealNote: () => void
  onOpenCommandPalette: () => void
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onToggleAi: () => void
}

export function AppTopBar({
  vaultName,
  selectedPath,
  viewMode,
  commandActions,
  editorAvailable,
  isOpeningVault,
  isSaving,
  isDirty,
  leftPanelOpen,
  rightPanelOpen,
  aiPanelOpen,
  onSave,
  onRevealNote,
  onOpenCommandPalette,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleAi
}: AppTopBarProps): React.JSX.Element {
  return (
    <header className="app-drag-region sticky top-0 z-50 flex h-9 shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--paper-dark)] pl-3 text-foreground">
      <div className="app-no-drag flex min-w-0 items-center">
        <span className="mr-1 flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
          <span className="size-2 bg-[var(--editorial-red)]" aria-hidden="true" />
          mdx
        </span>
        <AppMenuBar
          commandActions={commandActions}
          selectedPath={selectedPath}
          viewMode={viewMode}
          editorAvailable={editorAvailable}
          isOpeningVault={isOpeningVault}
          isSaving={isSaving}
          isDirty={isDirty}
          leftPanelOpen={leftPanelOpen}
          rightPanelOpen={rightPanelOpen}
          aiPanelOpen={aiPanelOpen}
          onSave={onSave}
          onRevealNote={onRevealNote}
          onOpenCommandPalette={onOpenCommandPalette}
          onToggleLeftPanel={onToggleLeftPanel}
          onToggleRightPanel={onToggleRightPanel}
          onToggleAiPanel={onToggleAi}
        />
        <span className="ml-1 max-w-48 truncate border border-[var(--line)] bg-background px-2 py-0.5 font-mono text-[9px] tracking-wide text-muted-foreground">
          {vaultName ?? 'No vault'}
        </span>
      </div>

      <div className="app-no-drag flex h-full shrink-0 items-center">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className={
            aiPanelOpen
              ? 'bg-[var(--editorial-red)] text-white hover:bg-[var(--editorial-red)]/90'
              : 'text-muted-foreground hover:bg-foreground hover:text-background'
          }
          title="AI assistant (Ctrl+Shift+A)"
          aria-label="Toggle AI assistant"
          aria-pressed={aiPanelOpen}
          disabled={!vaultName}
          onClick={onToggleAi}
        >
          <Sparkles aria-hidden="true" />
        </Button>
        <WindowControls />
      </div>
    </header>
  )
}
