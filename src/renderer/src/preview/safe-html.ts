import rehypeSanitize from 'rehype-sanitize'
import type { Options as SanitizeSchema } from 'rehype-sanitize'
import type { Element, Root, RootContent } from 'hast'

import { calloutTypes } from '../../../shared/remark-callouts'

type SafeHtmlNode = Root | RootContent | MdxJsxNode | MdxExpressionNode

interface MdxJsxNode {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement'
  name: string | null
  attributes?: MdxJsxAttribute[]
  children?: SafeHtmlNode[]
  position?: Root['position']
  data?: unknown
}

interface MdxJsxAttribute {
  type: 'mdxJsxAttribute'
  name: string
  value?: string | null | MdxExpressionNode
}

interface MdxExpressionNode {
  type: 'mdxFlowExpression' | 'mdxTextExpression' | 'mdxJsxAttributeValueExpression'
}

const componentPlaceholderTagName = 'mdx-vault-component'
const componentPlaceholderAttribute = 'dataMdxComponentId'

const safeHtmlSchema: SanitizeSchema = {
  allowComments: false,
  allowDoctypes: false,
  ancestors: {
    caption: ['table'],
    col: ['colgroup'],
    colgroup: ['table'],
    tbody: ['table'],
    td: ['table', 'tbody', 'tfoot', 'thead', 'tr'],
    tfoot: ['table'],
    th: ['table', 'tbody', 'tfoot', 'thead', 'tr'],
    thead: ['table'],
    tr: ['table', 'tbody', 'tfoot', 'thead']
  },
  attributes: {
    '*': ['ariaLabel', 'ariaLabelledBy', 'ariaDescribedBy', 'title'],
    a: ['href', 'title'],
    aside: [
      ['className', 'mdx-callout'],
      ['dataCallout', ...calloutTypes]
    ],
    blockquote: ['cite'],
    // Math code classes are emitted by remark-math and consumed by trusted rehype-katex
    // after sanitize; keep this allowlist narrow.
    code: [['className', /^language-[\w-]+$/, 'math-inline', 'math-display']],
    del: ['cite'],
    div: [['className', 'mdx-callout-title']],
    img: ['alt', 'title', 'width', 'height'],
    ol: ['start', ['type', '1', 'a', 'A', 'i', 'I']],
    th: ['align'],
    td: ['align'],
    [componentPlaceholderTagName]: [componentPlaceholderAttribute],
    svg: ['viewBox', 'width', 'height', 'role', 'ariaLabel', 'ariaHidden', 'focusable'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'strokeWidth'],
    ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'strokeWidth'],
    g: ['fill', 'stroke', 'strokeWidth'],
    line: ['x1', 'x2', 'y1', 'y2', 'stroke', 'strokeWidth', 'strokeLinecap'],
    path: ['d', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin'],
    polygon: ['points', 'fill', 'stroke', 'strokeWidth'],
    polyline: ['points', 'fill', 'stroke', 'strokeWidth'],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'strokeWidth'],
    text: ['x', 'y', 'dx', 'dy', 'fill', 'fontSize', 'textAnchor']
  },
  clobber: ['id', 'name'],
  clobberPrefix: 'user-content-',
  protocols: {
    cite: ['http', 'https'],
    href: ['http', 'https', 'mailto']
  },
  required: {},
  strip: ['script', 'style', 'iframe', 'foreignObject', 'foreignobject'],
  tagNames: [
    'a',
    'abbr',
    'aside',
    'b',
    'blockquote',
    'br',
    'caption',
    'circle',
    'code',
    'col',
    'colgroup',
    'dd',
    'del',
    'details',
    'div',
    'dl',
    'dt',
    'ellipse',
    'em',
    'g',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'img',
    'li',
    'line',
    'mark',
    'ol',
    'p',
    'path',
    'polygon',
    'polyline',
    'pre',
    'rect',
    's',
    'span',
    'strong',
    'sub',
    'summary',
    'sup',
    'svg',
    'table',
    'tbody',
    'td',
    'text',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
    componentPlaceholderTagName
  ]
}

const sanitizeTree = rehypeSanitize(safeHtmlSchema) as (tree: Root) => Root

export function rehypeSafeHtml() {
  return function transformSafeHtml(tree: Root): Root {
    const componentNodes = new Map<string, MdxJsxNode>()
    const preparedTree = prepareNode(tree, componentNodes) as Root
    const sanitizedTree = sanitizeTree(preparedTree)

    return restoreComponentNodes(sanitizedTree, componentNodes) as Root
  }
}

function prepareNode(
  node: SafeHtmlNode,
  componentNodes: Map<string, MdxJsxNode>
): SafeHtmlNode | null {
  if (isMdxJsxNode(node)) {
    if (!node.name) {
      return null
    }

    if (isComponentName(node.name)) {
      return createComponentPlaceholder(node, componentNodes)
    }

    return mdxJsxToElement(node, componentNodes)
  }

  if (isMdxExpressionNode(node)) {
    return null
  }

  if (hasChildren(node)) {
    return {
      ...node,
      children: prepareChildren(node.children, componentNodes)
    } as SafeHtmlNode
  }

  return node
}

function prepareChildren(
  children: SafeHtmlNode[],
  componentNodes: Map<string, MdxJsxNode>
): SafeHtmlNode[] {
  return children.flatMap((child) => {
    const preparedChild = prepareNode(child, componentNodes)

    return preparedChild ? [preparedChild] : []
  })
}

function mdxJsxToElement(node: MdxJsxNode, componentNodes: Map<string, MdxJsxNode>): Element {
  return {
    type: 'element',
    tagName: node.name ?? 'div',
    properties: mdxAttributesToProperties(node.attributes ?? []),
    children: prepareChildren(node.children ?? [], componentNodes) as Element['children'],
    position: node.position
  }
}

function mdxAttributesToProperties(attributes: MdxJsxAttribute[]): Element['properties'] {
  const properties: Element['properties'] = {}

  for (const attribute of attributes) {
    if (attribute.type !== 'mdxJsxAttribute') {
      continue
    }

    if (typeof attribute.value === 'string') {
      properties[attribute.name] = attribute.value
      continue
    }

    if (attribute.value === null || attribute.value === undefined) {
      properties[attribute.name] = true
    }
  }

  return properties
}

function createComponentPlaceholder(
  node: MdxJsxNode,
  componentNodes: Map<string, MdxJsxNode>
): Element {
  const id = String(componentNodes.size)
  componentNodes.set(id, node)

  return {
    type: 'element',
    tagName: componentPlaceholderTagName,
    properties: {
      [componentPlaceholderAttribute]: id
    },
    children: [],
    position: node.position
  }
}

function restoreComponentNodes(
  node: SafeHtmlNode,
  componentNodes: Map<string, MdxJsxNode>
): SafeHtmlNode | null {
  if (isElement(node) && node.tagName === componentPlaceholderTagName) {
    const id = node.properties[componentPlaceholderAttribute]

    if (typeof id === 'string') {
      return componentNodes.get(id) ?? null
    }
  }

  if (hasChildren(node)) {
    return {
      ...node,
      children: node.children.flatMap((child) => {
        const restoredChild = restoreComponentNodes(child, componentNodes)

        return restoredChild ? [restoredChild] : []
      })
    } as SafeHtmlNode
  }

  return node
}

function hasChildren(node: SafeHtmlNode): node is SafeHtmlNode & { children: SafeHtmlNode[] } {
  return 'children' in node && Array.isArray(node.children)
}

function isElement(node: SafeHtmlNode): node is Element {
  return node.type === 'element'
}

function isMdxJsxNode(node: SafeHtmlNode): node is MdxJsxNode {
  return node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement'
}

function isMdxExpressionNode(node: SafeHtmlNode): node is MdxExpressionNode {
  return (
    node.type === 'mdxFlowExpression' ||
    node.type === 'mdxTextExpression' ||
    node.type === 'mdxJsxAttributeValueExpression'
  )
}

function isComponentName(name: string): boolean {
  const firstCharacter = name.at(0)
  return firstCharacter !== undefined && firstCharacter === firstCharacter.toLocaleUpperCase()
}
