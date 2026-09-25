import { Sparkles } from 'lucide-react'
import type { CommandActionRegistry } from '@/commands/actions'
import { AppMenuBar } from '@/components/AppMenuBar'
import { openVaultFromTitlebar } from '@/components/titlebar-actions'
import { Button } from '@/components/ui/button'
import type { ViewMode } from '@/components/ViewModeToggle'
import { WindowControls } from '@/components/WindowControls'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'

interface AppTopBarProps {
  vaultName: string | null
  selectedPath: string | null
  viewMode: ViewMode
  commandActions: CommandActionRegistry
  editorAvailable: boolean
  isOpeningVault: boolean
  isSaving: boolean
  isDirty: boolean
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  aiPanelOpen: boolean
  onRevealNote: () => void
  onToggleRightPanel: () => void
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
  onRevealNote,
  onToggleRightPanel
}: AppTopBarProps): React.JSX.Element {
  const { t } = useI18n()
  const aiShortcut = commandActions.getAction('ai.toggle')?.hotkeys?.[0]
  return (
    <header className="app-drag-region sticky top-0 z-50 flex h-10 shrink-0 items-center justify-between border-b border-border bg-masthead pl-1.5 text-foreground">
      <div className="app-no-drag flex min-w-0 items-center gap-1">
        <AppMenuBar
          mainMenuLabel={t('app.mainMenu')}
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
          onRevealNote={onRevealNote}
          onToggleRightPanel={onToggleRightPanel}
        />
        <button
          type="button"
          className={cn(
            'relative flex h-7 max-w-[min(14rem,40vw)] min-w-0 items-center rounded-[2px] border border-border bg-background px-2.5 font-sans text-xs font-medium text-muted-foreground outline-none transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-instrument-blue disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none',
            vaultName &&
              'after:absolute after:inset-x-[-1px] after:bottom-[-1px] after:h-px after:bg-instrument-blue'
          )}
          title={vaultName ? `${t('app.switchVault')}: ${vaultName}` : t('app.openVault')}
          aria-label={vaultName ? `${t('app.switchVault')}: ${vaultName}` : t('app.openVault')}
          disabled={isOpeningVault}
          onClick={() => void openVaultFromTitlebar(commandActions)}
        >
          <span className="truncate">
            {isOpeningVault ? t('app.openingVault') : (vaultName ?? t('app.openVault'))}
          </span>
        </button>
      </div>

      <div className="app-no-drag flex h-full shrink-0 items-center">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className={
            aiPanelOpen
              ? 'bg-instrument-blue text-white hover:bg-instrument-blue/90'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          }
          title={`${t('app.toggleAssistant')}${aiShortcut ? ` (${aiShortcut})` : ''}`}
          aria-label={t('app.toggleAssistant')}
          aria-pressed={aiPanelOpen}
          disabled={!vaultName}
          onClick={() => void commandActions.dispatch('ai.toggle')}
        >
          <Sparkles aria-hidden="true" />
        </Button>
        <WindowControls />
      </div>
    </header>
  )
}
