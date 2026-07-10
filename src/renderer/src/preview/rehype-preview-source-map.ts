import type { Element, Root, Text } from 'hast'

interface PreviewSourceMapOptions {
  source: string
}

const eligibleTextParents = new Set([
  'blockquote',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
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
