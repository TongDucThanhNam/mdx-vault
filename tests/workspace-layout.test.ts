import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  fitPanelWidths,
  resolveVisibleSupplementaryDockTab,
  resolveWorkspaceLayoutMode,
  workspaceGridTemplate
} from '../src/renderer/src/components/layout/workspace-layout'

const mainEditorSource = readFileSync('src/renderer/src/components/layout/MainEditor.tsx', 'utf8')
const supplementaryDockSource = readFileSync(
  'src/renderer/src/components/layout/ResponsiveSupplementaryDock.tsx',
  'utf8'
)

describe('responsive workspace layout', () => {
  test('selects stable wide, compact, and overlay breakpoints', () => {
    expect(resolveWorkspaceLayoutMode(1440)).toBe('wide')
    expect(resolveWorkspaceLayoutMode(1360)).toBe('wide')
    expect(resolveWorkspaceLayoutMode(980)).toBe('compact')
    expect(resolveWorkspaceLayoutMode(800)).toBe('compact')
    expect(resolveWorkspaceLayoutMode(799)).toBe('overlay')
  })

  test('keeps supplementary docks out of the compact document grid', () => {
    const compact = workspaceGridTemplate({
      mode: 'compact',
      leftPanelOpen: true,
      rightPanelOpen: true,
      aiPanelOpen: true,
      readingFullView: false,
      widths: { leftPanelWidth: 15.5, rightPanelWidth: 18, aiPanelWidth: 21 }
    })

    expect(compact).toBe('var(--left-panel-width, 15.5rem) 6px minmax(30rem, 1fr)')
    expect(compact).not.toContain('18rem')
    expect(compact).not.toContain('21rem')
  })

  test('uses a full document track in overlay and reading-full-view modes', () => {
    const expected = 'minmax(0, 1fr)'
    expect(
      workspaceGridTemplate({
        mode: 'overlay',
        leftPanelOpen: true,
        rightPanelOpen: true,
        aiPanelOpen: true,
        readingFullView: false,
        widths: { leftPanelWidth: 15.5, rightPanelWidth: 18, aiPanelWidth: 21 }
      })
    ).toBe(expected)
    expect(
      workspaceGridTemplate({
        mode: 'wide',
        leftPanelOpen: true,
        rightPanelOpen: true,
        aiPanelOpen: true,
        readingFullView: true,
        widths: { leftPanelWidth: 15.5, rightPanelWidth: 18, aiPanelWidth: 21 }
      })
    ).toBe(expected)
  })

  test('uses persisted widths with bounded tracks and document floor', () => {
    expect(
      workspaceGridTemplate({
        mode: 'wide',
        leftPanelOpen: true,
        rightPanelOpen: true,
        aiPanelOpen: true,
        readingFullView: false,
        widths: { leftPanelWidth: 99, rightPanelWidth: 13, aiPanelWidth: 22.2 }
      })
    ).toBe(
      'var(--left-panel-width, 28rem) 6px minmax(30rem, 1fr) 6px var(--right-panel-width, 14rem) 6px var(--ai-panel-width, 22rem)'
    )
  })

  test('fits open panels around the document floor at both breakpoints', () => {
    expect(
      fitPanelWidths({
        widths: { leftPanelWidth: 28, rightPanelWidth: 32, aiPanelWidth: 36 },
        mode: 'compact',
        viewportWidth: 800,
        remPx: 16,
        leftPanelOpen: true,
        rightPanelOpen: true,
        aiPanelOpen: true
      }).leftPanelWidth
    ).toBe(19.5)
    const wide = fitPanelWidths({
      widths: { leftPanelWidth: 28, rightPanelWidth: 32, aiPanelWidth: 36 },
      mode: 'wide',
      viewportWidth: 1360,
      remPx: 16,
      leftPanelOpen: true,
      rightPanelOpen: true,
      aiPanelOpen: true
    })
    expect(
      wide.leftPanelWidth + wide.rightPanelWidth + wide.aiPanelWidth + 30 + (3 * 6) / 16
    ).toBeLessThanOrEqual(1360 / 16)
  })

  test('never selects a closed supplementary dock tab', () => {
    expect(
      resolveVisibleSupplementaryDockTab({
        contextOpen: true,
        aiOpen: true,
        activeTab: 'ai'
      })
    ).toBe('ai')
    expect(
      resolveVisibleSupplementaryDockTab({
        contextOpen: true,
        aiOpen: false,
        activeTab: 'ai'
      })
    ).toBe('context')
    expect(
      resolveVisibleSupplementaryDockTab({
        contextOpen: false,
        aiOpen: true,
        activeTab: 'context'
      })
    ).toBe('ai')
  })

  test('gives the supplementary dock sole ownership of the document boundary', () => {
    expect(mainEditorSource).toContain('bg-background outline-none')
    expect(mainEditorSource).not.toContain("!readingFullView && 'border-r border-border'")
    expect(mainEditorSource).not.toContain('EvidenceRail')
    expect(mainEditorSource).not.toContain('grid-cols-[minmax(0,1fr)_2rem]')
    expect(mainEditorSource).toContain('relative flex min-h-0 flex-1')
    expect(supplementaryDockSource).toContain("wide ? 'border-l border-border' : 'flex-1'")
  })
})
