import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { livePreviewThemeSpec } from '../src/renderer/src/editor/live-preview'

const liveSource = readFileSync('src/renderer/src/editor/live-preview.ts', 'utf8')
const noteCss = readFileSync('src/renderer/src/preview/interactive-note-theme.css', 'utf8')
const globalCss = readFileSync('src/renderer/src/globals.css', 'utf8')

// Whitespace-normalized selectors, not declaration text. Browser matching is
// exercised against native prose and nested island fixtures by the visual probe.
function rules(css: string): Array<{ selector: string; body: string }> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim(),
    body: match[2]
  }))
}

function splitSelectors(selector: string): string[] {
  const selectors: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < selector.length; i++) {
    if (selector[i] === '(' || selector[i] === '[') depth++
    if (selector[i] === ')' || selector[i] === ']') depth--
    if (selector[i] === ',' && depth === 0) {
      selectors.push(selector.slice(start, i).trim())
      start = i + 1
    }
  }
  selectors.push(selector.slice(start).trim())
  return selectors
}

describe('GOAL-40 Live and render craft', () => {
  test('Live contains no literal colors or Source-owned plane/token overrides', () => {
    expect(liveSource).not.toMatch(/#[\da-f]{3,8}\b|\brgba?\s*\(/i)
    for (const selector of Object.keys(livePreviewThemeSpec)) {
      expect(selector).not.toMatch(
        /^&$|\.cm-(?:scroller|content|gutters|selection|cursor|dropCursor)\b|\.tok-/
      )
      expect(selector).not.toMatch(/^\.cm-activeLine(?:,|$)/)
      expect(selector).not.toContain('.cm-mdx-math-block')
      expect(selector).not.toContain('.cm-mdx-mermaid-block')
    }
  })

  test('decorations preserve weight, link cues, hierarchy and translucent selection-safe tints', () => {
    expect(livePreviewThemeSpec['.cm-line .cm-live-preview-strong']).toEqual({
      color: 'var(--foreground)',
      fontWeight: '600'
    })
    expect(livePreviewThemeSpec['.cm-line .cm-live-preview-wikilink-unresolved']).toMatchObject({
      textDecorationStyle: 'dashed'
    })
    for (const [selector, spec] of Object.entries(livePreviewThemeSpec)) {
      if ('backgroundColor' in spec) expect(spec.backgroundColor).toContain('transparent')
      if (selector.includes('cm-wrap-bounded')) expect(spec).toHaveProperty('maxWidth')
    }
    expect(livePreviewThemeSpec['.cm-live-preview-heading-1'].fontSize).toBe('1.3em')
    expect(livePreviewThemeSpec['.cm-live-preview-heading-2'].fontSize).toBe('1.15em')
    expect(livePreviewThemeSpec['.cm-live-preview-heading-3'].fontSize).toBe('1.05em')
    expect(
      livePreviewThemeSpec['.cm-live-preview-blockquote.cm-activeLine'].backgroundImage
    ).toContain('transparent')
  })

  test('every prose list/table rule excludes island roots and their descendants at zero specificity', () => {
    for (const css of [globalCss, noteCss]) {
      const proseRules = rules(css)
        .flatMap(({ selector }) => splitSelectors(selector))
        .filter(
          (selector) =>
            selector.includes('.mdx-preview') &&
            /\b(?:ul|ol|li|table|th|td|tr)\b/.test(selector) &&
            !/\.in-|\.note-|\.mdx-callout|data-footnote/.test(selector)
        )
      expect(proseRules.length).toBeGreaterThan(5)
      for (const selector of proseRules) {
        expect(selector).toContain(
          ":where( :not([data-registry-island], [data-registry-island] *, [class^='in-'], [class^='in-'] *) )"
        )
      }
    }
    for (const file of [
      'Counter.tsx',
      'islands/QuizBlock.tsx',
      'islands/DataChart.tsx',
      'islands/EquationSlider.tsx',
      'islands/AlgorithmVisualizer.tsx',
      'registry/messages.tsx',
      'registry/RegistryIslandBoundary.tsx'
    ]) {
      expect(readFileSync(`src/renderer/src/preview/${file}`, 'utf8')).toContain(
        'data-registry-island=""'
      )
    }
  })

  test('closed disclosure hugs a centered summary; opening adds body space and a direction cue', () => {
    const themeRules = rules(noteCss).filter(({ selector }) =>
      selector.includes('theme-editorial-note')
    )
    const details = themeRules.find(
      ({ selector, body }) => / details:where/.test(selector) && body.includes('padding:')
    )
    const summary = themeRules.find(
      ({ selector }) => / summary:where/.test(selector) && !selector.includes('::')
    )
    expect(details?.body).toContain('padding: 0 1.1rem')
    expect(summary?.body).toContain('display: flex')
    expect(summary?.body).toContain('align-items: center')
    expect(summary?.body).toContain('min-height: var(--note-control-height)')
    expect(
      themeRules.some(
        ({ selector, body }) =>
          selector.includes('details[open]') && body.includes('padding-bottom: 0.85rem')
      )
    ).toBe(true)
    expect(
      themeRules.some(
        ({ selector, body }) =>
          selector.includes('details[open] > summary') &&
          body.includes('margin-bottom: var(--note-space-3)')
      )
    ).toBe(true)
    expect(noteCss).toContain("content: '▸'")
    expect(noteCss).toContain("content: '▾'")
  })
})
