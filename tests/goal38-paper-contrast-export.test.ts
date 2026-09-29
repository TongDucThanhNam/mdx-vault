import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderExportTemplate } from '../src/main/services/export-template'

const noteCss = readFileSync('src/renderer/src/preview/interactive-note-theme.css', 'utf8')
const chromeCss = readFileSync('src/renderer/src/globals.css', 'utf8')

function block(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const open = source.indexOf('{', start)
  let depth = 1
  for (let i = open + 1; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') depth--
    if (depth === 0) return source.slice(open + 1, i)
  }
  throw new Error(`Unclosed CSS block: ${selector}`)
}

function token(source: string, name: string): string {
  const match = source.match(new RegExp(`(?:^|\\n)\\s*${name}:\\s*(#[0-9a-fA-F]{3,6});`))
  if (!match) throw new Error(`Missing literal ${name}`)
  return match[1]
}

function luminance(hex: string): number {
  const raw = hex.slice(1)
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(full.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(a: string, b: string): number {
  const light = Math.max(luminance(a), luminance(b))
  const dark = Math.min(luminance(a), luminance(b))
  return (light + 0.05) / (dark + 0.05)
}

describe('GOAL-38 paper and chrome contracts', () => {
  test('dark paper uses lifted inverse tokens for prose and registry chips', () => {
    const dark = block(
      noteCss,
      ".note-editorial-surface[data-reading-paper='dark'],\n.mdx-preview[data-reading-paper='dark'],\n[data-wikilink-preview-layer][data-reading-paper='dark']"
    )
    expect(dark).toContain('--note-inverse-fill: var(--note-paper-muted)')
    expect(dark).toContain('--note-inverse-ink: var(--note-ink)')
    const selectorStart = noteCss.search(
      /\.mdx-preview\[data-reading-paper='dark'\]\s*:is\(\s*code,/
    )
    expect(selectorStart).toBeGreaterThanOrEqual(0)
    const selectorEnd = noteCss.indexOf('{', selectorStart)
    const selector = noteCss.slice(selectorStart, selectorEnd).trimEnd()
    const treatment = block(noteCss, selector)
    expect(treatment).toContain('background: var(--note-inverse-fill)')
    expect(treatment).toContain('color: var(--note-inverse-ink)')
    expect(treatment).toContain('border: 1px solid var(--note-inverse-line)')
    for (const part of [
      'code',
      'th',
      'mark',
      '.in-label',
      '.in-pill',
      '.in-widget-status',
      '.in-question-level',
      '.in-command'
    ]) {
      expect(selector).toContain(part)
    }
    expect(block(noteCss, '.mdx-preview .in-button:hover:not(:disabled)')).toContain(
      'background: var(--note-inverse-fill)'
    )
    expect(block(noteCss, '.mdx-preview .in-comparison-bar')).toContain(
      'background: var(--note-data-fill)'
    )
    expect(
      block(
        noteCss,
        ".mdx-preview.mdx-hover-preview[data-reading-paper='dark'] [data-hover-preview-target='true']"
      )
    ).toContain('background: var(--note-inverse-fill)')
  })

  test('palette text pairs meet AA and interactive borders meet 3:1', () => {
    const lightChrome = block(chromeCss, ':root')
    const darkChrome = block(chromeCss, '.dark')
    const lightPaper = block(noteCss, '.mdx-preview')
    const darkPaper = block(
      noteCss,
      ".note-editorial-surface[data-reading-paper='dark'],\n.mdx-preview[data-reading-paper='dark'],\n[data-wikilink-preview-layer][data-reading-paper='dark']"
    )
    const textPairs: Array<[string, string, number]> = [
      [token(lightChrome, '--foreground'), token(lightChrome, '--background'), 4.5],
      [token(lightChrome, '--muted-foreground'), token(lightChrome, '--chrome'), 4.5],
      [token(darkChrome, '--foreground'), token(darkChrome, '--background'), 4.5],
      [token(darkChrome, '--muted-foreground'), token(darkChrome, '--chrome'), 4.5],
      [token(lightPaper, '--note-ink'), token(lightPaper, '--note-paper'), 4.5],
      [token(lightPaper, '--note-accent'), token(lightPaper, '--note-paper'), 4.5],
      [token(darkPaper, '--note-ink'), token(darkPaper, '--note-paper'), 4.5],
      [token(darkPaper, '--note-accent'), token(darkPaper, '--note-paper'), 4.5],
      [token(darkPaper, '--note-ink'), token(darkPaper, '--note-paper-muted'), 4.5],
      [token(darkPaper, '--note-on-solid'), token(darkPaper, '--note-accent'), 4.5],
      [token(darkPaper, '--note-on-solid'), token(darkPaper, '--note-result'), 4.5]
    ]
    for (const [foreground, background, minimum] of textPairs) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum)
    }
    for (const chrome of [lightChrome, darkChrome]) {
      expect(
        contrast(token(chrome, '--input'), token(chrome, '--background'))
      ).toBeGreaterThanOrEqual(3)
      expect(
        contrast(token(chrome, '--ring'), token(chrome, '--background'))
      ).toBeGreaterThanOrEqual(3)
    }
    expect(
      contrast(token(darkPaper, '--note-line'), token(darkPaper, '--note-paper'))
    ).toBeGreaterThanOrEqual(3)
  })

  test('export retains title and prose but never shows raw frontmatter properties', () => {
    const html = renderExportTemplate({
      title: 'Reading title',
      bodyHtml: '<h1>Reading title</h1><p>Visible prose</p>',
      ...{
        frontmatter: {
          title: 'Reading title',
          theme: 'interactive-note',
          privateKey: 'HIDDEN_SENTINEL'
        }
      },
      generatedAt: '2026-09-30T00:00:00.000Z'
    })
    expect(html).toContain('<strong>Reading title</strong>')
    expect(html).toContain('<p>Visible prose</p>')
    expect(html).not.toContain('mdx-vault-frontmatter')
    expect(html).not.toContain('HIDDEN_SENTINEL')
    expect(html).not.toContain('interactive-note</dd>')
  })
})
