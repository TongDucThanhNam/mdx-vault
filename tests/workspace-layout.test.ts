import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
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
      readingFullView: false
    })

    expect(compact).toBe('minmax(13.5rem, 14rem) minmax(0, 1fr)')
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
        readingFullView: false
      })
    ).toBe(expected)
    expect(
      workspaceGridTemplate({
        mode: 'wide',
        leftPanelOpen: true,
        rightPanelOpen: true,
        aiPanelOpen: true,
        readingFullView: true
      })
    ).toBe(expected)
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
