import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  graphLabelFontSize,
  packGraphComponents,
  shouldCollapseGraphNavigator
} from '../src/renderer/src/graph/graph-readability'
import { QuizBlock } from '../src/renderer/src/preview/islands/QuizBlock'

const chromeFiles = [
  'commands/CommandPalette.tsx',
  'search/SearchPane.tsx',
  'explorer/QuickSwitcher.tsx',
  'components/layout/MruTabSwitcher.tsx',
  'settings/SettingsDialog.tsx',
  'settings/SettingsLayout.tsx',
  'settings/KeymapSettings.tsx',
  'explorer/CreateNoteDialog.tsx',
  'interactive/CreateInteractiveDialog.tsx',
  'components/ConfirmDialog.tsx',
  'panels/KnowledgePanels.tsx',
  'panels/BacklinksPanel.tsx',
  'panels/TagsPanel.tsx',
  'components/layout/RightPanel.tsx',
  'panels/OutlinePanel.tsx',
  'graph/GraphSurface.tsx',
  'graph/GraphLoadingSurface.tsx',
  'graph/GraphNodeNavigator.tsx',
  'graph/GraphSettingsDialog.tsx',
  'interactive/InteractiveProofWorkbench.tsx',
  'ai/panels/AiContextBanner.tsx',
  'ai/panels/AiMessageList.tsx',
  'ai/panels/AiDiffReview.tsx',
  'ai/panels/AiSidePanel.tsx',
  'ai/panels/AiSettingsPanel.tsx',
  'ai/panels/AiSelectionActionPalette.tsx',
  'components/ToastView.tsx',
  'explorer/FileTree.tsx',
  'components/SortMenu.tsx',
  'components/layout/EditorTabs.tsx',
  'components/AppMenuBar.tsx',
  'components/AppTopBar.tsx',
  'editor/ComponentInsertPalette.tsx',
  'editor/SlashCommandPalette.tsx',
  'editor/ComponentDefinitionPopover.tsx',
  'export/ExportDialog.tsx',
  'components/layout/VaultFilePreview.tsx',
  'components/layout/MainEditor.tsx',
  'components/EmptyState.tsx',
  'preview/WikilinkPreview.tsx',
  'components/ui/dialog.tsx',
  'components/ui/alert-dialog.tsx'
]
const read = (file: string) => readFileSync(`src/renderer/src/${file}`, 'utf8')

describe('GOAL-41 chrome and reading contracts', () => {
  test('the complete chrome inventory has no hard offset shadows or inverted selection', () => {
    for (const file of chromeFiles) {
      const source = read(file).split('function HoverPreviewContent')[0]!
      expect({ file, editorialChrome: /font-(?:display|serif)/.test(source) }).toEqual({
        file,
        editorialChrome: false
      })
      expect({
        file,
        invalid:
          /shadow-\[[^\]]*\dpx_\dpx|border-2 border-foreground|bg-foreground text-background/.test(
            source
          )
      }).toEqual({ file, invalid: false })
    }
  })

  test('navigator yields to its container, preserving room for a 480px canvas', () => {
    expect(shouldCollapseGraphNavigator(550)).toBe(true)
    expect(shouldCollapseGraphNavigator(759)).toBe(true)
    expect(shouldCollapseGraphNavigator(760)).toBe(false)
    expect(shouldCollapseGraphNavigator(892)).toBe(false)
    const source = read('graph/GraphSurface.tsx')
    expect(source).toContain('entry.contentRect.width')
    expect(source).toContain('data-navigator-collapsed')
    expect(source).toMatch(/aria-controls=\{`\$\{mode\}-graph-navigator`\}/)
    expect(source).toContain('openNoteRef.current(node.relativePath)')
    expect(source).not.toContain('[visibleSnapshot, nodeActions.onOpenNote]')
  })

  test('shown graph labels remain at least 11px throughout the supported zoom range', () => {
    for (const zoom of [0.15, 0.2, 0.4, 0.65, 1, 1.5, 3]) {
      expect(graphLabelFontSize(zoom) * zoom).toBeGreaterThanOrEqual(11)
    }
    expect(read('graph/cytoscape-adapter.ts')).toMatch(
      /cy\.nodes\(\)\s*\.style\('font-size', fontSize\)/
    )
    expect(read('graph/graph-label-culling.ts')).toContain('graphLabelFontSize(scale)')
  })

  test('disconnected component packing is deterministic and non-overlapping', () => {
    const sizes = [
      { width: 200, height: 160 },
      { width: 100, height: 80 },
      { width: 150, height: 100 }
    ]
    const packed = packGraphComponents(sizes, 1.2)
    expect(packGraphComponents(sizes, 1.2)).toEqual(packed)
    for (let a = 0; a < sizes.length; a++) {
      for (let b = a + 1; b < sizes.length; b++) {
        const p = packed.positions[a]!
        const q = packed.positions[b]!
        expect(
          p.x + sizes[a]!.width <= q.x ||
            q.x + sizes[b]!.width <= p.x ||
            p.y + sizes[a]!.height <= q.y ||
            q.y + sizes[b]!.height <= p.y
        ).toBe(true)
      }
    }
  })

  test('paper prose typography is shared with exports without changing paper tokens', () => {
    const html = renderToStaticMarkup(
      createElement(QuizBlock, {
        question: 'Choose a sentence',
        options: ['The input is sorted', 'The input is random'],
        answerIndex: 0
      })
    )
    expect(html.match(/data-note-prose=""/g)).toHaveLength(3)
    expect(html).toContain('The input is sorted')
    const css = read('preview/interactive-note-theme.css')
    expect(css).toContain(':is([data-note-prose], button[data-note-prose])')
    expect(css).toContain('font-family: var(--note-font-body)')
    expect(css).toContain('text-transform: none')
    expect(read('preview/islands/interactive-note/PredictionGate.tsx')).toContain(
      'data-note-prose=""'
    )
  })

  test('motion is bounded and opt-in to chrome, never document content', () => {
    const css = read('globals.css')
    expect(css).toContain('chrome-enter 150ms ease-out')
    expect(css).toContain('chrome-exit 150ms ease-out forwards')
    expect(css).toContain('@media (prefers-reduced-motion: no-preference)')
    expect(read('hooks/useExitPresence.ts')).toContain('prefers-reduced-motion: reduce')
    for (const file of [
      'preview/MdxPreview.tsx',
      'editor/MdxEditor.tsx',
      'components/layout/MainEditor.tsx'
    ]) {
      expect(read(file)).not.toMatch(
        /chrome-(?:enter|presence|dock-content)|animate-in|fade-in|transition-all/
      )
    }
  })
})
