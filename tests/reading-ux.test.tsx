import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { run } from '@mdx-js/mdx'
import { createElement, Fragment } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { ErrorBoundary } from 'react-error-boundary'
import {
  LatestPreviewCompile,
  SupersededPreviewCompile
} from '../src/renderer/src/preview/latest-preview-compile'
import { compileMdxFunctionBody } from '../src/renderer/src/preview/mdx-compile-worker-runtime'
import { createMdxComponents } from '../src/renderer/src/preview/mdx-components'
import {
  selectBlockForSourceOffset,
  selectTopVisibleBlock,
  sourceOffsetToLine
} from '../src/renderer/src/preview/preview-anchor'
import { PreviewImageCache } from '../src/renderer/src/preview/preview-image'
import { RegistryIslandBoundary } from '../src/renderer/src/preview/registry/RegistryIslandBoundary'
import { visibleRenderState } from '../src/renderer/src/preview/useLastGoodRender'

describe('single-pane Reading state', () => {
  test('retains the last good render while pending and after failure, but not across notes', () => {
    const good = { Content: () => <p>Good</p>, warnings: [] }
    const state = { notePath: 'one.mdx', source: '# Good', result: good, failure: null }
    expect(visibleRenderState(state, 'one.mdx', '# New')).toEqual({
      result: good,
      failure: null,
      pending: true
    })
    const failed = { ...state, failure: { source: '# New', diagnostic: { message: 'Broken' } } }
    expect(visibleRenderState(failed, 'one.mdx', '# New')).toEqual({
      result: good,
      failure: { message: 'Broken' },
      pending: false
    })
    expect(visibleRenderState(failed, 'two.mdx', '# New')).toEqual({
      result: null,
      failure: null,
      pending: true
    })
  })

  test('coalesces queued work to the latest source without publishing superseded results', async () => {
    const resolvers: Array<(value: string) => void> = []
    const started: string[] = []
    const scheduler = new LatestPreviewCompile<string>((source) => {
      started.push(source)
      return new Promise((resolve) => resolvers.push(resolve))
    })
    const first = scheduler.request('first')
    await Promise.resolve()
    const stale = scheduler.request('stale')
    const latest = scheduler.request('latest')
    await expect(first).rejects.toBeInstanceOf(SupersededPreviewCompile)
    await expect(stale).rejects.toBeInstanceOf(SupersededPreviewCompile)
    expect(started).toEqual(['first'])
    resolvers[0]?.('old result')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(started).toEqual(['first', 'latest'])
    resolvers[1]?.('new result')
    expect(await latest).toBe('new result')
  })

  test('selects the nearest semantic block for the cursor and top viewport', () => {
    const blocks = [
      { offset: 0, top: -50 },
      { offset: 20, top: -4 },
      { offset: 40, top: 80 }
    ]
    expect(selectBlockForSourceOffset(blocks, 32)).toBe(blocks[1])
    expect(selectTopVisibleBlock(blocks, 0)).toBe(blocks[1])
    expect(selectBlockForSourceOffset(blocks, 0)).toBe(blocks[0])
  })

  test('maps heading, paragraph, list item, code and trusted island to source lines', async () => {
    const source =
      '# Heading\n\nParagraph text.\n\n- List item\n\n```js\nconst x = 1\n```\n\n<QuizBlock question="Q" answer="A" />\n'
    const compiled = await compileMdxFunctionBody(source)
    const module = await run(compiled.code, { Fragment, jsx, jsxs })
    const html = renderToStaticMarkup(
      createElement(module.default, {
        components: { QuizBlock: () => <div>Island</div> }
      })
    )
    const mappedLines = [...html.matchAll(/data-preview-block-start="(\d+)"/g)].map((match) =>
      sourceOffsetToLine(source, Number(match[1]))
    )
    for (const line of [1, 3, 5, 7, 11]) expect(mappedLines).toContain(line)
    for (const line of [1, 3, 5, 7, 11]) {
      expect(html).toContain(`data-preview-block-line="${line}"`)
    }
  })

  test('contains a trusted island failure without replacing sibling prose', () => {
    const boundary = RegistryIslandBoundary({
      name: 'QuizBlock',
      source: '<QuizBlock />',
      onRevealLine: () => {},
      children: <span>Island</span>
    })
    expect(boundary.type).toBe(ErrorBoundary)
    const fallback = boundary.props.fallbackRender as (input: { error: Error }) => React.ReactNode
    const html = renderToStaticMarkup(
      <>
        <p>Before island</p>
        {fallback({ error: new Error('Failed to render') })}
        <p>After island</p>
      </>
    )
    expect(html).toContain('Before island')
    expect(html).toContain('QuizBlock runtime error')
    expect(html).toContain('Failed to render')
    expect(html).toContain('Reveal source')
    expect(html).toContain('After island')
  })

  test('has no note-paper font size below the 12px label floor', () => {
    const styles = readFileSync('src/renderer/src/preview/interactive-note-theme.css', 'utf8')
    const remSizes = [...styles.matchAll(/font-size:\s*(\d+(?:\.\d+)?)rem/g)].map((match) =>
      Number(match[1])
    )
    const pxSizes = [...styles.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((match) =>
      Number(match[1])
    )
    expect(remSizes.every((size) => size >= 0.75)).toBe(true)
    expect(pxSizes.every((size) => size >= 12)).toBe(true)
    const hoverPreview = readFileSync('src/renderer/src/preview/WikilinkPreview.tsx', 'utf8')
    expect(hoverPreview).not.toMatch(/text-\[(?:[0-9]|10|11)px\]/)
    expect(styles).toContain('[data-footnote-ref]')
    expect(styles).toContain('[data-footnote-backref]')
    expect(styles).toContain('[data-footnotes]')
    expect(styles).toContain('@media print')
  })

  test('keeps sanitized GFM footnote landmarks and local back-links', async () => {
    const source = '# Footnotes\n\nA reference[^one].\n\n[^one]: Definition.\n'
    const compiled = await compileMdxFunctionBody(source)
    const module = await run(compiled.code, { Fragment, jsx, jsxs })
    const html = renderToStaticMarkup(
      createElement(module.default, {
        components: createMdxComponents({
          notes: [],
          onNavigate: () => {
            throw new Error('Fragment links must not navigate notes')
          },
          selectedPath: 'notes/footnotes.mdx',
          imageCache: new PreviewImageCache()
        })
      })
    )
    expect(html).toContain('<section data-footnotes')
    expect(html).toContain('data-footnote-ref')
    expect(html).toContain('data-footnote-backref')
    expect(html).toContain('href="#user-content-fn-one"')
    expect(html).toContain('id="user-content-fn-one"')
    expect(html).toContain('id="footnote-label"')
    expect(html).not.toContain('Open #user-content')
  })
})
