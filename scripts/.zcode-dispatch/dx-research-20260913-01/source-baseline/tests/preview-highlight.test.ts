import { describe, expect, test } from 'bun:test'
import { compile } from '@mdx-js/mdx'
import { applyPreviewHighlight } from '../src/renderer/src/preview/preview-highlight'
import { rehypePreviewSourceMap } from '../src/renderer/src/preview/rehype-preview-source-map'
import { rehypeSafeHtml } from '../src/renderer/src/preview/safe-html'
import { remarkMarks } from '../src/shared/remark-mark'

describe('applyPreviewHighlight', () => {
  test('wraps an exact prose source range', () => {
    const source = 'Alpha beta omega.'

    expect(applyPreviewHighlight(source, { start: 6, end: 10 })).toBe('Alpha ==beta== omega.')
  })

  test('removes the complete enclosing mark from a partial marked selection', () => {
    const source = 'Alpha ==marked text== omega.'

    expect(
      applyPreviewHighlight(source, {
        start: 10,
        end: 16,
        markStart: 6,
        markEnd: 21
      })
    ).toBe('Alpha marked text omega.')
  })

  test('rejects whitespace, multiline, and malformed mark ranges', () => {
    expect(applyPreviewHighlight('Alpha beta', { start: 5, end: 10 })).toBeNull()
    expect(applyPreviewHighlight('Alpha\nbeta', { start: 0, end: 10 })).toBeNull()
    expect(
      applyPreviewHighlight('Alpha ==beta==', {
        start: 8,
        end: 12,
        markStart: 6,
        markEnd: 12
      })
    ).toBeNull()
  })
})

describe('preview source mapping', () => {
  test('keeps exact prose and mark offsets after sanitization', async () => {
    const source = 'Alpha ==marked== and **bold**.'
    const compiled = String(
      await compile(source, {
        remarkPlugins: [remarkMarks],
        rehypePlugins: [[rehypePreviewSourceMap, { source }], rehypeSafeHtml]
      })
    )

    expect(compiled).toContain('"data-preview-source-start": "0"')
    expect(compiled).toContain('"data-preview-mark-start": "6"')
    expect(compiled).toContain('"data-preview-mark-end": "16"')
    expect(compiled).toContain('"data-preview-source-start": "8"')
    expect(compiled).toContain('"data-preview-source-end": "14"')
    expect(compiled).toContain('"data-preview-source-start": "23"')
    expect(compiled).toContain('"data-preview-source-end": "27"')
  })

  test('does not annotate transformed link or inline-code text', async () => {
    const source = '[linked](https://example.com) and `code`'
    const linkStart = source.indexOf('linked')
    const codeStart = source.indexOf('code')
    const compiled = String(
      await compile(source, {
        rehypePlugins: [[rehypePreviewSourceMap, { source }], rehypeSafeHtml]
      })
    )

    expect(compiled).not.toContain(`"data-preview-source-start": "${linkStart}"`)
    expect(compiled).not.toContain(`"data-preview-source-start": "${codeStart}"`)
  })
})
