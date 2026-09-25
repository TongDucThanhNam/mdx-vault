/**
 * MDX syntax highlighting for the CodeMirror 6 markdown editor.
 *
 * There is no official `@codemirror/lang-mdx` package. This module adds a
 * `@lezer/markdown` extension that recognizes MDX/Obsidian-style inline
 * constructs and tags them with highlighting tags so the existing CodeMirror
 * theme colors them:
 *
 *   1. JSX tags:        `<Tag />`, `<Tag>`, `</Tag>`, `<Tag attr="x">`
 *   2. Brace expressions: `{expr}` in prose (rendered as JSX children)
 *   3. Math, marks, wikilinks, tags, and callout markers used by notes
 *
 * This is **presentation-only** highlighting. It does not build a real MDX AST,
 * does not validate JSX, and does not affect the preview/render pipeline. The
 * goal is purely to make MDX source readable in the editor.
 *
 * Reference: @lezer/markdown InlineParser API + @lezer/highlight tags.
 */

import type { Line, Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { Element, InlineParser, MarkdownExtension, NodeSpec } from '@lezer/markdown'

/* -------------------------------------------------------------------------- */
/*                              Node definitions                              */
/* -------------------------------------------------------------------------- */

/**
 * Node names used by the inline parsers below. Each is assigned highlight tags
 * via `styleTags` so the active theme can color them.
 */
const MDX_JSX_OPEN = 'JSXOpenTag'
const MDX_JSX_CLOSE = 'JSXCloseTag'
const MDX_JSX_NAME = 'JSXTagName'
const MDX_JSX_ATTR = 'JSXAttrName'
const MDX_JSX_STRING = 'JSXAttrValue'
const MDX_JSX_PUNCT = 'JSXPunct'
const MDX_BRACE = 'MDXBrace'
const MDX_BRACE_MARK = 'MDXBraceMark'
const MDX_INLINE_MATH = 'MDXInlineMath'
const MDX_MATH_MARK = 'MDXMathMark'
const MDX_MARK = 'MDXMark'
const MDX_MARK_PUNCT = 'MDXMarkPunct'
const MDX_WIKILINK = 'MDXWikilink'
const MDX_WIKILINK_PUNCT = 'MDXWikilinkPunct'
const MDX_TAG = 'MDXTag'
const MDX_CALLOUT_MARKER = 'MDXCalloutMarker'
const MDX_CALLOUT_PUNCT = 'MDXCalloutPunct'

const nodeSpecs: NodeSpec[] = [
  { name: MDX_JSX_OPEN },
  { name: MDX_JSX_CLOSE },
  { name: MDX_JSX_NAME, style: t.tagName },
  { name: MDX_JSX_ATTR, style: t.attributeName },
  { name: MDX_JSX_STRING, style: t.string },
  { name: MDX_JSX_PUNCT, style: t.angleBracket },
  { name: MDX_BRACE },
  { name: MDX_BRACE_MARK, style: t.brace },
  { name: MDX_INLINE_MATH, style: t.regexp },
  { name: MDX_MATH_MARK, style: t.processingInstruction },
  { name: MDX_MARK, style: t.inserted },
  { name: MDX_MARK_PUNCT, style: t.punctuation },
  { name: MDX_WIKILINK, style: t.link },
  { name: MDX_WIKILINK_PUNCT, style: t.squareBracket },
  { name: MDX_TAG, style: t.labelName },
  { name: MDX_CALLOUT_MARKER, style: t.processingInstruction },
  { name: MDX_CALLOUT_PUNCT, style: t.squareBracket }
]

/* -------------------------------------------------------------------------- */
/*                          JSX tag inline parser                              */
/* -------------------------------------------------------------------------- */

const JSX_TAG_START = 60 // '<'
const SLASH = 47 // '/'
const GT = 62 // '>'
const EQUALS = 61 // '='
const DOUBLE_QUOTE = 34 // '"'
const SINGLE_QUOTE = 39 // "'"
const BRACE_OPEN = 123 // '{'
const SPACE = 32
const DOLLAR = 36 // '$'
const HASH = 35 // '#'
const BRACKET_OPEN = 91 // '['
const BRACKET_CLOSE = 93 // ']'
const EXCLAMATION = 33 // '!'
const NEWLINE = 10

/**
 * Recognizes `<Tag ...>`, `</Tag>`, and `<Tag ... />`. Runs before the default
 * HTMLTag parser so JSX-style PascalCase/component tags are not consumed as
 * raw HTML.
 */
const jsxTagParser: InlineParser = {
  name: 'MdxJsxTag',
  before: 'HTMLTag',
  parse(cx, next, pos) {
    if (next !== JSX_TAG_START) {
      return -1
    }

    // A `<` followed by a space, `=`, or another `<` is not a tag.
    const after = cx.char(pos + 1)
    if (after === SPACE || after === EQUALS || after < 0) {
      return -1
    }

    const start = pos
    let i = pos + 1
    let isClosing = false

    if (cx.char(i) === SLASH) {
      isClosing = true
      i += 1
    }

    // Tag name: letters, digits, `.`, `-`, `:` (member expressions allowed).
    const nameStart = i
    if (!isTagNameChar(cx.char(i)) || isDigit(cx.char(i))) {
      // Tag name cannot start with a digit; bail (likely markdown `<`).
      return -1
    }
    while (i < cx.end && isTagNameChar(cx.char(i))) {
      i += 1
    }
    const nameEnd = i

    // Build the elements. We emit the `<` and optional `/` as punct, then the
    // name as a separate element so the theme can color it.
    const elements: Element[] = []

    // `<` (and `/` for closing tags)
    const headerEnd = isClosing ? i : start + 1
    elements.push(cx.elt(isClosing ? MDX_JSX_CLOSE : MDX_JSX_OPEN, start, headerEnd))
    elements.push(cx.elt(MDX_JSX_NAME, nameStart, nameEnd))

    // Parse attributes until we hit `>` or `/>`.
    i = scanAttributes(cx, i, elements)

    if (i === -1) {
      // Unbalanced — not a tag we can confidently claim. Let other parsers
      // handle it.
      return -1
    }

    // Closing punct (`>` or `/>`).
    elements.push(cx.elt(MDX_JSX_PUNCT, i, i + (cx.char(i) === SLASH ? 2 : 1)))
    const endPos = cx.char(i) === SLASH ? i + 2 : i + 1

    cx.addElement(cx.elt(MDX_JSX_OPEN, start, endPos, elements))
    return endPos
  }
}

/**
 * Scan attributes inside a JSX tag, appending elements. Returns the index of
 * the closing `>` or `/>`, or -1 if the tag looks unbalanced.
 */
function scanAttributes(cx: InlineContextLike, start: number, elements: Element[]): number {
  let i = start

  while (i < cx.end) {
    const ch = cx.char(i)

    // Whitespace — skip.
    if (isWhitespace(ch)) {
      i += 1
      continue
    }

    if (ch === GT) {
      return i
    }

    if (ch === SLASH && cx.char(i + 1) === GT) {
      return i
    }

    // Attribute name: letter/underscore start, then word chars.
    if (isAttrNameStart(ch)) {
      const attrStart = i
      while (i < cx.end && isAttrNameChar(cx.char(i))) {
        i += 1
      }
      elements.push(cx.elt(MDX_JSX_ATTR, attrStart, i))

      // Optional `="value"` or `={expr}`.
      const afterName = cx.char(i)
      if (afterName === EQUALS) {
        elements.push(cx.elt(MDX_JSX_PUNCT, i, i + 1))
        i += 1

        if (cx.char(i) === DOUBLE_QUOTE || cx.char(i) === SINGLE_QUOTE) {
          const quote = cx.char(i)
          const valStart = i
          i += 1
          while (i < cx.end && cx.char(i) !== quote) {
            i += 1
          }
          // include closing quote if present
          if (i < cx.end) {
            i += 1
          }
          elements.push(cx.elt(MDX_JSX_STRING, valStart, i))
        } else if (cx.char(i) === BRACE_OPEN) {
          // `={expr}` — find matching closing brace.
          const exprEnd = findMatchingBrace(cx, i)
          if (exprEnd === -1) {
            return -1
          }
          elements.push(cx.elt(MDX_BRACE, i, exprEnd + 1))
          i = exprEnd + 1
        }
      }
      continue
    }

    // Unknown character inside tag — bail to avoid mis-highlighting.
    return -1
  }

  return -1
}

/* -------------------------------------------------------------------------- */
/*                       Brace expression inline parser                        */
/* -------------------------------------------------------------------------- */

/**
 * Recognizes `{expression}` in prose. MDX renders these as JSX expressions,
 * so we highlight the braces distinctly from prose text.
 */
const braceParser: InlineParser = {
  name: 'MdxBrace',
  parse(cx, next, pos) {
    if (next !== BRACE_OPEN) {
      return -1
    }

    const end = findMatchingBrace(cx, pos)

    if (end === -1) {
      return -1
    }

    const elements: Element[] = [
      cx.elt(MDX_BRACE_MARK, pos, pos + 1),
      cx.elt(MDX_BRACE_MARK, end, end + 1)
    ]
    cx.addElement(cx.elt(MDX_BRACE, pos, end + 1, elements))
    return end + 1
  }
}

/* -------------------------------------------------------------------------- */
/*                        Markdown enrichment inline parsers                   */
/* -------------------------------------------------------------------------- */

const inlineMathParser: InlineParser = {
  name: 'MdxInlineMath',
  parse(cx, next, pos) {
    if (next !== DOLLAR) {
      return -1
    }

    const delimiterLength = cx.char(pos + 1) === DOLLAR ? 2 : 1
    const end = findClosingDelimiter(cx, pos, DOLLAR, delimiterLength)

    if (end === -1 || !hasNonWhitespaceContent(cx, pos + delimiterLength, end)) {
      return -1
    }

    // Avoid common currency ranges such as `$5 and $10`.
    if (delimiterLength === 1 && isDigit(cx.char(pos + 1))) {
      return -1
    }

    const endPos = end + delimiterLength
    const elements: Element[] = [
      cx.elt(MDX_MATH_MARK, pos, pos + delimiterLength),
      cx.elt(MDX_MATH_MARK, end, endPos)
    ]

    cx.addElement(cx.elt(MDX_INLINE_MATH, pos, endPos, elements))
    return endPos
  }
}

const markParser: InlineParser = {
  name: 'MdxMark',
  parse(cx, next, pos) {
    if (next !== EQUALS || cx.char(pos + 1) !== EQUALS) {
      return -1
    }

    const end = findClosingDelimiter(cx, pos, EQUALS, 2)

    if (end === -1 || !hasNonWhitespaceContent(cx, pos + 2, end)) {
      return -1
    }

    const endPos = end + 2
    const elements: Element[] = [
      cx.elt(MDX_MARK_PUNCT, pos, pos + 2),
      cx.elt(MDX_MARK_PUNCT, end, endPos)
    ]

    cx.addElement(cx.elt(MDX_MARK, pos, endPos, elements))
    return endPos
  }
}

const wikilinkParser: InlineParser = {
  name: 'MdxWikilink',
  before: 'Link',
  parse(cx, next, pos) {
    if (next !== BRACKET_OPEN || cx.char(pos + 1) !== BRACKET_OPEN) {
      return -1
    }

    let i = pos + 2
    while (i < cx.end) {
      if (cx.char(i) === NEWLINE) {
        return -1
      }
      if (cx.char(i) === BRACKET_CLOSE && cx.char(i + 1) === BRACKET_CLOSE) {
        break
      }
      i += 1
    }

    if (i >= cx.end || !hasNonWhitespaceContent(cx, pos + 2, i)) {
      return -1
    }

    const endPos = i + 2
    const elements: Element[] = [
      cx.elt(MDX_WIKILINK_PUNCT, pos, pos + 2),
      cx.elt(MDX_WIKILINK_PUNCT, i, endPos)
    ]

    cx.addElement(cx.elt(MDX_WIKILINK, pos, endPos, elements))
    return endPos
  }
}

const tagParser: InlineParser = {
  name: 'MdxHashTag',
  parse(cx, next, pos) {
    if (next !== HASH || !isTagBoundary(cx.char(pos - 1)) || !isTagStart(cx.char(pos + 1))) {
      return -1
    }

    let i = pos + 2
    while (i < cx.end && isTagBody(cx.char(i))) {
      i += 1
    }

    const last = cx.char(i - 1)
    if (last === SLASH || last === 45 /* '-' */) {
      return -1
    }

    cx.addElement(cx.elt(MDX_TAG, pos, i))
    return i
  }
}

const calloutMarkerParser: InlineParser = {
  name: 'MdxCalloutMarker',
  before: 'Link',
  parse(cx, next, pos) {
    if (
      next !== BRACKET_OPEN ||
      cx.char(pos + 1) !== EXCLAMATION ||
      !isCalloutBoundary(cx.char(pos - 1))
    ) {
      return -1
    }

    let i = pos + 2
    if (!isAsciiLetter(cx.char(i))) {
      return -1
    }

    while (i < cx.end && isCalloutTypeChar(cx.char(i))) {
      i += 1
    }

    if (cx.char(i) !== BRACKET_CLOSE) {
      return -1
    }

    const endPos = i + 1
    const elements: Element[] = [
      cx.elt(MDX_CALLOUT_PUNCT, pos, pos + 2),
      cx.elt(MDX_CALLOUT_PUNCT, i, endPos)
    ]

    cx.addElement(cx.elt(MDX_CALLOUT_MARKER, pos, endPos, elements))
    return endPos
  }
}

/* -------------------------------------------------------------------------- */
/*                         Block/line decoration layer                         */
/* -------------------------------------------------------------------------- */

const mathBlockDecoration = Decoration.mark({ class: 'cm-mdx-math-block' })
const mathBlockDelimiterDecoration = Decoration.mark({ class: 'cm-mdx-math-delimiter' })
const mermaidBlockDecoration = Decoration.mark({ class: 'cm-mdx-mermaid-block' })
const mermaidFenceDecoration = Decoration.mark({ class: 'cm-mdx-mermaid-fence' })
const calloutDecoration = (type: string): Decoration =>
  Decoration.mark({ class: `cm-mdx-callout-marker cm-mdx-callout-${type}` })

class MdxBlockHighlightPlugin {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = buildBlockDecorations(view)
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return
    let structural = false
    update.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
      const before = update.startState.doc
      const after = update.state.doc
      // Ordinary prose edits only shift existing ranges. Rescan when a change
      // can affect a math/fence/callout delimiter or the line structure.
      structural ||= /[$`>\n]/.test(
        before.sliceString(before.lineAt(fromA).from, before.lineAt(toA).to) +
          after.sliceString(after.lineAt(fromB).from, after.lineAt(toB).to)
      )
    })
    this.decorations = structural
      ? buildBlockDecorations(update.view)
      : this.decorations.map(update.changes)
  }
}

export const mdxBlockHighlightExtension = ViewPlugin.fromClass(MdxBlockHighlightPlugin, {
  decorations: (value) => value.decorations
})

function buildBlockDecorations(view: EditorView): DecorationSet {
  const ranges: Array<Range<Decoration>> = []
  const doc = view.state.doc
  let lineNumber = 1

  while (lineNumber <= doc.lines) {
    const line = doc.line(lineNumber)
    const mathDelimiterIndex = line.text.indexOf('$$')

    if (isDisplayMathDelimiterLine(line.text, mathDelimiterIndex)) {
      const closingLine = findClosingDisplayMathLine(view, lineNumber + 1)

      if (closingLine) {
        ranges.push(mathBlockDecoration.range(line.from, closingLine.to))
        ranges.push(
          mathBlockDelimiterDecoration.range(
            line.from + mathDelimiterIndex,
            line.from + mathDelimiterIndex + 2
          )
        )
        const closingIndex = closingLine.text.indexOf('$$')
        ranges.push(
          mathBlockDelimiterDecoration.range(
            closingLine.from + closingIndex,
            closingLine.from + closingIndex + 2
          )
        )
        lineNumber = closingLine.number + 1
        continue
      }
    }

    const mermaidFence = readMermaidFence(line.text)
    if (mermaidFence) {
      const closingLine = findClosingCodeFenceLine(view, lineNumber + 1, mermaidFence.tickCount)

      if (closingLine) {
        ranges.push(mermaidBlockDecoration.range(line.from, closingLine.to))
        ranges.push(
          mermaidFenceDecoration.range(
            line.from + mermaidFence.index,
            line.from + mermaidFence.index + mermaidFence.tickCount
          )
        )
        const closingIndex = closingLine.text.indexOf('`'.repeat(mermaidFence.tickCount))
        ranges.push(
          mermaidFenceDecoration.range(
            closingLine.from + closingIndex,
            closingLine.from + closingIndex + mermaidFence.tickCount
          )
        )
        lineNumber = closingLine.number + 1
        continue
      }
    }

    const callout = readCalloutMarker(line.text)
    if (callout) {
      ranges.push(
        calloutDecoration(callout.type).range(line.from + callout.from, line.from + callout.to)
      )
    }

    lineNumber += 1
  }

  return Decoration.set(ranges, true)
}

/* -------------------------------------------------------------------------- */
/*                                 Helpers                                     */
/* -------------------------------------------------------------------------- */

/** Minimal slice of InlineContext used by attribute scanning. */
interface InlineContextLike {
  readonly end: number
  char(pos: number): number
  elt(type: string, from: number, to: number): Element
}

function findMatchingBrace(cx: InlineContextLike, openPos: number): number {
  let depth = 0
  let inString: number | null = null

  for (let i = openPos; i < cx.end; i += 1) {
    const ch = cx.char(i)

    if (inString !== null) {
      if (ch === BACKSLASH) {
        i += 1 // skip escaped char
        continue
      }
      if (ch === inString) {
        inString = null
      }
      continue
    }

    if (ch === DOUBLE_QUOTE || ch === SINGLE_QUOTE || ch === BACKTICK) {
      inString = ch
      continue
    }

    if (ch === BRACE_OPEN) {
      depth += 1
    } else if (ch === 125 /* `}` */) {
      depth -= 1
      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

function isTagNameChar(code: number): boolean {
  return (
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    (code >= 48 && code <= 57) || // 0-9
    code === 45 || // -
    code === 46 || // .
    code === 58 // :
  )
}

function isAttrNameStart(code: number): boolean {
  return (
    (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 // _
  )
}

function isAttrNameChar(code: number): boolean {
  return isAttrNameStart(code) || isDigit(code) || code === 45 // allow `-` in attr names
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}

function isWhitespace(code: number): boolean {
  return code === SPACE || code === 9 || code === 10 || code === 13
}

function isMissingCode(code: number): boolean {
  return code < 0 || Number.isNaN(code)
}

function findClosingDelimiter(
  cx: InlineContextLike,
  openPos: number,
  delimiter: number,
  delimiterLength: 1 | 2
): number {
  for (let i = openPos + delimiterLength; i < cx.end; i += 1) {
    if (cx.char(i) === NEWLINE) {
      return -1
    }

    if (isEscaped(cx, i)) {
      continue
    }

    if (delimiterLength === 1) {
      if (cx.char(i) === delimiter) {
        return i
      }
      continue
    }

    if (cx.char(i) === delimiter && cx.char(i + 1) === delimiter) {
      return i
    }
  }

  return -1
}

function hasNonWhitespaceContent(cx: InlineContextLike, from: number, to: number): boolean {
  if (from >= to || isWhitespace(cx.char(from)) || isWhitespace(cx.char(to - 1))) {
    return false
  }

  for (let i = from; i < to; i += 1) {
    if (cx.char(i) === NEWLINE) {
      return false
    }
    if (!isWhitespace(cx.char(i))) {
      return true
    }
  }

  return false
}

function isEscaped(cx: InlineContextLike, pos: number): boolean {
  let backslashes = 0
  for (let i = pos - 1; cx.char(i) === BACKSLASH; i -= 1) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

function isTagBoundary(code: number): boolean {
  return (
    isMissingCode(code) ||
    isWhitespace(code) ||
    code === BRACKET_OPEN ||
    code === 40 /* '(' */ ||
    code === 123 /* '{' */
  )
}

function isTagStart(code: number): boolean {
  return isAsciiLetter(code)
}

function isTagBody(code: number): boolean {
  return (
    isAsciiLetter(code) ||
    isDigit(code) ||
    code === 95 /* '_' */ ||
    code === 45 /* '-' */ ||
    code === SLASH
  )
}

function isCalloutBoundary(code: number): boolean {
  return isMissingCode(code) || isWhitespace(code)
}

function isAsciiLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

function isCalloutTypeChar(code: number): boolean {
  return isAsciiLetter(code) || isDigit(code) || code === 95 /* '_' */ || code === 45 /* '-' */
}

function isDisplayMathDelimiterLine(text: string, delimiterIndex: number): boolean {
  if (delimiterIndex === -1) {
    return false
  }

  return (
    text.slice(0, delimiterIndex).trim().length === 0 &&
    text.slice(delimiterIndex + 2).trim().length === 0
  )
}

function findClosingDisplayMathLine(view: EditorView, fromLineNumber: number): Line | null {
  const doc = view.state.doc

  for (let lineNumber = fromLineNumber; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber)
    const delimiterIndex = line.text.indexOf('$$')

    if (isDisplayMathDelimiterLine(line.text, delimiterIndex)) {
      return line
    }
  }

  return null
}

function readMermaidFence(text: string): { index: number; tickCount: number } | null {
  const match = /^(\s*)(`{3,})\s*mermaid(?:\s|$)/i.exec(text)

  if (!match) {
    return null
  }

  return {
    index: match[1].length,
    tickCount: match[2].length
  }
}

function findClosingCodeFenceLine(
  view: EditorView,
  fromLineNumber: number,
  tickCount: number
): Line | null {
  const doc = view.state.doc
  const closingPattern = new RegExp(`^\\s*\`{${tickCount},}\\s*$`)

  for (let lineNumber = fromLineNumber; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber)

    if (closingPattern.test(line.text)) {
      return line
    }
  }

  return null
}

function readCalloutMarker(text: string): { type: string; from: number; to: number } | null {
  const match = /^(\s*>\s*)(\[!([a-z][\w-]*)\][+-]?)/i.exec(text)

  if (!match) {
    return null
  }

  const from = match[1].length
  return {
    type: match[3].toLocaleLowerCase(),
    from,
    to: from + match[2].length
  }
}

const BACKSLASH = 92
const BACKTICK = 96

/* -------------------------------------------------------------------------- */
/*                              Public extension                               */
/* -------------------------------------------------------------------------- */

/**
 * Markdown extension that adds MDX (JSX + brace expression) highlighting.
 * Pass this to `markdown({ extensions: [mdxHighlightExtension] })`.
 */
export const mdxHighlightExtension: MarkdownExtension = {
  defineNodes: nodeSpecs,
  parseInline: [
    jsxTagParser,
    braceParser,
    inlineMathParser,
    markParser,
    wikilinkParser,
    tagParser,
    calloutMarkerParser
  ]
}
