import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { InteractiveProofWorkbench } from '../src/renderer/src/interactive/InteractiveProofWorkbench'

describe('Interactive Proof workbench accessibility contract', () => {
  test('exposes textual proof state, named controls, responsive panes, and missing-file actions', () => {
    const html = renderToStaticMarkup(
      createElement(InteractiveProofWorkbench, {
        activeRelativePath: 'interactives/counter/component.tsx',
        value: 'export default function Counter() { return null }\n',
        savedContent: 'export default function Counter() { return null }\n',
        treeFiles: [
          {
            relativePath: 'interactives/counter/component.tsx',
            name: 'component.tsx',
            directory: 'interactives/counter',
            extension: '.tsx'
          }
        ],
        vaultSessionId: 1,
        starterConsented: false,
        onConsumeStarterConsent: () => {},
        onChange: () => {},
        onSave: async () => true,
        onOpenFile: async () => true,
        getSavedContent: () => 'export default function Counter() { return null }\n',
        onRevealProject: () => {}
      })
    )

    expect(html).toContain('aria-label="Interactive Proof for counter"')
    expect(html).toContain('Not run · 0 problems')
    expect(html).toContain('Run isolated proof')
    expect(html).toContain('Stop proof')
    expect(html).toContain('role="tablist"')
    expect(html).toContain('Source')
    expect(html).toContain('Proof')
    expect(html).toContain('Problems · 0')
    expect(html).toContain('lg:grid')
    expect(html).toContain('lg:hidden')
    expect(html).toContain(
      'aria-label="manifest.json is missing; reveal the interactive project folder"'
    )
    expect(html).toContain('manifest.json · missing · reveal folder')
    expect(html).not.toContain('gradient')
  })

  test('keeps source first in keyboard order before proof and Problems tabs', () => {
    const html = renderToStaticMarkup(
      createElement(InteractiveProofWorkbench, {
        activeRelativePath: 'interactives/counter/README.md',
        value: '# Counter\n',
        savedContent: '# Counter\n',
        treeFiles: [],
        vaultSessionId: 4,
        starterConsented: false,
        onConsumeStarterConsent: () => {},
        onChange: () => {},
        onSave: async () => true,
        onOpenFile: async () => true,
        getSavedContent: () => '# Counter\n',
        onRevealProject: () => {}
      })
    )

    expect(html.indexOf('aria-controls="interactive-source-panel"')).toBeLessThan(
      html.indexOf('aria-controls="interactive-proof-panel"')
    )
    expect(html.indexOf('aria-controls="interactive-proof-panel"')).toBeLessThan(
      html.indexOf('aria-controls="interactive-problems-panel"')
    )
    expect(html).toContain('motion-reduce:transition-none')
  })
})
