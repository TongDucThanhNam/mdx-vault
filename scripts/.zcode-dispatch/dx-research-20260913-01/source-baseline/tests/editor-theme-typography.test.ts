import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  SOURCE_EDITOR_DEFAULT_FONT_SIZE,
  SOURCE_EDITOR_FONT_FAMILY,
  SOURCE_EDITOR_LINE_HEIGHT
} from '../src/renderer/src/editor/editor-theme'

const mainSource = readFileSync('src/renderer/src/main.tsx', 'utf8')
const globalStyles = readFileSync('src/renderer/src/globals.css', 'utf8')
const editorThemeSource = readFileSync('src/renderer/src/editor/editor-theme.ts', 'utf8')

describe('Source editor typography', () => {
  test('defaults to JetBrains Mono with local Vietnamese support and keeps Maple available', () => {
    expect(SOURCE_EDITOR_FONT_FAMILY).toBe('var(--editor-font-family, var(--font-code))')
    expect(globalStyles).toContain("--font-code: 'JetBrains Mono'")
    expect(mainSource).toContain('@fontsource/jetbrains-mono/400.css')
    expect(mainSource).toContain('@fontsource/jetbrains-mono/400-italic.css')
    expect(mainSource).toContain('@fontsource/ibm-plex-mono/400-italic.css')
    expect(mainSource).toContain('@fontsource/maple-mono/400.css')
    expect(mainSource).toContain('@fontsource/maple-mono/400-italic.css')
    expect(editorThemeSource).not.toContain('Courier Prime')
  })

  test('keeps the source surface dense without dropping below a readable default', () => {
    expect(SOURCE_EDITOR_DEFAULT_FONT_SIZE).toBe('var(--editor-font-size, 15px)')
    expect(SOURCE_EDITOR_LINE_HEIGHT).toBe('var(--editor-line-height, 1.6)')
  })
})
