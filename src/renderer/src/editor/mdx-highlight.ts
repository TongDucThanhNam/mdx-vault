/**
 * MDX syntax highlighting for the CodeMirror 6 markdown editor.
 *
 * There is no official `@codemirror/lang-mdx` package. This module adds a
 * `@lezer/markdown` extension that recognizes the three MDX-specific inline
 * constructs and tags them with highlighting tags so the existing CodeMirror
 * theme colors them:
 *
 *   1. JSX tags:        `<Tag />`, `<Tag>`, `</Tag>`, `<Tag attr="x">`
 *   2. Brace expressions: `{expr}` in prose (rendered as JSX children)
 *
 * This is **presentation-only** highlighting. It does not build a real MDX AST,
 * does not validate JSX, and does not affect the preview/render pipeline. The
 * goal is purely to make MDX source readable in the editor.
 *
 * Reference: @lezer/markdown InlineParser API + @lezer/highlight tags.
 */

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

const nodeSpecs: NodeSpec[] = [
  { name: MDX_JSX_OPEN },
  { name: MDX_JSX_CLOSE },
  { name: MDX_JSX_NAME, style: t.tagName },
  { name: MDX_JSX_ATTR, style: t.attributeName },
  { name: MDX_JSX_STRING, style: t.string },
  { name: MDX_JSX_PUNCT, style: t.angleBracket },
  { name: MDX_BRACE },
  { name: MDX_BRACE_MARK, style: t.brace }
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

    const text = cx.text
    const start = pos
    let i = pos + 1
    let isClosing = false

    if (text.charCodeAt(i) === SLASH) {
      isClosing = true
      i += 1
    }

    // Tag name: letters, digits, `.`, `-`, `:` (member expressions allowed).
    const nameStart = i
    if (!isTagNameChar(text.charCodeAt(i)) || isDigit(text.charCodeAt(i))) {
      // Tag name cannot start with a digit; bail (likely markdown `<`).
      return -1
    }
    while (i < text.length && isTagNameChar(text.charCodeAt(i))) {
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
    i = scanAttributes(cx, text, i, elements)

    if (i === -1) {
      // Unbalanced — not a tag we can confidently claim. Let other parsers
      // handle it.
      return -1
    }

    // Closing punct (`>` or `/>`).
    elements.push(cx.elt(MDX_JSX_PUNCT, i, i + (text.charCodeAt(i) === SLASH ? 2 : 1)))
    const endPos = text.charCodeAt(i) === SLASH ? i + 2 : i + 1

    cx.addElement(cx.elt(MDX_JSX_OPEN, start, endPos, elements))
    return endPos
  }
}

/**
 * Scan attributes inside a JSX tag, appending elements. Returns the index of
 * the closing `>` or `/>`, or -1 if the tag looks unbalanced.
 */
function scanAttributes(
  cx: InlineContextLike,
  text: string,
  start: number,
  elements: Element[]
): number {
  let i = start

  while (i < text.length) {
    const ch = text.charCodeAt(i)

    // Whitespace — skip.
    if (isWhitespace(ch)) {
      i += 1
      continue
    }

    if (ch === GT) {
      return i
    }

    if (ch === SLASH && text.charCodeAt(i + 1) === GT) {
      return i
    }

    // Attribute name: letter/underscore start, then word chars.
    if (isAttrNameStart(ch)) {
      const attrStart = i
      while (i < text.length && isAttrNameChar(text.charCodeAt(i))) {
        i += 1
      }
      elements.push(cx.elt(MDX_JSX_ATTR, attrStart, i))

      // Optional `="value"` or `={expr}`.
      const afterName = text.charCodeAt(i)
      if (afterName === EQUALS) {
        elements.push(cx.elt(MDX_JSX_PUNCT, i, i + 1))
        i += 1

        if (text.charCodeAt(i) === DOUBLE_QUOTE || text.charCodeAt(i) === SINGLE_QUOTE) {
          const quote = text.charCodeAt(i)
          const valStart = i
          i += 1
          while (i < text.length && text.charCodeAt(i) !== quote) {
            i += 1
          }
          // include closing quote if present
          if (i < text.length) {
            i += 1
          }
          elements.push(cx.elt(MDX_JSX_STRING, valStart, i))
        } else if (text.charCodeAt(i) === BRACE_OPEN) {
          // `={expr}` — find matching closing brace.
          const exprEnd = findMatchingBrace(text, i)
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

    const text = cx.text
    const end = findMatchingBrace(text, pos)

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
/*                                 Helpers                                     */
/* -------------------------------------------------------------------------- */

/** Minimal slice of InlineContext used by attribute scanning. */
interface InlineContextLike {
  elt(type: string, from: number, to: number): Element
}

function findMatchingBrace(text: string, openPos: number): number {
  let depth = 0
  let inString: number | null = null

  for (let i = openPos; i < text.length; i += 1) {
    const ch = text.charCodeAt(i)

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
  parseInline: [jsxTagParser, braceParser]
}
