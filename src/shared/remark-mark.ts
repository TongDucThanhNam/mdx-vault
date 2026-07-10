import type { Emphasis, PhrasingContent, Root, Text } from 'mdast'
import { visit } from 'unist-util-visit'

/**
 * Obsidian-compatible `==mark==` syntax.
 *
 * This is deliberately a tiny string-replacement pass: it never evaluates
 * template/code content, and it only converts balanced marks contained inside a
 * single text node. Ambiguous or unbalanced delimiters remain plain text.
 */
export function remarkMarks() {
  return function transformMarks(tree: Root): void {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (typeof index !== 'number' || !hasPhrasingChildren(parent)) {
        return
      }

      const replacement = splitMarkText(node)

      if (replacement.length === 1 && isSameTextNode(replacement[0], node.value)) {
        return
      }

      parent.children.splice(index, 1, ...replacement)
      return index + replacement.length
    })
  }
}

function splitMarkText(node: Text): PhrasingContent[] {
  const { value } = node
  const nodes: PhrasingContent[] = []
  let cursor = 0

  while (cursor < value.length) {
    const open = value.indexOf('==', cursor)

    if (open === -1) {
      appendText(nodes, node, cursor, value.length)
      break
    }

    if (isEscaped(value, open)) {
      appendText(nodes, node, cursor, open + 2)
      cursor = open + 2
      continue
    }

    const close = findClosingMark(value, open + 2)

    if (close === -1) {
      appendText(nodes, node, cursor, value.length)
      break
    }

    const markedText = value.slice(open + 2, close)

    if (!isValidMarkedText(markedText)) {
      appendText(nodes, node, cursor, open + 2)
      cursor = open + 2
      continue
    }

    appendText(nodes, node, cursor, open)
    nodes.push(createMarkNode(node, open, close))
    cursor = close + 2
  }

  return nodes.length > 0 ? nodes : [node]
}

function findClosingMark(value: string, from: number): number {
  let index = value.indexOf('==', from)

  while (index !== -1) {
    if (!isEscaped(value, index)) {
      return index
    }

    index = value.indexOf('==', index + 2)
  }

  return -1
}

function isValidMarkedText(value: string): boolean {
  return value.length > 0 && value.trim().length === value.length
}

function createMarkNode(node: Text, open: number, close: number): Emphasis {
  const value = node.value.slice(open + 2, close)
  const position = createRelativePosition(node, open, close + 2)
  const startOffset = position?.start.offset
  const endOffset = position?.end.offset

  return {
    type: 'emphasis',
    data: {
      hName: 'mark',
      ...(startOffset !== undefined && endOffset !== undefined
        ? {
            hProperties: {
              dataPreviewMarkStart: String(startOffset),
              dataPreviewMarkEnd: String(endOffset)
            }
          }
        : {})
    },
    children: [
      {
        type: 'text',
        value,
        position: createRelativePosition(node, open + 2, close)
      }
    ],
    position
  }
}

function appendText(nodes: PhrasingContent[], node: Text, start: number, end: number): void {
  const value = node.value.slice(start, end)

  if (!value) {
    return
  }

  const position = createRelativePosition(node, start, end)
  const last = nodes.at(-1)
  if (
    last?.type === 'text' &&
    last.position?.end.offset !== undefined &&
    last.position.end.offset === position?.start.offset
  ) {
    last.value += value
    last.position.end = position.end
    return
  }

  nodes.push({ type: 'text', value, position })
}

function createRelativePosition(node: Text, start: number, end: number): Text['position'] {
  const position = node.position
  const startOffset = position?.start.offset
  const endOffset = position?.end.offset

  if (
    !position ||
    startOffset === undefined ||
    endOffset === undefined ||
    endOffset - startOffset !== node.value.length
  ) {
    return undefined
  }

  return {
    start: advancePoint(position.start, node.value, start),
    end: advancePoint(position.start, node.value, end)
  }
}

function advancePoint(
  point: NonNullable<Text['position']>['start'],
  value: string,
  length: number
): NonNullable<Text['position']>['start'] {
  let line = point.line
  let column = point.column

  for (let index = 0; index < length; index += 1) {
    if (value.charCodeAt(index) === NEWLINE) {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }

  return {
    line,
    column,
    ...(point.offset !== undefined ? { offset: point.offset + length } : {})
  }
}

function isEscaped(value: string, index: number): boolean {
  let backslashCount = 0

  for (let i = index - 1; i >= 0 && value.charCodeAt(i) === BACKSLASH; i -= 1) {
    backslashCount += 1
  }

  return backslashCount % 2 === 1
}

function isSameTextNode(node: PhrasingContent, value: string): boolean {
  return node.type === 'text' && node.value === value
}

function hasPhrasingChildren(parent: unknown): parent is { children: PhrasingContent[] } {
  return (
    Boolean(parent) &&
    typeof parent === 'object' &&
    Array.isArray((parent as { children?: unknown }).children)
  )
}

const BACKSLASH = 92
const NEWLINE = 10
