import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  buildOutlineConnectorPath,
  getOutlineLineOffset,
  resolveActiveHeadingFromOffset,
  resolveActiveHeadingFromViewport,
  resolveAvailableHeadingId
} from '../src/renderer/src/components/layout/living-outline'
import { I18nProvider } from '../src/renderer/src/i18n/I18nProvider'
import { OutlinePanel } from '../src/renderer/src/panels/OutlinePanel'
import type { NoteHeadingResult } from '../src/renderer/src/vault/types'

const headings: NoteHeadingResult[] = [
  heading('intro', 1, 0, 0),
  heading('setup', 2, 1, 40),
  heading('details', 4, 2, 90)
]

describe('GOAL-29 living outline state', () => {
  test('tracks the nearest source heading and preserves a valid reading candidate', () => {
    expect(resolveActiveHeadingFromOffset(headings, 0)).toBe('intro')
    expect(resolveActiveHeadingFromOffset(headings, 72)).toBe('setup')
    expect(resolveActiveHeadingFromOffset(headings, 200)).toBe('details')
    expect(resolveAvailableHeadingId(headings, 'setup')).toBe('setup')
    expect(resolveAvailableHeadingId(headings, 'removed')).toBe('intro')
    expect(resolveAvailableHeadingId([], 'setup')).toBeNull()
  })

  test('tracks Reading against the nested viewport activation line', () => {
    const viewportHeadings = [
      { id: 'intro', top: -80 },
      { id: 'setup', top: 28 },
      { id: 'details', top: 240 }
    ]

    expect(resolveActiveHeadingFromViewport(viewportHeadings, 60)).toBe('setup')
    expect(resolveActiveHeadingFromViewport(viewportHeadings, -120)).toBe('intro')
    expect(resolveActiveHeadingFromViewport(viewportHeadings, 60, true)).toBe('details')
    expect(resolveActiveHeadingFromViewport([], 60)).toBeNull()
  })

  test('builds a deterministic hierarchy path across skipped heading levels', () => {
    const points = [
      { depth: 1, top: 16 },
      { depth: 2, top: 48 },
      { depth: 4, top: 80 }
    ]

    expect(getOutlineLineOffset(4, 1)).toBe(36)
    expect(buildOutlineConnectorPath(points, 1)).toBe(
      'M 6 16 L 6 32 L 16 32 L 16 48 L 16 64 L 36 64 L 36 80'
    )
    expect(buildOutlineConnectorPath([], 1)).toBe('')
  })

  test('keeps heading navigation semantic without depending on connector graphics', () => {
    const html = renderToStaticMarkup(
      createElement(
        I18nProvider,
        { locale: 'en' },
        createElement(OutlinePanel, {
          headings,
          activeHeadingId: 'setup',
          selectedPath: 'Note.mdx',
          onSelectHeading: () => undefined
        })
      )
    )

    expect(html).toContain('<ol')
    expect(html).toContain('aria-current="location"')
    expect(html).toContain('aria-label="Heading level 2: setup"')
    expect(html).toContain('On this note')
    expect(html).not.toContain('border-l-')
  })
})

function heading(
  id: string,
  depth: number,
  position: number,
  sourceFrom: number
): NoteHeadingResult {
  return {
    id,
    depth,
    text: id,
    slug: id,
    position,
    sourceFrom,
    sourceTo: sourceFrom + 10
  }
}
