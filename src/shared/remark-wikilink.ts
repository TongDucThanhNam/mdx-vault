import type { Link, Parent, PhrasingContent, Root, Text } from 'mdast'
import { visit } from 'unist-util-visit'

import { createWikilinkUrl, parseWikilinkParts } from './wikilinks'

const WIKILINK_PATTERN = /\[\[([^\]\n]+)\]\]/g

declare module 'mdast' {
  interface LinkData {
    wikilink?: boolean
    target?: string
    display?: string
    hProperties?: Record<string, string>
  }
}

export function remarkWikilink() {
  return function transformWikilinks(tree: Root): void {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (typeof index !== 'number' || !parent || parent.type === 'link') {
        return
      }

      const replacement = parseWikilinkText(node.value)

      if (!replacement) {
        return
      }

      const typedParent = parent as Parent & { children: PhrasingContent[] }
      typedParent.children.splice(index, 1, ...replacement)
    })
  }
}

export function parseWikilinkText(value: string): PhrasingContent[] | null {
  const nodes: PhrasingContent[] = []
  let lastIndex = 0

  WIKILINK_PATTERN.lastIndex = 0

  for (const match of value.matchAll(WIKILINK_PATTERN)) {
    const matchIndex = match.index ?? 0
    const matchValue = match[0]
    const parts = parseWikilinkParts(match[1])

    if (!parts) {
      continue
    }

    if (matchIndex > lastIndex) {
      nodes.push(createTextNode(value.slice(lastIndex, matchIndex)))
    }

    nodes.push(createWikilinkNode(parts.target, parts.display))
    lastIndex = matchIndex + matchValue.length
  }

  if (nodes.length === 0) {
    return null
  }

  if (lastIndex < value.length) {
    nodes.push(createTextNode(value.slice(lastIndex)))
  }

  return nodes
}

function createTextNode(value: string): Text {
  return {
    type: 'text',
    value
  }
}

function createWikilinkNode(target: string, display: string): Link {
  return {
    type: 'link',
    url: createWikilinkUrl(target),
    title: null,
    children: [createTextNode(display)],
    data: {
      wikilink: true,
      target,
      display,
      hProperties: {
        'data-wikilink-target': target,
        'data-wikilink-display': display
      }
    }
  }
}
