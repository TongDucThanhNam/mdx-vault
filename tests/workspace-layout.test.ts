import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  resolveDockPolicy,
  resolveWorkspaceLayoutMode,
  workspaceGridTemplate
} from '../src/renderer/src/components/layout/workspace-layout'

const mainEditorSource = readFileSync('src/renderer/src/components/layout/MainEditor.tsx', 'utf8')
const supplementaryDockSource = readFileSync(
  'src/renderer/src/components/layout/ResponsiveSupplementaryDock.tsx',
  'utf8'
)

describe('GOAL-37 dock policy', () => {
  test('uses tracks rather than an overlay throughout the supported width range', () => {
    expect(resolveWorkspaceLayoutMode(1920)).toBe('wide')
    expect(resolveWorkspaceLayoutMode(1366)).toBe('wide')
    expect(resolveWorkspaceLayoutMode(1100)).toBe('compact')
    expect(resolveWorkspaceLayoutMode(1000)).toBe('compact')
    expect(resolveWorkspaceLayoutMode(980)).toBe('compact')
    expect(supplementaryDockSource).toContain('data-supplementary-dock="tracked"')
    expect(supplementaryDockSource).not.toContain('absolute top-20')
  })

  test('never allocates less than the document floor across width, dock and saved-width matrix', () => {
    for (const viewportWidth of [980, 1000, 1100, 1366, 1920]) {
      const mode = resolveWorkspaceLayoutMode(viewportWidth)
      for (const widths of [
        { leftPanelWidth: 15.5, rightPanelWidth: 18, aiPanelWidth: 21 },
        { leftPanelWidth: 28, rightPanelWidth: 32, aiPanelWidth: 36 }
      ]) {
        for (let mask = 0; mask < 8; mask++) {
          const leftPanelOpen = Boolean(mask & 1)
          const rightPanelOpen = Boolean(mask & 2)
          const aiPanelOpen = Boolean(mask & 4)
          const policy = resolveDockPolicy({
            widths,
            mode,
            viewportWidth,
            remPx: 16,
            leftPanelOpen,
            rightPanelOpen,
            aiPanelOpen
          })
          const actualLeft = leftPanelOpen && !policy.collapsedLeft
          const openWidths =
            (actualLeft ? policy.widths.leftPanelWidth : 0) +
            (rightPanelOpen ? policy.widths.rightPanelWidth : 0) +
            (aiPanelOpen ? policy.widths.aiPanelWidth : 0)
          const count = Number(actualLeft) + Number(rightPanelOpen) + Number(aiPanelOpen)
          expect((openWidths + policy.documentFloor) * 16 + count * 6).toBeLessThanOrEqual(
            viewportWidth
          )
          expect(policy.documentFloor).toBe(mode === 'wide' ? 30 : 26)
          if (policy.collapsedLeft)
            expect(leftPanelOpen && (rightPanelOpen || aiPanelOpen)).toBe(true)
          const grid = workspaceGridTemplate({
            mode,
            widths: policy.widths,
            leftPanelOpen: actualLeft,
            rightPanelOpen,
            aiPanelOpen,
            readingFullView: false
          })
          expect(grid).toContain(`minmax(${policy.documentFloor}rem, 1fr)`)
          expect(grid.includes('minmax(0, 1fr)')).toBe(false)
        }
      }
    }
  })

  test('collapses Explorer only where minimum docks cannot coexist, without changing saved widths', () => {
    const widths = { leftPanelWidth: 28, rightPanelWidth: 32, aiPanelWidth: 36 }
    const compact = resolveDockPolicy({
      widths,
      mode: 'compact',
      viewportWidth: 980,
      remPx: 16,
      leftPanelOpen: true,
      rightPanelOpen: true,
      aiPanelOpen: true
    })
    expect(compact.collapsedLeft).toBe(true)
    expect(widths).toEqual({ leftPanelWidth: 28, rightPanelWidth: 32, aiPanelWidth: 36 })
    expect(
      resolveDockPolicy({
        widths,
        mode: 'compact',
        viewportWidth: 980,
        remPx: 16,
        leftPanelOpen: true,
        rightPanelOpen: false,
        aiPanelOpen: false
      }).collapsedLeft
    ).toBe(false)
  })

  test('single document track in full-view mode', () => {
    expect(
      workspaceGridTemplate({
        mode: 'wide',
        leftPanelOpen: true,
        rightPanelOpen: true,
        aiPanelOpen: true,
        readingFullView: true,
        widths: { leftPanelWidth: 15.5, rightPanelWidth: 18, aiPanelWidth: 21 }
      })
    ).toBe('minmax(0, 1fr)')
  })

  test('retains the GOAL-34 and GOAL-35 surface contracts', () => {
    expect(mainEditorSource).toContain('bg-background outline-none')
    expect(mainEditorSource).toContain('relative flex min-h-0 flex-1')
    expect(supplementaryDockSource).toContain('border-l border-border')
  })
})
