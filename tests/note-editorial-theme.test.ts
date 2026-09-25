import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const mainSource = readFileSync('src/renderer/src/main.tsx', 'utf8')
const previewSource = readFileSync('src/renderer/src/preview/MdxPreview.tsx', 'utf8')
const hoverPreviewSource = readFileSync('src/renderer/src/preview/WikilinkPreview.tsx', 'utf8')
const livePreviewSource = readFileSync('src/renderer/src/editor/live-preview.ts', 'utf8')
const noteStyles = readFileSync('src/renderer/src/preview/interactive-note-theme.css', 'utf8')

describe('Editorial note theme', () => {
  test('bundles the three note font roles locally and enables the theme on every note surface', () => {
    expect(mainSource).toContain('@fontsource/playfair-display/900.css')
    expect(mainSource).toContain('@fontsource/lora/400.css')
    expect(mainSource).toContain('@fontsource/courier-prime/700.css')
    expect(previewSource).toContain("'mdx-preview theme-editorial-note px-5 py-10 sm:px-8'")
    expect(hoverPreviewSource).toContain('mdx-preview mdx-hover-preview theme-editorial-note')
  })

  test('keeps the exact paper palette and excludes soft-theme escape hatches', () => {
    expect(noteStyles).toContain('--note-paper: #f9f9f7')
    expect(noteStyles).toContain('--note-paper-muted: #efefea')
    expect(noteStyles).toContain('--note-ink: #111111')
    expect(noteStyles).toContain('--note-accent: #d32f2f')
    expect(noteStyles).toContain('--note-result: #2b5797')
    expect(noteStyles).toContain('--note-shadow: 4px 4px 0 var(--note-ink)')
    expect(noteStyles).toContain('--in-paper: var(--note-paper)')
    expect(noteStyles).toContain('transform: translate(2px, 2px)')
    expect(noteStyles).not.toContain('color-mix')
    expect(noteStyles).not.toContain('gradient')
    expect(noteStyles).not.toContain('--in-result-tint')
    expect(noteStyles).not.toContain('--in-accent-tint')

    const radii = [...noteStyles.matchAll(/border-radius:\s*([^;]+);/g)].map((match) => match[1])
    expect(new Set(radii)).toEqual(new Set(['0']))
  })

  test('publishes a layered authoring contract instead of one-off component values', () => {
    for (const token of [
      '--note-font-display',
      '--note-font-body',
      '--note-font-ui',
      '--note-space-1',
      '--note-space-7',
      '--note-rule',
      '--note-shadow-sm',
      '--note-focus',
      '--note-control-height',
      '--note-measure'
    ]) {
      expect(noteStyles).toContain(token)
    }

    for (const primitive of [
      '.note-kicker',
      '.note-deck',
      '.note-label',
      '.note-panel',
      '.note-explanation',
      '.note-result',
      '.note-step',
      '.note-folio'
    ]) {
      expect(noteStyles).toContain(primitive)
    }
  })

  test('carries the same system through compact, motion, focus and print contexts', () => {
    expect(noteStyles).toContain('@media (max-width: 640px)')
    expect(noteStyles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(noteStyles).toContain('@media print')
    expect(noteStyles).toContain(':focus-visible')
    expect(noteStyles).toContain('print-color-adjust: exact')
    expect(noteStyles).toContain('break-inside: avoid-page')
  })

  test('keeps editable Live text on the shared editor metrics and retains note accents', () => {
    expect(livePreviewSource).toContain('var(--editor-font-family, var(--font-code))')
    expect(livePreviewSource).toContain('var(--editor-line-height, 1.6)')
    expect(livePreviewSource).not.toContain("fontSize: '2.5rem'")
    expect(livePreviewSource).toContain("backgroundColor: '#f9f9f7'")
    expect(livePreviewSource).toContain("color: '#d32f2f'")
  })
})
