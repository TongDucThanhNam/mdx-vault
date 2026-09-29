import type { Element, Root, Text } from 'hast'
import { createUniqueHeadingId } from '../../../shared/heading-identity'

interface PreviewSourceMapOptions {
  source: string
}

const eligibleTextParents = new Set([
  'blockquote',
  'details',
  'div',
  'dl',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'mark',
  'p',
  'strong',
  'td',
  'th'
])

const excludedAncestors = new Set(['a', 'code', 'pre', 'svg'])

/**
 * Wrap source-exact prose leaves with offsets used by Preview editing tools.
 * Transformed or escaped text is intentionally left unannotated.
 */
export function rehypePreviewSourceMap({ source }: PreviewSourceMapOptions) {
  return function annotatePreviewSource(tree: Root): Root {
    annotateChildren(tree, [], source)
    return tree
  }
}

/** Add app-generated heading identities after user HTML has passed sanitization. */
export function rehypePreviewHeadingIdentity() {
  return function identifyPreviewHeadings(tree: Root): Root {
    annotateHeadingIdentities(tree)
    return tree
  }
}

const sourceBlocks = new Set([
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'p',
  'pre',
  'table',
  'ul',
  'aside',
  'img'
])

/** Add trusted offsets only after untrusted HTML has passed sanitization. */
export function rehypePreviewBlockMap() {
  return function annotateBlocks(tree: Root): Root {
    annotateBlockChildren(tree)
    return tree
  }
}

function annotateBlockChildren(parent: Root | Element): void {
  parent.children = parent.children.map((child) => {
    if (child.type === 'element') {
      const id = child.properties?.id
      // GFM already prefixes generated footnote IDs. Sanitizer prefixes every
      // allowed ID once more; remove only that duplicate while retaining the
      // clobber-safe user-content prefix and the matching fragment target.
      if (typeof id === 'string' && /^user-content-user-content-fn(?:ref)?-/.test(id)) {
        child.properties.id = id.replace('user-content-user-content-', 'user-content-')
      }
      if (sourceBlocks.has(child.tagName) && child.position?.start.offset !== undefined) {
        child.properties = {
          ...child.properties,
          dataPreviewBlockStart: String(child.position.start.offset),
          dataPreviewBlockLine: String(child.position.start.line)
        }
      }
      annotateBlockChildren(child)
      return child
    }

    // safe-html restored this trusted MDX component after sanitization.
    // A neutral wrapper carries its source position without forwarding props.
    if (child.type === 'mdxJsxFlowElement' && child.position?.start.offset !== undefined) {
      return {
        type: 'element',
        tagName: 'div',
        properties: {
          dataPreviewBlockStart: String(child.position.start.offset),
          dataPreviewBlockLine: String(child.position.start.line)
        },
        children: [child],
        position: child.position
      }
    }
    return child
  })
}

function annotateHeadingIdentities(tree: Root): void {
  const occurrences = new Map<string, number>()
  let position = 0

  visitElements(tree, (element, parent) => {
    if (!/^h[1-6]$/.test(element.tagName)) return

    const identity = createUniqueHeadingId(readElementText(element), occurrences)
    const isFootnoteLabel =
      parent.type === 'element' &&
      parent.tagName === 'section' &&
      parent.properties.dataFootnotes !== undefined &&
      element.tagName === 'h2'
    element.properties = {
      ...element.properties,
      id: isFootnoteLabel ? 'footnote-label' : identity.id,
      dataMdxHeadingId: identity.id,
      dataMdxHeadingPosition: String(position)
    }
    position += 1
  })
}

function visitElements(
  parent: Root | Element,
  visit: (element: Element, parent: Root | Element) => void
): void {
  parent.children.forEach((child) => {
    if (child.type !== 'element') return
    visit(child, parent)
    visitElements(child, visit)
  })
}

function readElementText(element: Element): string {
  return element.children
    .map((child) => {
      if (child.type === 'text') return child.value
      if (child.type === 'element') return readElementText(child)
      return ''
    })
    .join('')
    .trim()
}

function annotateChildren(parent: Root | Element, ancestors: string[], source: string): void {
  const parentTag = parent.type === 'element' ? parent.tagName : null
  const nextAncestors = parentTag ? [...ancestors, parentTag] : ancestors

  parent.children = parent.children.map((child) => {
    if (child.type === 'text') {
      return createSourceSpan(child, parentTag, nextAncestors, source) ?? child
    }

    if (child.type === 'element') {
      annotateChildren(child, nextAncestors, source)
    }

    return child
  })
}

function createSourceSpan(
  node: Text,
  parentTag: string | null,
  ancestors: string[],
  source: string
): Element | null {
  if (
    !parentTag ||
    !eligibleTextParents.has(parentTag) ||
    ancestors.some((tagName) => excludedAncestors.has(tagName))
  ) {
    return null
  }

  const start = node.position?.start.offset
  const end = node.position?.end.offset

  if (
    start === undefined ||
    end === undefined ||
    start >= end ||
    source.slice(start, end) !== node.value
  ) {
    return null
  }

  return {
    type: 'element',
    tagName: 'span',
    properties: {
      dataPreviewSourceStart: String(start),
      dataPreviewSourceEnd: String(end)
    },
    children: [node],
    position: node.position
  }
}
