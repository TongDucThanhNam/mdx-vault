import { Activity, type RefObject } from 'react'
import { useI18n } from '@/i18n/useI18n'
import type { PanelWidthKey } from '../../../../shared/app-settings'
import { PanelSeparator } from './PanelSeparator'
import type { PanelWidths, WorkspaceLayoutMode } from './workspace-layout'

/** Both supplementary docks own grid tracks, including at compact widths. */
export function ResponsiveSupplementaryDock({
  gridRef,
  panelWidths,
  onPanelWidthChange,
  mode,
  contextOpen,
  aiOpen,
  contextClosing = false,
  aiClosing = false,
  contextPanel,
  aiPanel
}: {
  gridRef: RefObject<HTMLElement | null>
  panelWidths: PanelWidths
  onPanelWidthChange: (key: PanelWidthKey, width: number) => void
  mode: WorkspaceLayoutMode
  contextOpen: boolean
  aiOpen: boolean
  contextClosing?: boolean
  aiClosing?: boolean
  contextPanel: React.ReactNode
  aiPanel: React.ReactNode
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div data-supplementary-dock="tracked" className="contents">
      <Activity mode={contextOpen ? 'visible' : 'hidden'}>
        <div
          id="supplementary-context-panel"
          role="region"
          tabIndex={-1}
          aria-label={t('dock.context')}
          data-panel-width="rightPanelWidth"
          data-dock-open={contextOpen && !contextClosing}
          inert={contextClosing}
          className="min-h-0 min-w-0 overflow-hidden border-l border-border bg-chrome outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div className="chrome-dock-content h-full">{contextPanel}</div>
        </div>
      </Activity>
      {aiOpen ? (
        <PanelSeparator
          panel="aiPanelWidth"
          width={panelWidths.aiPanelWidth}
          gridRef={gridRef}
          onCommit={onPanelWidthChange}
          documentFloor={mode === 'wide' ? 30 : 26}
        />
      ) : null}
      <Activity mode={aiOpen ? 'visible' : 'hidden'}>
        <div
          id="supplementary-ai-panel"
          role="region"
          tabIndex={-1}
          aria-label={t('dock.ai')}
          data-panel-width="aiPanelWidth"
          data-dock-open={aiOpen && !aiClosing}
          inert={aiClosing}
          className="min-h-0 min-w-0 overflow-hidden border-l border-border bg-chrome outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div className="chrome-dock-content h-full">{aiPanel}</div>
        </div>
      </Activity>
    </div>
  )
}
