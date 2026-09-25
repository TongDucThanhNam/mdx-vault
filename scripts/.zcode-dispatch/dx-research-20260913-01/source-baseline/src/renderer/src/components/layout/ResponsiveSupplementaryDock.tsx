import { Activity, type KeyboardEvent, useRef } from 'react'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'
import {
  resolveVisibleSupplementaryDockTab,
  type SupplementaryDockTab,
  type WorkspaceLayoutMode
} from './workspace-layout'

export function ResponsiveSupplementaryDock({
  mode,
  contextOpen,
  aiOpen,
  activeTab,
  onActiveTabChange,
  contextPanel,
  aiPanel
}: {
  mode: WorkspaceLayoutMode
  contextOpen: boolean
  aiOpen: boolean
  activeTab: SupplementaryDockTab
  onActiveTabChange: (tab: SupplementaryDockTab) => void
  contextPanel: React.ReactNode
  aiPanel: React.ReactNode
}): React.JSX.Element {
  const { t } = useI18n()
  const wide = mode === 'wide'
  const dockOpen = contextOpen || aiOpen
  const visibleTab = resolveVisibleSupplementaryDockTab({ contextOpen, aiOpen, activeTab })
  const contextTabRef = useRef<HTMLButtonElement>(null)
  const aiTabRef = useRef<HTMLButtonElement>(null)

  const activateTab = (tab: SupplementaryDockTab): void => {
    onActiveTabChange(tab)
    requestAnimationFrame(() => {
      if (tab === 'context') {
        contextTabRef.current?.focus()
        return
      }
      aiTabRef.current?.focus()
    })
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!contextOpen || !aiOpen) {
      return
    }

    let nextTab: SupplementaryDockTab | null = null
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const currentTab = event.currentTarget.id === 'supplementary-context-tab' ? 'context' : 'ai'
      nextTab = currentTab === 'context' ? 'ai' : 'context'
    } else if (event.key === 'Home') {
      nextTab = 'context'
    } else if (event.key === 'End') {
      nextTab = 'ai'
    }

    if (nextTab) {
      event.preventDefault()
      activateTab(nextTab)
    }
  }

  return (
    <div
      data-supplementary-dock={wide ? 'tracked' : 'overlay'}
      className={cn(
        wide
          ? 'contents'
          : 'absolute top-20 right-2 bottom-2 z-30 flex w-[min(22rem,calc(100%-3rem))] flex-col overflow-hidden rounded-md border border-border bg-chrome shadow-[var(--shadow-hard)]',
        !wide && !dockOpen && 'hidden'
      )}
    >
      {wide ? null : (
        <div className="flex h-9 shrink-0 items-center border-b border-border bg-masthead px-1">
          <div
            role="tablist"
            aria-label={t('dock.label')}
            className="flex min-w-0 flex-1 items-center gap-1"
          >
            {contextOpen ? (
              <button
                ref={contextTabRef}
                type="button"
                role="tab"
                id="supplementary-context-tab"
                aria-controls="supplementary-context-panel"
                aria-selected={visibleTab === 'context'}
                tabIndex={visibleTab === 'context' ? 0 : -1}
                className={dockTabClassName(visibleTab === 'context')}
                onClick={() => onActiveTabChange('context')}
                onKeyDown={handleTabKeyDown}
              >
                {t('dock.context')}
              </button>
            ) : null}
            {aiOpen ? (
              <button
                ref={aiTabRef}
                type="button"
                role="tab"
                id="supplementary-ai-tab"
                aria-controls="supplementary-ai-panel"
                aria-selected={visibleTab === 'ai'}
                tabIndex={visibleTab === 'ai' ? 0 : -1}
                className={dockTabClassName(visibleTab === 'ai')}
                onClick={() => onActiveTabChange('ai')}
                onKeyDown={handleTabKeyDown}
              >
                {t('dock.ai')}
              </button>
            ) : null}
          </div>
        </div>
      )}

      <Activity mode={contextOpen && (wide || visibleTab === 'context') ? 'visible' : 'hidden'}>
        <DockPanel
          id="supplementary-context-panel"
          wide={wide}
          label={t('dock.context')}
          labelledBy="supplementary-context-tab"
          className={cn(
            'min-h-0 min-w-0 overflow-hidden bg-chrome',
            wide ? 'border-l border-border' : 'flex-1'
          )}
        >
          {contextPanel}
        </DockPanel>
      </Activity>

      <Activity mode={aiOpen && (wide || visibleTab === 'ai') ? 'visible' : 'hidden'}>
        <DockPanel
          id="supplementary-ai-panel"
          wide={wide}
          label={t('dock.ai')}
          labelledBy="supplementary-ai-tab"
          className={cn(
            'min-h-0 min-w-0 overflow-hidden bg-chrome',
            wide ? 'border-l border-border' : 'flex-1'
          )}
        >
          {aiPanel}
        </DockPanel>
      </Activity>
    </div>
  )
}

function DockPanel({
  id,
  wide,
  label,
  labelledBy,
  className,
  children
}: {
  id: string
  wide: boolean
  label: string
  labelledBy: string
  className: string
  children: React.ReactNode
}): React.JSX.Element {
  if (wide) {
    return (
      <div id={id} role="region" aria-label={label} className={className}>
        {children}
      </div>
    )
  }
  return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} className={className}>
      {children}
    </div>
  )
}

function dockTabClassName(active: boolean): string {
  return cn(
    'h-7 rounded-sm px-2.5 font-sans text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
    active
      ? 'bg-background text-foreground shadow-[inset_0_-2px_0_var(--instrument-blue)]'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  )
}
