import type { BlockContent, Blockquote, Content, Paragraph, Root, Text } from 'mdast'
import { visit } from 'unist-util-visit'

export const calloutTypes = ['note', 'tip', 'warning', 'danger', 'info'] as const
export type CalloutType = (typeof calloutTypes)[number]

const calloutTypeSet = new Set<string>(calloutTypes)
const calloutPattern = /^\[!([a-z][\w-]*)\][+-]?(?:[ \t]+([^\n]*))?\n?/i

export function remarkCallouts() {
  return function transformCallouts(tree: Root): void {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const callout = readCallout(node)

      if (!callout) {
        return
      }

      setHtmlData(node, {
        hName: 'aside',
        hProperties: {
          className: ['mdx-callout'],
          dataCallout: callout.type
        }
      })

      node.children = [createTitleNode(callout.title), ...removeMarkerLine(callout)]
    })
  }
}

function readCallout(node: Blockquote): {
  type: CalloutType
  title: string
  paragraph: Paragraph
  firstText: Text
  remainingText: string
} | null {
  const paragraph = node.children[0]

  if (!isParagraph(paragraph)) {
    return null
  }

  const firstText = paragraph.children[0]

  if (!isText(firstText)) {
    return null
  }

  const match = calloutPattern.exec(firstText.value)

  if (!match) {
    return null
  }

  const type = normalizeCalloutType(match[1])

  if (!type) {
    return null
  }

  const title = match[2]?.trim() || toTitle(type)

  return {
    type,
    title,
    paragraph,
    firstText,
    remainingText: firstText.value.slice(match[0].length)
  }
}

function removeMarkerLine({
  paragraph,
  firstText,
  remainingText
}: {
  paragraph: Paragraph
  firstText: Text
  remainingText: string
}): BlockContent[] {
  const children = [...paragraph.children]
  const firstTextIndex = children.indexOf(firstText)

  if (remainingText) {
    children[firstTextIndex] = {
      ...firstText,
      value: remainingText
    }
  } else {
    children.splice(firstTextIndex, 1)
  }

  if (children.length === 0) {
    return []
  }

  return [
    {
      ...paragraph,
      children
    }
  ]
}

function createTitleNode(title: string): Paragraph {
  const node: Paragraph = {
    type: 'paragraph',
    children: [{ type: 'text', value: title }]
  }

  setHtmlData(node, {
    hName: 'div',
    hProperties: {
      className: ['mdx-callout-title']
    }
  })

  return node
}

function normalizeCalloutType(value: string): CalloutType | null {
  const normalized = value.toLowerCase()

  return calloutTypeSet.has(normalized) ? (normalized as CalloutType) : null
}

function toTitle(type: CalloutType): string {
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`
}

function setHtmlData(
  node: { data?: unknown },
  data: {
    hName: string
    hProperties: Record<string, unknown>
  }
): void {
  const currentData =
    node.data && typeof node.data === 'object' && !Array.isArray(node.data) ? node.data : {}

  ;(node as { data: Record<string, unknown> }).data = {
    ...currentData,
    ...data
  }
}

function isParagraph(node: Content | undefined): node is Paragraph {
  return node?.type === 'paragraph'
}

function isText(node: Paragraph['children'][number] | undefined): node is Text {
  return node?.type === 'text'
}
