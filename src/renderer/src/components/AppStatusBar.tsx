import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Sparkles
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ViewMode } from '@/components/ViewModeToggle'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'
import { computeWordCount } from '@/lib/word-count'
import { WordCountScheduler } from '@/lib/word-count-scheduler'

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
  viewMode?: ViewMode | null
  compileStatus?: 'pending' | 'error' | 'ready' | null
  cursorPosition?: { line: number; column: number } | null
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
  viewMode,
  compileStatus,
  cursorPosition,
  readingZoomFactor,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleAiPanel,
  onResetReadingZoom
}: AppStatusBarProps): React.JSX.Element {
  const { t, formatNumber, formatTime } = useI18n()
  const [countState, setCountState] = useState(() => ({
    source: content,
    count: computeWordCount(content)
  }))
  const wordCountScheduler = useMemo(
    () => new WordCountScheduler(window, (source, count) => setCountState({ source, count })),
    []
  )
  useEffect(() => {
    if (countState.source !== content) wordCountScheduler.schedule(content)
    return () => wordCountScheduler.cancel()
  }, [content, countState.source, wordCountScheduler])
  const wordCount = countState.source === content ? countState.count : null
  const countLabel = (value: number | undefined): string =>
    value === undefined ? '—' : formatNumber(value)
  const saveLabel = getSaveLabel({
    hasFile: selectedPath !== null,
    isDirty,
    isSaving,
    lastSavedAt,
    t,
    formatTime
  })
  const readingZoomPercent =
    readingZoomFactor !== undefined && readingZoomFactor !== 1
      ? Math.round(readingZoomFactor * 100)
      : null
  const languageLabel = selectedPath ? getLanguageLabel(selectedPath) : null

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-masthead font-sans text-xs text-muted-foreground">
      <div className="flex h-full items-center">
        <div className="flex h-full items-center border-r border-border px-1">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={statusToggleClass(leftPanelOpen)}
            title={leftPanelOpen ? t('status.hideVaultPanel') : t('status.showVaultPanel')}
            aria-label={leftPanelOpen ? t('status.hideVaultPanel') : t('status.showVaultPanel')}
            aria-pressed={leftPanelOpen}
            onClick={onToggleLeftPanel}
          >
            {leftPanelOpen ? (
              <PanelLeftClose aria-hidden="true" />
            ) : (
              <PanelLeftOpen aria-hidden="true" />
            )}
          </Button>
        </div>
        <span className="px-2">
          {selectedVaultPath && !selectedPath
            ? t('status.readOnly')
            : isLoadingFile
              ? t('status.loading')
              : saveLabel}
        </span>
        {viewMode ? (
          <span className="border-l border-border px-2 font-mono text-xs uppercase">
            {viewMode}
          </span>
        ) : null}
        {compileStatus && viewMode === 'reading' ? (
          <span className="border-l border-border px-2 font-mono text-xs" role="status">
            {compileStatus === 'pending'
              ? 'Updating'
              : compileStatus === 'error'
                ? 'Compile issue'
                : 'Ready'}
          </span>
        ) : null}
      </div>

      <div className="flex h-full items-center">
        <div
          className="hidden items-center gap-1.5 px-3 tabular-nums min-[760px]:flex"
          title={t('status.documentStatistics')}
        >
          {selectedPath ? (
            <>
              {cursorPosition ? (
                <>
                  <span>
                    Ln {formatNumber(cursorPosition.line)}, Col{' '}
                    {formatNumber(cursorPosition.column)}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <span>{t('status.words', { count: countLabel(wordCount?.words) })}</span>
              <span aria-hidden="true">·</span>
              <span>{t('status.chars', { count: countLabel(wordCount?.chars) })}</span>
              <span aria-hidden="true">·</span>
              <span>{t('status.minutes', { count: countLabel(wordCount?.readingMinutes) })}</span>
              {readingZoomPercent !== null ? (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="rounded-sm px-0.5 font-semibold text-foreground outline-none hover:text-instrument-blue focus-visible:ring-2 focus-visible:ring-ring"
                    title={t('status.resetReadingZoom')}
                    aria-label={t('status.readingZoomReset', { percent: readingZoomPercent })}
                    onClick={onResetReadingZoom}
                  >
                    {formatNumber(readingZoomPercent)}%
                  </button>
                </>
              ) : null}
              {languageLabel ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{languageLabel}</span>
                </>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex h-full items-center gap-0.5 border-l border-border px-1">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={statusToggleClass(rightPanelOpen)}
            title={rightPanelOpen ? t('status.hideContextPanel') : t('status.showContextPanel')}
            aria-label={
              rightPanelOpen ? t('status.hideContextPanel') : t('status.showContextPanel')
            }
            aria-pressed={rightPanelOpen}
            onClick={onToggleRightPanel}
          >
            {rightPanelOpen ? (
              <PanelRightClose aria-hidden="true" />
            ) : (
              <PanelRightOpen aria-hidden="true" />
            )}
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={statusToggleClass(aiPanelOpen)}
            title={aiPanelOpen ? t('status.hideAiPanel') : t('status.showAiPanel')}
            aria-label={aiPanelOpen ? t('status.hideAiPanel') : t('status.showAiPanel')}
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

function statusToggleClass(active: boolean): string {
  return cn(
    'rounded-[2px] text-muted-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-instrument-blue/70',
    active
      ? 'text-instrument-blue hover:bg-instrument-blue/10 hover:text-instrument-blue'
      : 'hover:bg-foreground/[0.06] hover:text-foreground'
  )
}

function getLanguageLabel(relativePath: string): string | null {
  const fileName = relativePath.split(/[\\/]/).at(-1)
  const extension = fileName?.includes('.') ? fileName.split('.').at(-1) : null
  return extension?.toUpperCase() ?? null
}

function getSaveLabel({
  hasFile,
  isDirty,
  isSaving,
  lastSavedAt,
  t,
  formatTime
}: {
  hasFile: boolean
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
  t: ReturnType<typeof useI18n>['t']
  formatTime: ReturnType<typeof useI18n>['formatTime']
}): string {
  if (!hasFile) {
    return t('status.noFile')
  }

  if (isSaving) {
    return t('status.saving')
  }

  if (isDirty) {
    return t('status.unsaved')
  }

  if (lastSavedAt) {
    return t('status.savedAt', { time: formatTime(lastSavedAt) })
  }

  return t('status.saved')
}
