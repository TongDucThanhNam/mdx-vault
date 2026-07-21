import { PanelLeft, PanelRight, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { computeWordCount } from '@/lib/word-count'

interface AppStatusBarProps {
  selectedPath: string | null
  selectedVaultPath: string | null
  content: string
  isLoadingFile: boolean
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  aiPanelOpen: boolean
  hasVault: boolean
  readingZoomFactor?: number
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onToggleAiPanel: () => void
  onResetReadingZoom: () => void
}

export function AppStatusBar({
  selectedPath,
  selectedVaultPath,
  content,
  isLoadingFile,
  isDirty,
  isSaving,
  lastSavedAt,
  leftPanelOpen,
  rightPanelOpen,
  aiPanelOpen,
  hasVault,
  readingZoomFactor,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleAiPanel,
  onResetReadingZoom
}: AppStatusBarProps): React.JSX.Element {
  const wordCount = useMemo(() => computeWordCount(content), [content])
  const saveLabel = getSaveLabel({
    hasFile: selectedPath !== null,
    isDirty,
    isSaving,
    lastSavedAt
  })
  const readingZoomPercent =
    readingZoomFactor !== undefined && readingZoomFactor !== 1
      ? Math.round(readingZoomFactor * 100)
      : null

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t-2 border-foreground bg-masthead font-mono text-[10px] tracking-wide text-muted-foreground">
      <div className="flex h-full items-center">
        <div className="flex h-full items-center border-r-2 border-foreground px-1">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={cn(leftPanelOpen && 'bg-foreground text-background')}
            title={leftPanelOpen ? 'Hide vault panel' : 'Show vault panel'}
            aria-label={leftPanelOpen ? 'Hide vault panel' : 'Show vault panel'}
            aria-pressed={leftPanelOpen}
            onClick={onToggleLeftPanel}
          >
            <PanelLeft aria-hidden="true" />
          </Button>
        </div>
        <span className="px-2">
          {selectedVaultPath && !selectedPath
            ? 'Read only'
            : isLoadingFile
              ? 'Loading…'
              : saveLabel}
        </span>
      </div>

      <div className="flex h-full items-center">
        <div
          className="flex items-center gap-1.5 px-3 tabular-nums"
          aria-live="polite"
          title="Document statistics"
        >
          {selectedPath ? (
            <>
              <span>{wordCount.words} words</span>
              <span aria-hidden="true">·</span>
              <span>{wordCount.chars} chars</span>
              <span aria-hidden="true">·</span>
              <span>{wordCount.readingMinutes} min read</span>
              {readingZoomPercent !== null ? (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="px-0.5 font-bold text-foreground outline-none hover:text-[var(--editorial-red)] focus-visible:ring-2 focus-visible:ring-[var(--editorial-red)]"
                    title="Reset reading zoom to 100%"
                    aria-label={`Reading zoom ${readingZoomPercent}%. Reset to 100%`}
                    onClick={onResetReadingZoom}
                  >
                    {readingZoomPercent}%
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex h-full items-center gap-0.5 border-l-2 border-foreground px-1">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={cn(rightPanelOpen && 'bg-foreground text-background')}
            title={rightPanelOpen ? 'Hide context panel' : 'Show context panel'}
            aria-label={rightPanelOpen ? 'Hide context panel' : 'Show context panel'}
            aria-pressed={rightPanelOpen}
            onClick={onToggleRightPanel}
          >
            <PanelRight aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={cn(aiPanelOpen && 'bg-foreground text-background')}
            title={aiPanelOpen ? 'Hide AI panel' : 'Show AI panel'}
            aria-label={aiPanelOpen ? 'Hide AI panel' : 'Show AI panel'}
            aria-pressed={aiPanelOpen}
            disabled={!hasVault}
            onClick={onToggleAiPanel}
          >
            <Sparkles aria-hidden="true" />
          </Button>
        </div>
      </div>
    </footer>
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
