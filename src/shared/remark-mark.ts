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

      const replacement = splitMarkText(node.value)

      if (replacement.length === 1 && isSameTextNode(replacement[0], node.value)) {
        return
      }

      parent.children.splice(index, 1, ...replacement)
      return index + replacement.length
    })
  }
}

function splitMarkText(value: string): PhrasingContent[] {
  const nodes: PhrasingContent[] = []
  let cursor = 0

  while (cursor < value.length) {
    const open = value.indexOf('==', cursor)

    if (open === -1) {
      appendText(nodes, value.slice(cursor))
      break
    }

    if (isEscaped(value, open)) {
      appendText(nodes, value.slice(cursor, open + 2))
      cursor = open + 2
      continue
    }

    const close = findClosingMark(value, open + 2)

    if (close === -1) {
      appendText(nodes, value.slice(cursor))
      break
    }

    const markedText = value.slice(open + 2, close)

    if (!isValidMarkedText(markedText)) {
      appendText(nodes, value.slice(cursor, open + 2))
      cursor = open + 2
      continue
    }

    appendText(nodes, value.slice(cursor, open))
    nodes.push(createMarkNode(markedText))
    cursor = close + 2
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', value }]
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

function createMarkNode(value: string): Emphasis {
  return {
    type: 'emphasis',
    data: {
      hName: 'mark'
    },
    children: [{ type: 'text', value }]
  }
}

function appendText(nodes: PhrasingContent[], value: string): void {
  if (!value) {
    return
  }

  const last = nodes.at(-1)
  if (last?.type === 'text') {
    last.value += value
    return
  }

  nodes.push({ type: 'text', value })
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
