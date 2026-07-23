import { describe, expect, test } from 'bun:test'
import { evaluate } from '@mdx-js/mdx'
import {
  type AnchorHTMLAttributes,
  createElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode
} from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

import { createMdxComponents } from '../src/renderer/src/preview/mdx-components'
import { PreviewImageCache } from '../src/renderer/src/preview/preview-image'
import { rehypeSafeHtml } from '../src/renderer/src/preview/safe-html'
import type { WikilinkPreviewIntent } from '../src/renderer/src/preview/useWikilinkPreview'
import type { IndexedNoteSummary } from '../src/renderer/src/vault/types'
import { remarkWikilink } from '../src/shared/remark-wikilink'
import { createWikilinkUrl, type WikilinkSubpath } from '../src/shared/wikilinks'

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

  test('carries a nested heading target through navigation and hover intent', () => {
    const navigations: Array<{
      relativePath: string
      subpath: WikilinkSubpath | null | undefined
    }> = []
    const previewIntents: WikilinkPreviewIntent[] = []
    const link = renderWikilink({
      notes: [SECOND_NOTE],
      target: 'Companion#Architecture#Caching',
      onNavigate: (relativePath, subpath) => navigations.push({ relativePath, subpath }),
      onPreviewRequest: (intent) => previewIntents.push(intent)
    })
    const anchor = createAnchorStub()

    link.props.onPointerEnter({ currentTarget: anchor })
    link.props.onClick()

    const expectedSubpath: WikilinkSubpath = {
      kind: 'heading',
      segments: ['Architecture', 'Caching']
    }
    expect(navigations).toEqual([
      {
        relativePath: 'notes/Second Note.mdx',
        subpath: expectedSubpath
      }
    ])
    expect(previewIntents).toEqual([
      {
        note: SECOND_NOTE,
        subpath: expectedSubpath,
        anchor,
        trigger: 'pointer'
      }
    ])
  })

  test('resolves a same-note heading from the selected Reading note', () => {
    const navigations: string[] = []
    const link = renderWikilink({
      notes: [WELCOME_NOTE, SECOND_NOTE],
      target: '#Overview',
      onNavigate: (relativePath) => navigations.push(relativePath)
    })

    link.props.onClick()

    expect(navigations).toEqual(['notes/Welcome.mdx'])
  })

  test('requests a delayed preview for pointer and keyboard intent', () => {
    const previewIntents: WikilinkPreviewIntent[] = []
    const dismissedTargets: (EventTarget | null | undefined)[] = []
    const link = renderWikilink({
      notes: [SECOND_NOTE],
      target: 'Companion',
      onNavigate: () => {},
      onPreviewRequest: (intent) => previewIntents.push(intent),
      onPreviewDismiss: (relatedTarget) => dismissedTargets.push(relatedTarget)
    })
    const anchor = createAnchorStub()
    const outsideTarget = {} as EventTarget

    link.props.onPointerEnter({ currentTarget: anchor })
    link.props.onFocus({ currentTarget: anchor })
    link.props.onPointerLeave({ relatedTarget: outsideTarget })
    link.props.onBlur({ relatedTarget: null })

    expect(link.props['aria-haspopup']).toBe('dialog')
    expect(previewIntents).toEqual([
      { note: SECOND_NOTE, subpath: null, anchor, trigger: 'pointer' },
      { note: SECOND_NOTE, subpath: null, anchor, trigger: 'focus' }
    ])
    expect(dismissedTargets).toEqual([outsideTarget, null])
  })

  test('does not request a preview for an unresolved wikilink', () => {
    const previewIntents: WikilinkPreviewIntent[] = []
    const link = renderWikilink({
      notes: [SECOND_NOTE],
      target: 'Missing Note',
      onNavigate: () => {},
      onPreviewRequest: (intent) => previewIntents.push(intent)
    })
    const anchor = createAnchorStub()

    link.props.onPointerEnter({ currentTarget: anchor })
    link.props.onFocus({ currentTarget: anchor })

    expect(link.props['aria-haspopup']).toBeUndefined()
    expect(previewIntents).toEqual([])
  })

  test('keeps wikilinks interactive through the Reading sanitizer pipeline', async () => {
    const module = await evaluate('Read [[Companion]] next.', {
      Fragment,
      jsx,
      jsxs,
      baseUrl: import.meta.url,
      remarkPlugins: [remarkWikilink],
      rehypePlugins: [rehypeSafeHtml]
    })
    const components = createMdxComponents({
      notes: [SECOND_NOTE],
      onNavigate: () => {},
      selectedPath: 'notes/Welcome.mdx',
      imageCache: new PreviewImageCache()
    })

    const html = renderToStaticMarkup(createElement(module.default, { components }))

    expect(html).toContain('<button')
    expect(html).toContain('aria-label="Open Companion"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('>Companion</button>')
  })
})

interface WikilinkButtonProps {
  type: 'button'
  title: string
  'aria-label': string
  'aria-haspopup'?: 'dialog'
  onClick: () => void
  onPointerEnter: (event: { currentTarget: HTMLElement }) => void
  onPointerLeave: (event: { relatedTarget: EventTarget | null }) => void
  onFocus: (event: { currentTarget: HTMLElement }) => void
  onBlur: (event: { relatedTarget: EventTarget | null }) => void
}

function renderWikilink({
  notes,
  target,
  onNavigate,
  onPreviewRequest,
  onPreviewDismiss
}: {
  notes: IndexedNoteSummary[]
  target: string
  onNavigate: (relativePath: string, subpath?: WikilinkSubpath | null) => void
  onPreviewRequest?: (intent: WikilinkPreviewIntent) => void
  onPreviewDismiss?: (relatedTarget?: EventTarget | null) => void
}): ReactElement<WikilinkButtonProps> {
  const components = createMdxComponents({
    notes,
    onNavigate,
    selectedPath: 'notes/Welcome.mdx',
    imageCache: new PreviewImageCache(),
    onPreviewRequest,
    onPreviewDismiss
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

function createAnchorStub(): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      top: 20,
      right: 140,
      bottom: 40,
      left: 40,
      width: 100,
      height: 20
    })
  } as unknown as HTMLElement
}

const SECOND_NOTE: IndexedNoteSummary = {
  id: 'second-note',
  relativePath: 'notes/Second Note.mdx',
  title: 'Second Note',
  aliases: ['Companion'],
  mtimeMs: 1,
  contentHash: 'second-note-hash'
}

const WELCOME_NOTE: IndexedNoteSummary = {
  id: 'welcome-note',
  relativePath: 'notes/Welcome.mdx',
  title: 'Welcome',
  aliases: [],
  mtimeMs: 1,
  contentHash: 'welcome-note-hash'
}
