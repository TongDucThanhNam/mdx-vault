import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { type Options as SanitizeSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { unified, type Pluggable } from 'unified'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'
import type { Root as HastRoot } from 'hast'

import { remarkWikilink } from '../../shared/remark-wikilink'
import type { ExportScanResult } from '../../shared/export'

const COMPONENT_PLACEHOLDER_TAG = 'mdx-vault-component'
const COMPONENT_PLACEHOLDER_ATTR = 'dataMdxComponentId'
const componentNameRegex = /^[A-Z][A-Za-z0-9_]*$/

export interface RenderedNote {
  bodyHtml: string
  meta: ExportScanResult
}

interface MdxJsxNode {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement'
  name: string | null
  attributes?: MdxJsxAttribute[]
  children?: unknown[]
  position?: Root['position']
}

interface MdxJsxAttribute {
  type: 'mdxJsxAttribute'
  name: string
  value?: string | null | MdxExpressionNode
}

interface MdxExpressionNode {
  type: 'mdxFlowExpression' | 'mdxTextExpression' | 'mdxJsxAttributeValueExpression'
}

type AttributeValue = string | null | undefined | MdxExpressionNode

const remarkParsePlugin = resolvePluginDefault(remarkParse)
const remarkMdxPlugin = resolvePluginDefault(remarkMdx)
const remarkGfmPlugin = resolvePluginDefault(remarkGfm)
const remarkFrontmatterPlugin = resolvePluginDefault(remarkFrontmatter)
const remarkRehypePlugin = resolvePluginDefault(remarkRehype)
const rehypeSanitizePlugin = resolvePluginDefault(rehypeSanitize)
const rehypeStringifyPlugin = resolvePluginDefault(rehypeStringify)

const mdastPipeline = unified()
  .use(remarkParsePlugin)
  .use(remarkMdxPlugin)
  .use(remarkGfmPlugin)
  .use(remarkFrontmatterPlugin, ['yaml'])
  .use(remarkWikilink)
  .use(remarkReplaceMdxJsxWithPlaceholder)

const hastPipeline = unified()
  .use(remarkRehypePlugin)
  .use(rehypeSanitizePlugin, sanitizeSchema())
  .use(rehypeInjectJsxPlaceholders)

const htmlPipeline = unified().use(rehypeStringifyPlugin, {
  tightSelfClosing: true
})

interface InternalScanAccumulator {
  components: Set<string>
  sandboxIslands: ExportScanResult['sandboxIslands']
  imageAssets: Set<string>
  datasetAssets: Set<string>
  wikilinkTargets: Set<string>
}

/**
 * Parse an MDX source string into a HAST tree, replacing MDX JSX flow/text
 * elements with `<mdx-vault-component>` placeholders that the export writer
 * later swaps out for either a snapshot, an iframe, or a fallback. This
 * approach avoids running `evaluate()` (which would be `eval` of arbitrary
 * code) and produces deterministic output for the exporter.
 *
 * The visitor also collects metadata (used components, sandbox islands,
 * image and dataset references, wikilink targets) used by the export
 * orchestrator.
 */
export function parseNoteForExport(
  source: string,
  noteRelativePath: string,
  noteTitle: string
): RenderedNote {
  const mdast = mdastPipeline.parse(source)

  const scan: InternalScanAccumulator = {
    components: new Set(),
    sandboxIslands: [],
    imageAssets: new Set(),
    datasetAssets: new Set(),
    wikilinkTargets: new Set()
  }

  visit(mdast as Root, (node) => {
    if (isMdxJsxElement(node)) {
      const name = node.name ?? ''

      if (name === 'SandboxedHTML' || name === 'Interactive') {
        const kind = name === 'SandboxedHTML' ? 'html' : 'interactive'
        const src = readStringAttribute(node.attributes, 'src')
        if (src) {
          scan.sandboxIslands.push({
            kind,
            src,
            resolvedPath: '',
            manifestName: '',
            permissionStatus: 'prompt'
          })
        }
        return
      }

      if (componentNameRegex.test(name)) {
        scan.components.add(name)
      }

      if (name === 'DataChart') {
        const datasetSrc = readStringAttribute(node.attributes, 'src')
        if (datasetSrc) {
          scan.datasetAssets.add(datasetSrc)
        }
      }
      return
    }

    const candidate = node as { type?: string; url?: string }
    if (candidate.type === 'image' && typeof candidate.url === 'string') {
      if (!isExternalOrAbsoluteUrl(candidate.url) && !candidate.url.startsWith('wikilink:')) {
        scan.imageAssets.add(candidate.url)
      }
    }

    if (candidate.type === 'link' && typeof candidate.url === 'string') {
      if (candidate.url.startsWith('wikilink:')) {
        try {
          const target = decodeURIComponent(candidate.url.slice('wikilink:'.length))
          scan.wikilinkTargets.add(target)
        } catch {
          /* malformed wikilink */
        }
      }
    }
  })

  const tree = mdastPipeline.runSync(mdast) as Root
  const hast = hastPipeline.runSync(tree) as HastRoot
  const html = htmlPipeline.stringify(hast) as string
  const bodyHtml = stripDocumentWrapper(html)

  const meta: ExportScanResult = {
    noteRelativePath,
    noteTitle,
    usedComponents: [...scan.components].sort((left, right) => left.localeCompare(right)),
    sandboxIslands: scan.sandboxIslands,
    imageAssets: [...scan.imageAssets],
    datasetAssets: [...scan.datasetAssets],
    wikilinkTargets: [...scan.wikilinkTargets]
  }

  return {
    bodyHtml,
    meta
  }
}

/**
 * Remark plugin that swaps each `mdxJsxFlowElement` / `mdxJsxTextElement` for
 * a `paragraph` containing a sentinel text node. The downstream hast plugin
 * converts the sentinel into a `<mdx-vault-component>` HAST element after
 * sanitize has run, which avoids the sanitize/attribute-stripping gymnastics
 * required when round-tripping raw HTML through `rehype-raw`.
 */
function remarkReplaceMdxJsxWithPlaceholder() {
  return function transform(tree: Root): void {
    let counter = 0

    walk(tree)

    function walk(node: unknown): void {
      if (!node || typeof node !== 'object') return
      const children = (node as { children?: unknown[] }).children
      if (!Array.isArray(children)) return

      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]
        if (isMdxJsxElement(child)) {
          const id = String(counter)
          counter += 1
          children[i] = buildPlaceholderNode(child, id)
        } else {
          walk(child)
        }
      }
    }
  }
}

function buildPlaceholderNode(
  node: MdxJsxNode,
  id: string
): { type: 'paragraph'; children: unknown[] } {
  const name = node.name ?? ''
  const attributes: Array<[string, string]> = [[COMPONENT_PLACEHOLDER_ATTR, id]]
  if (componentNameRegex.test(name) || name === 'SandboxedHTML' || name === 'Interactive') {
    attributes.push(['data-component-name', name])
  }
  const propsMap: Record<string, unknown> = {}
  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== 'mdxJsxAttribute') {
      continue
    }
    const serialized = serializeAttributeValue(attribute.value)
    if (serialized === null) continue
    if (attribute.name === 'src') {
      attributes.push([attribute.name, serialized])
    } else {
      // Store the raw parsed value in the props map so JSON.stringify
      // preserves number/boolean types.
      const parsed = tryParseExpressionValue(attribute.value)
      if (parsed === undefined) continue
      propsMap[attribute.name] = parsed
    }
  }
  if (Object.keys(propsMap).length > 0) {
    attributes.push(['data-props', JSON.stringify(propsMap)])
  }
  const payload = JSON.stringify({ id, name, attrs: attributes })
  const sentinel = `MDX_VAULT_PLACEHOLDER ${payload} MDX_VAULT_PLACEHOLDER_END`
  return {
    type: 'paragraph',
    children: [{ type: 'text', value: sentinel }]
  }
}

function tryParseExpressionValue(value: AttributeValue): unknown {
  if (typeof value === 'string') return value
  const expr = value as { value?: string; data?: { estree?: unknown } }
  if (typeof expr.value === 'string') {
    const trimmed = expr.value.trim()
    try {
      const parsed = JSON.parse(trimmed)
      if (
        typeof parsed === 'string' ||
        typeof parsed === 'number' ||
        typeof parsed === 'boolean' ||
        parsed === null
      ) {
        return parsed
      }
    } catch {
      return trimmed
    }
  }
  return undefined
}

function serializeAttributeValue(value: AttributeValue): string | null {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  const expr = value as { value?: string; data?: { estree?: unknown } }
  if (typeof expr.value === 'string') {
    const trimmed = expr.value.trim()
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') {
        return String(parsed)
      }
    } catch {
      /* not JSON, skip */
    }
  }
  return null
}

function sanitizeSchema(): SanitizeSchema {
  return {
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
      '*': ['ariaLabel', 'ariaLabelledBy', 'ariaDescribedBy', 'title', 'className'],
      a: ['href', 'title'],
      blockquote: ['cite'],
      code: [['className', /^language-[\w-]+$/]],
      del: ['cite'],
      img: ['alt', 'src', 'title', 'width', 'height'],
      ol: ['start', ['type', '1', 'a', 'A', 'i', 'I']],
      th: ['align'],
      td: ['align'],
      [COMPONENT_PLACEHOLDER_TAG]: [COMPONENT_PLACEHOLDER_ATTR, 'data-component-name'],
      svg: ['viewBox', 'width', 'height', 'role', 'ariaLabel', 'ariaHidden', 'focusable'],
      circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'strokeWidth'],
      ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'strokeWidth'],
      g: ['fill', 'stroke', 'strokeWidth'],
      line: ['x1', 'y1', 'y2', 'y2', 'stroke', 'strokeWidth', 'strokeLinecap'],
      path: ['d', 'fill', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin'],
      polygon: ['points', 'fill', 'stroke', 'strokeWidth'],
      polyline: ['points', 'fill', 'stroke', 'strokeWidth'],
      rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'strokeWidth'],
      text: ['x', 'y', 'dx', 'dy', 'fill', 'fontSize', 'textAnchor']
    },
    clobber: ['id', 'name'],
    clobberPrefix: 'user-content-',
    protocols: {
      cite: ['http', 'https', 'mailto'],
      href: ['http', 'https', 'mailto']
    },
    required: {},
    // We DO NOT want rehype-sanitize to drop the placeholder element itself.
    strip: ['script', 'style', 'iframe', 'foreignObject', 'foreignobject'],
    tagNames: [
      'a',
      'abbr',
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
      'dfn',
      'div',
      'dl',
      'dt',
      'em',
      'figcaption',
      'figure',
      'g',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'i',
      'img',
      'ins',
      'kbd',
      'li',
      'line',
      'mark',
      'ol',
      'p',
      'path',
      'polygon',
      'polyline',
      'pre',
      'q',
      'rect',
      's',
      'samp',
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
      'time',
      'tr',
      'u',
      'ul',
      'var',
      COMPONENT_PLACEHOLDER_TAG,
      'raw'
    ]
  }
}

function rehypeInjectJsxPlaceholders() {
  return function transform(tree: HastRoot): void {
    walk(tree)

    function walk(node: unknown): void {
      if (!node || typeof node !== 'object') return
      const children = (node as { children?: unknown[] }).children
      if (!Array.isArray(children)) return

      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]
        const c = child as { type?: string; value?: string }
        if (
          c.type === 'text' &&
          typeof c.value === 'string' &&
          c.value.includes('MDX_VAULT_PLACEHOLDER')
        ) {
          const parts = splitSentinelText(c.value)
          const replacement: unknown[] = []
          for (const part of parts) {
            if (part.kind === 'text') {
              if (part.value.length === 0) continue
              replacement.push({ type: 'text', value: part.value })
            } else {
              const properties: Record<string, string> = {}
              for (const [k, v] of part.attrs) {
                properties[k] = v
              }
              replacement.push({
                type: 'element',
                tagName: COMPONENT_PLACEHOLDER_TAG,
                properties,
                children: []
              })
            }
          }
          children.splice(i, 1, ...replacement)
          i += replacement.length - 1
        } else {
          walk(child)
        }
      }
    }
  }
}

function splitSentinelText(
  value: string
): Array<
  | { kind: 'text'; value: string }
  | { kind: 'placeholder'; id: string; name: string; attrs: Array<[string, string]> }
> {
  const out: ReturnType<typeof splitSentinelText> = []
  const pattern = /MDX_VAULT_PLACEHOLDER (.+?) MDX_VAULT_PLACEHOLDER_END/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      out.push({ kind: 'text', value: value.slice(lastIndex, match.index) })
    }
    try {
      const payload = JSON.parse(match[1]) as {
        id: string
        name: string
        attrs: Array<[string, string]>
      }
      out.push({ kind: 'placeholder', id: payload.id, name: payload.name, attrs: payload.attrs })
    } catch {
      /* ignore malformed */
    }
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < value.length) {
    out.push({ kind: 'text', value: value.slice(lastIndex) })
  }
  return out
}

function isMdxJsxElement(node: unknown): node is MdxJsxNode {
  const candidate = node as { type?: string }
  return candidate?.type === 'mdxJsxFlowElement' || candidate?.type === 'mdxJsxTextElement'
}

function isExternalOrAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//') || url.startsWith('/')
}

function readStringAttribute(
  attributes: MdxJsxAttribute[] | undefined,
  name: string
): string | null {
  if (!attributes) {
    return null
  }
  for (const attribute of attributes) {
    if (attribute.type === 'mdxJsxAttribute' && attribute.name === name) {
      if (typeof attribute.value === 'string' && attribute.value.trim()) {
        return attribute.value
      }
    }
  }
  return null
}

function resolvePluginDefault<TPlugin extends Pluggable>(plugin: TPlugin): TPlugin {
  if (typeof plugin === 'function') {
    return plugin
  }
  const candidate = plugin as { default?: unknown }
  return typeof candidate.default === 'function' ? (candidate.default as TPlugin) : plugin
}

function stripDocumentWrapper(html: string): string {
  const match = html.match(/<body>([\s\S]*)<\/body>/)
  if (match) {
    return match[1]
  }
  return html
}

export const EXPORT_PLACEHOLDER_TAG = COMPONENT_PLACEHOLDER_TAG
export const EXPORT_PLACEHOLDER_ATTR = COMPONENT_PLACEHOLDER_ATTR
