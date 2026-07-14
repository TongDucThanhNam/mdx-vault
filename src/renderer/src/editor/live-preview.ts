import { syntaxTree } from '@codemirror/language'
import type { Extension, Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'

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

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    atomicRanges: DecorationSet

    constructor(view: EditorView) {
      const sets = buildDecorations(view)
      this.decorations = sets.decorations
      this.atomicRanges = sets.atomicRanges
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        const sets = buildDecorations(update.view)
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

const livePreviewTheme = EditorView.baseTheme({
  '.cm-live-preview-heading': {
    color: 'var(--foreground)',
    fontFamily: 'var(--font-display)',
    lineHeight: '1.15',
    letterSpacing: '-0.01em'
  },
  '.cm-live-preview-heading-1': {
    fontSize: '2.5rem',
    fontWeight: '900'
  },
  '.cm-live-preview-heading-2': {
    fontSize: '1.7rem',
    fontWeight: '700'
  },
  '.cm-live-preview-heading-3': {
    fontSize: '1.3rem',
    fontWeight: '700'
  },
  '.cm-live-preview-heading-4': {
    fontSize: '1.05rem',
    fontWeight: '700'
  },
  '.cm-live-preview-heading-5': {
    fontSize: '1rem',
    fontWeight: '700'
  },
  '.cm-live-preview-heading-6': {
    fontSize: '0.9rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  '.cm-live-preview-strong': {
    color: 'var(--foreground)',
    fontWeight: '700'
  },
  '.cm-live-preview-emphasis': {
    fontStyle: 'italic'
  },
  '.cm-live-preview-strikethrough': {
    textDecoration: 'line-through'
  },
  '.cm-live-preview-inline-code': {
    backgroundColor: 'var(--secondary)',
    color: 'var(--foreground)',
    fontFamily: 'var(--font-mono)',
    paddingInline: '0.18em'
  },
  '.cm-live-preview-link': {
    color: 'var(--editorial-blue)',
    fontWeight: '700',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in srgb, var(--editorial-blue) 40%, transparent)',
    textDecorationThickness: '2px',
    textUnderlineOffset: '3px'
  },
  '.cm-live-preview-bullet': {
    color: 'var(--editorial-red)',
    fontWeight: '700'
  },
  '.cm-live-preview-blockquote': {
    borderLeft: '4px solid var(--editorial-red)',
    backgroundColor: 'color-mix(in srgb, var(--editorial-red) 5%, transparent)'
  },
  '.cm-live-preview-quote-mark': {
    color: 'var(--editorial-red)',
    fontWeight: '700'
  }
})

export const livePreviewExtension: Extension = [livePreviewPlugin, livePreviewTheme]

function buildDecorations(view: EditorView): LivePreviewDecorations {
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
    node.name.startsWith('MDX')
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
