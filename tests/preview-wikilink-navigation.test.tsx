import { describe, expect, test } from 'bun:test'
import { type AnchorHTMLAttributes, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { createMdxComponents } from '../src/renderer/src/preview/mdx-components'
import { PreviewImageCache } from '../src/renderer/src/preview/preview-image'
import type { IndexedNoteSummary } from '../src/renderer/src/vault/types'
import { createWikilinkUrl } from '../src/shared/wikilinks'

describe('Reading preview wikilink navigation', () => {
  test('renders an accessible button and navigates to the resolved canonical path', () => {
    const navigatedPaths: string[] = []
    const link = renderWikilink({
      notes: [SECOND_NOTE],
      target: 'Companion',
      onNavigate: (relativePath) => navigatedPaths.push(relativePath)
    })

    expect(link.type).toBe('button')
    expect(link.props.type).toBe('button')
    expect(link.props['aria-label']).toBe('Open Companion')
    expect(link.props.title).toBe('notes/Second Note.mdx')
    expect(renderToStaticMarkup(link)).toContain('>Companion</button>')

    link.props.onClick()

    expect(navigatedPaths).toEqual(['notes/Second Note.mdx'])
  })

  test('keeps an unresolved wikilink accessible without navigating', () => {
    const navigatedPaths: string[] = []
    const link = renderWikilink({
      notes: [SECOND_NOTE],
      target: 'Missing Note',
      onNavigate: (relativePath) => navigatedPaths.push(relativePath)
    })

    expect(link.type).toBe('button')
    expect(link.props.type).toBe('button')
    expect(link.props['aria-label']).toBe('Unresolved link Missing Note')
    expect(link.props.title).toBe('Unresolved: Missing Note')

    link.props.onClick()

    expect(navigatedPaths).toEqual([])
  })
})

interface WikilinkButtonProps {
  type: 'button'
  title: string
  'aria-label': string
  onClick: () => void
}

function renderWikilink({
  notes,
  target,
  onNavigate
}: {
  notes: IndexedNoteSummary[]
  target: string
  onNavigate: (relativePath: string) => void
}): ReactElement<WikilinkButtonProps> {
  const components = createMdxComponents({
    notes,
    onNavigate,
    selectedPath: 'notes/Welcome.mdx',
    imageCache: new PreviewImageCache()
  })
  const Anchor = components.a

  if (typeof Anchor !== 'function') {
    throw new Error('Expected the MDX anchor override to be a function component')
  }

  const rendered = (Anchor as (props: AnchorHTMLAttributes<HTMLAnchorElement>) => ReactNode)({
    href: createWikilinkUrl(target),
    children: target
  })

  if (!isValidElement<WikilinkButtonProps>(rendered)) {
    throw new Error('Expected the MDX anchor override to render a React element')
  }

  return rendered
}

const SECOND_NOTE: IndexedNoteSummary = {
  id: 'second-note',
  relativePath: 'notes/Second Note.mdx',
  title: 'Second Note',
  aliases: ['Companion'],
  mtimeMs: 1,
  contentHash: 'second-note-hash'
}
