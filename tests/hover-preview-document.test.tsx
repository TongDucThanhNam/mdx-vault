import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  MAX_HOVER_PREVIEW_SOURCE_LENGTH,
  SafeHoverPreviewDocument
} from '../src/renderer/src/preview/hover-preview-document'

describe('Safe hover preview document', () => {
  test('renders prose structure without evaluating MDX behavior', () => {
    const marker = '__mdxVaultHoverPreviewExecuted'
    ;(globalThis as Record<string, unknown>)[marker] = false

    const source = `---
title: Previewed note
---

# Systems Internals

Paragraph with **strong prose**, ==a mark==, and [[Another Note|a wikilink]].

> [!tip] Read this first
> Keep the preview static.

- One
- Two

\`inline code\`

<QuizBlock answer={globalThis.${marker} = true}>
  Child prose stays readable.
</QuizBlock>

{globalThis.${marker} = true}
`

    const html = renderToStaticMarkup(
      createElement(SafeHoverPreviewDocument, {
        source
      })
    )

    expect(html).toContain('<h1>Systems Internals</h1>')
    expect(html).toContain('<strong>strong prose</strong>')
    expect(html).toContain('<mark>a mark</mark>')
    expect(html).toContain('class="hover-preview-link">a wikilink</span>')
    expect(html).toContain('class="mdx-callout"')
    expect(html).toContain('data-callout="tip"')
    expect(html).toContain('<ul>')
    expect(html).toContain('<code>inline code</code>')
    expect(html).toContain('Interactive · QuizBlock')
    expect(html).toContain('Child prose stays readable.')
    expect(html).toContain('Dynamic content hidden in page preview')
    expect(html).not.toContain('title: Previewed note')
    expect(html).not.toContain(`globalThis.${marker}`)
    expect((globalThis as Record<string, unknown>)[marker]).toBe(false)

    delete (globalThis as Record<string, unknown>)[marker]
  })

  test('replaces images and raw JSX with inert labels', () => {
    const source = `![Architecture](assets/system.png)

<img src="https://example.invalid/tracker.png" onError={() => alert('no')} />
`
    const html = renderToStaticMarkup(createElement(SafeHoverPreviewDocument, { source }))

    expect(html).toContain('role="img"')
    expect(html).toContain('Architecture')
    expect(html).toContain('Interactive · img')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('example.invalid')
    expect(html).not.toContain('onError')
  })

  test('marks the requested nested heading while keeping the full note', () => {
    const source = `# Systems

## Storage

### Caching

Storage cache details.

## Memory

### Caching

Memory cache details.
`
    const html = renderToStaticMarkup(
      createElement(SafeHoverPreviewDocument, {
        source,
        subpath: {
          kind: 'heading',
          segments: ['Memory', 'Caching']
        }
      })
    )

    expect(html).toContain('Storage cache details.')
    expect(html).toContain('Memory cache details.')
    expect(html).toContain(
      '<h3 data-hover-preview-target="true">Caching</h3><p>Memory cache details.</p>'
    )
    expect(html.match(/data-hover-preview-target="true"/g)?.length).toBe(1)
  })

  test('rejects very large notes before parsing', () => {
    const source = 'x'.repeat(MAX_HOVER_PREVIEW_SOURCE_LENGTH + 1)

    expect(() => renderToStaticMarkup(createElement(SafeHoverPreviewDocument, { source }))).toThrow(
      'This note is too large for an inline preview.'
    )
  })
})
