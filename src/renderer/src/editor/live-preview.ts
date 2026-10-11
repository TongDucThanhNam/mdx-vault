import { syntaxTree } from '@codemirror/language'
import { type Extension, type Range, StateEffect } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import {
  parseWikilinkParts,
  resolveWikilinkTarget,
  type WikilinkNoteCandidate,
  type WikilinkSubpath
} from '../../../shared/wikilinks'

import { activeLine, syntaxBlue, syntaxMuted, syntaxViolet } from './editor-theme'

interface LivePreviewOptions {
  getNotes: () => WikilinkNoteCandidate[]
  getSourceRelativePath: () => string | undefined
  getOnNavigateToNote: () =>
    | ((relativePath: string, subpath?: WikilinkSubpath | null) => void)
    | undefined
}

interface LivePreviewDecorations {
  decorations: DecorationSet
  atomicRanges: DecorationSet
}

interface VisibleRange {
  from: number
  to: number
}

class BulletWidget extends WidgetType {
  eq(other: WidgetType): boolean {
    return other instanceof BulletWidget
  }

  toDOM(): HTMLElement {
    const bullet = document.createElement('span')
    bullet.className = 'cm-live-preview-bullet'
    bullet.textContent = '•'
    bullet.setAttribute('aria-hidden', 'true')
    return bullet
  }
}

const bulletWidget = new BulletWidget()

export const refreshLivePreviewEffect = StateEffect.define<null>()

/** Decorations only. Source owns the editing plane and token palette. */
export const livePreviewThemeSpec = {
  '.cm-live-preview-heading, .cm-live-preview-heading span': {
    color: 'var(--foreground)',
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: '0'
  },
  '.cm-live-preview-heading-1': { fontSize: '1.3em', fontWeight: '700' },
  '.cm-live-preview-heading-2': { fontSize: '1.15em', fontWeight: '700' },
  '.cm-live-preview-heading-3': { fontSize: '1.05em', fontWeight: '700' },
  '.cm-live-preview-heading-4, .cm-live-preview-heading-5, .cm-live-preview-heading-6': {
    fontSize: '1em',
    fontWeight: '700'
  },
  // ch is local to the heading's enlarged font. Undo that scale, keeping
  // Source's 12px insets and its scroller-sized ruler/wrap column unchanged.
  '&.cm-wrap-bounded .cm-live-preview-heading-1': {
    maxWidth: 'calc(var(--editor-wrap-column, 88) * (1ch / 1.3) + 24px)'
  },
  '&.cm-wrap-bounded .cm-live-preview-heading-2': {
    maxWidth: 'calc(var(--editor-wrap-column, 88) * (1ch / 1.15) + 24px)'
  },
  '&.cm-wrap-bounded .cm-live-preview-heading-3': {
    maxWidth: 'calc(var(--editor-wrap-column, 88) * (1ch / 1.05) + 24px)'
  },
  '.cm-line .cm-live-preview-strong': { color: 'var(--foreground)', fontWeight: '600' },
  '.cm-live-preview-emphasis': { fontStyle: 'italic' },
  '.cm-live-preview-strikethrough': { textDecoration: 'line-through' },
  '.cm-line .cm-live-preview-inline-code': {
    backgroundColor: 'color-mix(in srgb, var(--foreground) 6%, transparent)',
    color: 'var(--foreground)',
    borderRadius: '2px',
    fontFamily: 'inherit'
  },
  '.cm-line .cm-live-preview-link, .cm-line .cm-live-preview-wikilink': {
    color: syntaxBlue,
    fontWeight: '500',
    textDecoration: 'underline',
    textDecorationColor: `color-mix(in srgb, ${syntaxBlue} 50%, transparent)`,
    textDecorationThickness: '1px',
    textUnderlineOffset: '3px'
  },
  '.cm-live-preview-wikilink': { cursor: 'text' },
  '.cm-line .cm-live-preview-wikilink-unresolved': {
    color: syntaxMuted,
    textDecorationColor: syntaxMuted,
    textDecorationStyle: 'dashed'
  },
  '.cm-live-preview-bullet, .cm-line .cm-live-preview-quote-mark': {
    color: syntaxMuted,
    fontWeight: '600'
  },
  '.cm-live-preview-blockquote': {
    borderLeft: '2px solid color-mix(in srgb, var(--border) 35%, var(--muted-foreground))',
    color: 'var(--foreground)'
  },
  // Translucent line tints leave the selection layer visible underneath.
  '.cm-live-preview-blockquote:has(.cm-mdx-callout-note)': {
    backgroundColor: 'color-mix(in srgb, var(--foreground) 3%, transparent)'
  },
  '.cm-live-preview-blockquote:has(.cm-mdx-callout-info)': {
    backgroundColor: 'color-mix(in srgb, var(--muted-foreground) 4%, transparent)'
  },
  '.cm-live-preview-blockquote:has(.cm-mdx-callout-tip)': {
    backgroundColor: 'color-mix(in srgb, var(--instrument-blue) 4%, transparent)'
  },
  '.cm-live-preview-blockquote:has(.cm-mdx-callout-warning)': {
    backgroundColor: 'color-mix(in srgb, var(--signal) 4%, transparent)'
  },
  '.cm-live-preview-blockquote:has(.cm-mdx-callout-danger)': {
    backgroundColor: 'color-mix(in srgb, var(--destructive) 4%, transparent)'
  },
  '.cm-live-preview-blockquote.cm-activeLine': {
    backgroundImage: `linear-gradient(${activeLine}, ${activeLine})`
  },
  '.cm-line .cm-mdx-callout-marker.cm-mdx-callout-note': { color: 'var(--foreground)' },
  '.cm-line .cm-mdx-callout-marker.cm-mdx-callout-info': { color: syntaxMuted },
  '.cm-line .cm-mdx-callout-marker.cm-mdx-callout-tip': { color: syntaxBlue },
  '.cm-line .cm-mdx-callout-marker.cm-mdx-callout-warning': { color: syntaxViolet },
  '.cm-line .cm-mdx-callout-marker.cm-mdx-callout-danger': { color: 'var(--destructive)' },
  '.cm-line .cm-live-preview-syntax, .cm-live-preview-heading .cm-live-preview-syntax': {
    color: syntaxMuted
  },
  // Highlighter spans can nest inside decoration marks. They must inherit the
  // decoration's color instead of bringing Source's delimiter color back in.
  '.cm-live-preview-quote-mark span, .cm-mdx-callout-marker span, .cm-live-preview-syntax span, .cm-live-preview-wikilink span, .cm-live-preview-link span':
    {
      color: 'inherit'
    }
}

const livePreviewTheme = EditorView.theme(livePreviewThemeSpec)

export function createLivePreviewExtension(options: LivePreviewOptions): Extension {
  const livePreviewPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      atomicRanges: DecorationSet

      constructor(view: EditorView) {
        const sets = buildDecorations(view, options.getNotes(), options.getSourceRelativePath())
        this.decorations = sets.decorations
        this.atomicRanges = sets.atomicRanges
      }

      update(update: ViewUpdate): void {
        const refreshRequested = update.transactions.some((transaction) =>
          transaction.effects.some((effect) => effect.is(refreshLivePreviewEffect))
        )

        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          refreshRequested
        ) {
          const sets = buildDecorations(
            update.view,
            options.getNotes(),
            options.getSourceRelativePath()
          )
          this.decorations = sets.decorations
          this.atomicRanges = sets.atomicRanges
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      provide: (plugin) =>
        EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomicRanges ?? Decoration.none)
    }
  )

  return [
    livePreviewPlugin,
    livePreviewTheme,
    EditorView.domEventHandlers({
      mousedown: (event, view) => handleWikilinkClick(event, view, options)
    })
  ]
}

function buildDecorations(
  view: EditorView,
  notes: WikilinkNoteCandidate[],
  sourceRelativePath?: string
): LivePreviewDecorations {
  const decorations: Range<Decoration>[] = []
  const atomicRanges: Range<Decoration>[] = []
  const decorationKeys = new Set<string>()
  const atomicKeys = new Set<string>()
  const blockquoteLines = new Set<number>()
  const frontmatterEnd = findFrontmatterEnd(view)
  const tree = syntaxTree(view.state)

  const addDecoration = (decoration: Decoration, from: number, to: number, key: string): void => {
    const rangeKey = `${key}:${from}:${to}`
    if (decorationKeys.has(rangeKey)) {
      return
    }
    decorationKeys.add(rangeKey)
    decorations.push(decoration.range(from, to))
  }

  const addReplacement = (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ): void => {
    if (from < visibleRange.from || to > visibleRange.to || from >= to) {
      return
    }

    addDecoration(decoration, from, to, key)
    const rangeKey = `${key}:${from}:${to}`
    if (!atomicKeys.has(rangeKey)) {
      atomicKeys.add(rangeKey)
      atomicRanges.push(decoration.range(from, to))
    }
  }

  const addClippedMark = (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ): void => {
    const clippedFrom = Math.max(from, visibleRange.from)
    const clippedTo = Math.min(to, visibleRange.to)
    if (clippedFrom < clippedTo) {
      addDecoration(decoration, clippedFrom, clippedTo, key)
    }
  }

  for (const visibleRange of view.visibleRanges) {
    tree.iterate({
      from: visibleRange.from,
      to: visibleRange.to,
      enter: (node) => {
        if (isProtectedNode(node, frontmatterEnd)) {
          return false
        }

        const headingLevel = readHeadingLevel(node.name)
        if (headingLevel !== null) {
          decorateHeading(view, node, headingLevel, visibleRange, addDecoration, addReplacement)
          return true
        }

        if (
          node.name === 'StrongEmphasis' ||
          node.name === 'Emphasis' ||
          node.name === 'Strikethrough'
        ) {
          decorateEmphasis(view, node, visibleRange, addClippedMark, addReplacement)
          return true
        }

        if (node.name === 'InlineCode') {
          decorateInlineCode(view, node.node, visibleRange, addClippedMark, addReplacement)
          return true
        }

        if (node.name === 'Link') {
          decorateLink(view, node.node, visibleRange, addClippedMark, addReplacement)
          return true
        }

        if (node.name === 'MDXWikilink') {
          decorateWikilink(
            view,
            node.node,
            notes,
            sourceRelativePath,
            visibleRange,
            addClippedMark,
            addReplacement
          )
          return true
        }

        if (
          ['HeaderMark', 'EmphasisMark', 'CodeMark', 'LinkMark', 'URL', 'ListMark'].includes(
            node.name
          )
        ) {
          addClippedMark(
            Decoration.mark({ class: 'cm-live-preview-syntax' }),
            node.from,
            node.to,
            'revealed-syntax',
            visibleRange
          )
        }

        if (node.name === 'ListMark') {
          const marker = view.state.sliceDoc(node.from, node.to)
          if (marker === '-' || marker === '*') {
            addReplacement(
              Decoration.replace({ widget: bulletWidget }),
              node.from,
              node.to,
              'bullet',
              visibleRange
            )
          }
          return true
        }

        if (node.name === 'QuoteMark') {
          const line = view.state.doc.lineAt(node.from)
          addClippedMark(
            Decoration.mark({ class: 'cm-live-preview-quote-mark' }),
            node.from,
            node.to,
            'quote-mark',
            visibleRange
          )
          if (!blockquoteLines.has(line.from)) {
            blockquoteLines.add(line.from)
            addDecoration(
              Decoration.line({ attributes: { class: 'cm-live-preview-blockquote' } }),
              line.from,
              line.from,
              'blockquote-line'
            )
          }
        }

        return true
      }
    })
  }

  return {
    decorations: Decoration.set(decorations, true),
    atomicRanges: Decoration.set(atomicRanges, true)
  }
}

function decorateWikilink(
  view: EditorView,
  node: SyntaxNode,
  notes: WikilinkNoteCandidate[],
  sourceRelativePath: string | undefined,
  visibleRange: VisibleRange,
  addClippedMark: (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ) => void,
  addReplacement: (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ) => void
): void {
  const parts = readWikilinkNode(view, node)
  if (!parts) {
    return
  }

  const resolvedNote = resolveWikilinkTarget(notes, parts.target, sourceRelativePath)
  const className = resolvedNote
    ? 'cm-live-preview-wikilink'
    : 'cm-live-preview-wikilink cm-live-preview-wikilink-unresolved'

  addClippedMark(
    Decoration.mark({
      class: className,
      attributes: {
        title: resolvedNote ? resolvedNote.relativePath : `Unresolved: ${parts.target}`
      }
    }),
    parts.displayFrom,
    parts.displayTo,
    'wikilink-display',
    visibleRange
  )

  const line = view.state.doc.lineAt(node.from)
  if (selectionTouchesLine(view, line.from)) {
    return
  }

  addReplacement(
    Decoration.replace({}),
    node.from,
    parts.displayFrom,
    'wikilink-prefix',
    visibleRange
  )
  addReplacement(Decoration.replace({}), parts.displayTo, node.to, 'wikilink-suffix', visibleRange)
}

interface WikilinkNodeParts {
  target: string
  subpath: WikilinkSubpath | null
  displayFrom: number
  displayTo: number
}

function readWikilinkNode(view: EditorView, node: SyntaxNode): WikilinkNodeParts | null {
  const punctuation = node.getChildren('MDXWikilinkPunct')
  const openingMark = punctuation.at(0)
  const closingMark = punctuation.at(-1)
  if (!openingMark || !closingMark || openingMark === closingMark) {
    return null
  }

  const content = view.state.sliceDoc(openingMark.to, closingMark.from)
  const parts = parseWikilinkParts(content)
  if (!parts) {
    return null
  }

  const delimiterIndex = content.indexOf('|')
  const rawDisplay = delimiterIndex === -1 ? content : content.slice(delimiterIndex + 1)
  const displaySegment = rawDisplay.trim() ? rawDisplay : content.slice(0, delimiterIndex)
  const displaySegmentOffset = delimiterIndex !== -1 && rawDisplay.trim() ? delimiterIndex + 1 : 0
  const leadingWhitespace = displaySegment.search(/\S/)
  const trailingWhitespace = displaySegment.length - displaySegment.trimEnd().length

  if (leadingWhitespace === -1) {
    return null
  }

  return {
    target: parts.target,
    subpath: parts.reference.subpath,
    displayFrom: openingMark.to + displaySegmentOffset + leadingWhitespace,
    displayTo: openingMark.to + displaySegmentOffset + displaySegment.length - trailingWhitespace
  }
}

function handleWikilinkClick(
  event: MouseEvent,
  view: EditorView,
  options: LivePreviewOptions
): boolean {
  if (event.button !== 0 || (!event.ctrlKey && !event.metaKey)) {
    return false
  }

  const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (position === null) {
    return false
  }

  const wikilinkNode = findAncestor(
    syntaxTree(view.state).resolveInner(position, -1),
    'MDXWikilink'
  )
  if (!wikilinkNode) {
    return false
  }

  const parts = readWikilinkNode(view, wikilinkNode)
  if (!parts) {
    return false
  }

  const resolvedNote = resolveWikilinkTarget(
    options.getNotes(),
    parts.target,
    options.getSourceRelativePath()
  )
  const navigate = options.getOnNavigateToNote()
  if (!resolvedNote || !navigate) {
    return false
  }

  event.preventDefault()
  navigate(resolvedNote.relativePath, parts.subpath)
  return true
}

function findAncestor(node: SyntaxNode, name: string): SyntaxNode | null {
  let current: SyntaxNode | null = node

  while (current) {
    if (current.name === name) {
      return current
    }
    current = current.parent
  }

  return null
}

function decorateHeading(
  view: EditorView,
  node: SyntaxNodeRef,
  level: number,
  visibleRange: VisibleRange,
  addDecoration: (decoration: Decoration, from: number, to: number, key: string) => void,
  addReplacement: (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ) => void
): void {
  const line = view.state.doc.lineAt(node.from)
  addDecoration(
    Decoration.line({
      attributes: {
        class: `cm-live-preview-heading cm-live-preview-heading-${level}`
      }
    }),
    line.from,
    line.from,
    `heading-${level}`
  )

  if (selectionTouchesLine(view, line.from)) {
    return
  }

  const headerMark = node.node.getChild('HeaderMark')
  if (!headerMark) {
    return
  }

  const followingCharacter = view.state.sliceDoc(headerMark.to, headerMark.to + 1)
  const markerTo = followingCharacter === ' ' ? headerMark.to + 1 : headerMark.to
  addReplacement(Decoration.replace({}), headerMark.from, markerTo, 'heading-mark', visibleRange)
}

function decorateEmphasis(
  view: EditorView,
  node: SyntaxNodeRef,
  visibleRange: VisibleRange,
  addClippedMark: (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ) => void,
  addReplacement: (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ) => void
): void {
  const delimiterLength = node.name === 'Emphasis' ? 1 : 2
  const className =
    node.name === 'StrongEmphasis'
      ? 'cm-live-preview-strong'
      : node.name === 'Strikethrough'
        ? 'cm-live-preview-strikethrough'
        : 'cm-live-preview-emphasis'
  const contentFrom = node.from + delimiterLength
  const contentTo = node.to - delimiterLength

  addClippedMark(
    Decoration.mark({ class: className }),
    contentFrom,
    contentTo,
    className,
    visibleRange
  )

  const openingLine = view.state.doc.lineAt(node.from)
  if (!selectionTouchesLine(view, openingLine.from)) {
    addReplacement(
      Decoration.replace({}),
      node.from,
      contentFrom,
      `${node.name}-open`,
      visibleRange
    )
  }

  const closingLine = view.state.doc.lineAt(Math.max(node.from, node.to - 1))
  if (!selectionTouchesLine(view, closingLine.from)) {
    addReplacement(Decoration.replace({}), contentTo, node.to, `${node.name}-close`, visibleRange)
  }
}

function decorateInlineCode(
  view: EditorView,
  node: SyntaxNode,
  visibleRange: VisibleRange,
  addClippedMark: (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ) => void,
  addReplacement: (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ) => void
): void {
  const marks = node.getChildren('CodeMark')
  const openingMark = marks.at(0)
  const closingMark = marks.at(-1)
  if (!openingMark || !closingMark || openingMark === closingMark) {
    return
  }

  addClippedMark(
    Decoration.mark({ class: 'cm-live-preview-inline-code' }),
    openingMark.to,
    closingMark.from,
    'inline-code',
    visibleRange
  )

  const line = view.state.doc.lineAt(node.from)
  if (!selectionTouchesLine(view, line.from)) {
    addReplacement(
      Decoration.replace({}),
      openingMark.from,
      openingMark.to,
      'inline-code-open',
      visibleRange
    )
    addReplacement(
      Decoration.replace({}),
      closingMark.from,
      closingMark.to,
      'inline-code-close',
      visibleRange
    )
  }
}

function decorateLink(
  view: EditorView,
  node: SyntaxNode,
  visibleRange: VisibleRange,
  addClippedMark: (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ) => void,
  addReplacement: (
    decoration: Decoration,
    from: number,
    to: number,
    key: string,
    visibleRange: VisibleRange
  ) => void
): void {
  const marks = node.getChildren('LinkMark')
  if (marks.length < 4) {
    return
  }

  const [openBracket, closeBracket, openParen] = marks
  const closeParen = marks.at(-1)
  if (!openBracket || !closeBracket || !openParen || !closeParen) {
    return
  }

  addClippedMark(
    Decoration.mark({ class: 'cm-live-preview-link' }),
    openBracket.to,
    closeBracket.from,
    'link-text',
    visibleRange
  )

  const line = view.state.doc.lineAt(node.from)
  if (!selectionTouchesLine(view, line.from)) {
    addReplacement(
      Decoration.replace({}),
      openBracket.from,
      openBracket.to,
      'link-open-bracket',
      visibleRange
    )
    addReplacement(
      Decoration.replace({}),
      closeBracket.from,
      closeBracket.to,
      'link-close-bracket',
      visibleRange
    )
    addReplacement(
      Decoration.replace({}),
      openParen.from,
      closeParen.to,
      'link-destination',
      visibleRange
    )
  }
}

function selectionTouchesLine(view: EditorView, lineFrom: number): boolean {
  const line = view.state.doc.lineAt(lineFrom)
  return view.state.selection.ranges.some(
    (selection) => selection.from <= line.to && selection.to >= line.from
  )
}

function readHeadingLevel(nodeName: string): number | null {
  const match = /^ATXHeading([1-6])$/.exec(nodeName)
  return match ? Number(match[1]) : null
}

function isProtectedNode(node: SyntaxNodeRef, frontmatterEnd: number): boolean {
  if (node.name !== 'Document' && frontmatterEnd > 0 && node.from < frontmatterEnd) {
    return true
  }

  return (
    node.name === 'FencedCode' ||
    node.name === 'HTMLBlock' ||
    node.name === 'Table' ||
    node.name.startsWith('JSX') ||
    (node.name !== 'MDXWikilink' && node.name.startsWith('MDX'))
  )
}

function findFrontmatterEnd(view: EditorView): number {
  const doc = view.state.doc
  if (doc.lines < 2 || doc.line(1).text.trim() !== '---') {
    return 0
  }

  for (let lineNumber = 2; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber)
    const delimiter = line.text.trim()
    if (delimiter === '---' || delimiter === '...') {
      return line.to
    }
  }

  return doc.length
}
