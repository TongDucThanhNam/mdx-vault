import type { Element as HastElement, Root as HastRoot, RootContent as HastRootContent } from 'hast'
import type { Root as MdastRoot } from 'mdast'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize, { type Options as SanitizeSchema } from 'rehype-sanitize'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { type Pluggable, unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'
import { z } from 'zod'
import { componentRegistry } from '../../renderer/src/preview/registry'
import type { ExportDiagnostic, ExportScanResult } from '../../shared/export'
import { calloutTypes, remarkCallouts } from '../../shared/remark-callouts'
import { remarkMarks } from '../../shared/remark-mark'
import { remarkWikilink } from '../../shared/remark-wikilink'

export type ExportJsonValue =
  | null
  | string
  | number
  | boolean
  | ExportJsonValue[]
  | { [key: string]: ExportJsonValue }

export interface ExportSourceLocation {
  line: number
  column: number
  offset?: number
}

interface ExportIrNodeBase {
  id: string
  location?: ExportSourceLocation
}

export interface ExportIrTextNode extends ExportIrNodeBase {
  type: 'text'
  value: string
}

export interface ExportIrElementNode extends ExportIrNodeBase {
  type: 'element'
  tagName: string
  properties: Record<string, ExportJsonValue>
  children: ExportIrNode[]
}

export interface ExportIrComponentNode extends ExportIrNodeBase {
  type: 'component'
  name: string
  props: Record<string, ExportJsonValue>
  children: ExportIrNode[]
}

export interface ExportIrSandboxNode extends ExportIrNodeBase {
  type: 'sandbox'
  kind: 'html' | 'interactive'
  src: string
  props: Record<string, ExportJsonValue>
}

export type ExportIrNode =
  | ExportIrTextNode
  | ExportIrElementNode
  | ExportIrComponentNode
  | ExportIrSandboxNode

export interface ExportIrDocument {
  version: 1
  noteRelativePath: string
  children: ExportIrNode[]
}

export interface ParsedExportDocument {
  ir: ExportIrDocument
  meta: ExportScanResult
}

interface MdxPosition {
  start?: { line?: number; column?: number; offset?: number }
}

interface MdxNode {
  type?: string
  name?: string | null
  value?: string
  url?: string
  attributes?: MdxAttribute[]
  children?: MdxNode[]
  position?: MdxPosition
  data?: { estree?: unknown }
}

type MdxAttribute =
  | {
      type: 'mdxJsxAttribute'
      name: string
      value?: string | null | MdxExpression
      position?: MdxPosition
    }
  | {
      type: 'mdxJsxExpressionAttribute'
      value?: string
      position?: MdxPosition
    }

interface MdxExpression {
  type: 'mdxFlowExpression' | 'mdxTextExpression' | 'mdxJsxAttributeValueExpression'
  value?: string
  data?: { estree?: unknown }
  position?: MdxPosition
}

interface EstreeNode {
  type?: string
  value?: unknown
  regex?: unknown
  bigint?: unknown
  operator?: string
  argument?: EstreeNode
  elements?: Array<EstreeNode | null>
  properties?: EstreeNode[]
  kind?: string
  computed?: boolean
  method?: boolean
  shorthand?: boolean
  key?: EstreeNode
  expressions?: EstreeNode[]
  quasis?: Array<{ value?: { cooked?: string | null } }>
  expression?: EstreeNode
  body?: EstreeNode[]
}

interface ParseContext {
  noteRelativePath: string
  sequence: number
  components: Set<string>
  sandboxes: ExportScanResult['sandboxIslands']
  imageAssets: Set<string>
  datasetAssets: Set<string>
  wikilinkTargets: Set<string>
  diagnostics: ExportDiagnostic[]
}

const registryByName = new Map(componentRegistry.map((entry) => [entry.name, entry]))
const componentNameRegex = /^[A-Z][A-Za-z0-9_]*$/
const forbiddenObjectKeys = new Set(['__proto__', 'constructor', 'prototype'])

const remarkParsePlugin = resolvePluginDefault(remarkParse)
const remarkMdxPlugin = resolvePluginDefault(remarkMdx)
const remarkGfmPlugin = resolvePluginDefault(remarkGfm)
const remarkMathPlugin = resolvePluginDefault(remarkMath)
const remarkFrontmatterPlugin = resolvePluginDefault(remarkFrontmatter)
const remarkRehypePlugin = resolvePluginDefault(remarkRehype)
const rehypeHighlightPlugin = resolvePluginDefault(rehypeHighlight)
const rehypeKatexPlugin = resolvePluginDefault(rehypeKatex)
const rehypeSanitizePlugin = resolvePluginDefault(rehypeSanitize)

const sourcePipeline = unified()
  .use(remarkParsePlugin)
  .use(remarkMdxPlugin)
  .use(remarkGfmPlugin)
  .use(remarkMathPlugin)
  .use(remarkFrontmatterPlugin, ['yaml'])
  .use(remarkWikilink)
  .use(remarkMarks)
  .use(remarkCallouts)

const markdownToHastPipeline = unified()
  .use(remarkRehypePlugin)
  .use(rehypeSanitizePlugin, exportSanitizeSchema())
  .use(rehypeKatexPlugin)
  .use(rehypeHighlightPlugin, { plainText: ['mermaid'] })
  .use(rehypeMermaidFallback)

const sanitizeHastPipeline = unified().use(rehypeSanitizePlugin, exportSanitizeSchema())

const jsonValueSchema: z.ZodType<ExportJsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
)

const sourceLocationSchema = z
  .object({
    line: z.number().int().positive(),
    column: z.number().int().positive(),
    offset: z.number().int().nonnegative().optional()
  })
  .strict()

const irNodeSchema: z.ZodType<ExportIrNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z
      .object({
        type: z.literal('text'),
        id: z.string().min(1),
        location: sourceLocationSchema.optional(),
        value: z.string()
      })
      .strict(),
    z
      .object({
        type: z.literal('element'),
        id: z.string().min(1),
        location: sourceLocationSchema.optional(),
        tagName: z.string().min(1),
        properties: z.record(z.string(), jsonValueSchema),
        children: z.array(irNodeSchema)
      })
      .strict(),
    z
      .object({
        type: z.literal('component'),
        id: z.string().min(1),
        location: sourceLocationSchema.optional(),
        name: z.string().min(1),
        props: z.record(z.string(), jsonValueSchema),
        children: z.array(irNodeSchema)
      })
      .strict(),
    z
      .object({
        type: z.literal('sandbox'),
        id: z.string().min(1),
        location: sourceLocationSchema.optional(),
        kind: z.enum(['html', 'interactive']),
        src: z.string().min(1),
        props: z.record(z.string(), jsonValueSchema)
      })
      .strict()
  ])
)

export const exportIrDocumentSchema: z.ZodType<ExportIrDocument> = z
  .object({
    version: z.literal(1),
    noteRelativePath: z.string().min(1),
    children: z.array(irNodeSchema)
  })
  .strict()

export function parseNoteToExportIr(
  source: string,
  noteRelativePath: string,
  noteTitle: string
): ParsedExportDocument {
  const parsed = sourcePipeline.parse(source) as MdastRoot
  const transformed = sourcePipeline.runSync(parsed) as MdastRoot
  const context: ParseContext = {
    noteRelativePath,
    sequence: 0,
    components: new Set(),
    sandboxes: [],
    imageAssets: new Set(),
    datasetAssets: new Set(),
    wikilinkTargets: new Set(),
    diagnostics: []
  }

  collectMarkdownReferences(transformed, context)
  const children = buildExportNodes(transformed.children as MdxNode[], context)
  const ir = exportIrDocumentSchema.parse({ version: 1, noteRelativePath, children })

  return {
    ir,
    meta: {
      noteRelativePath,
      noteTitle,
      usedComponents: [...context.components].sort((left, right) => left.localeCompare(right)),
      sandboxIslands: context.sandboxes,
      imageAssets: [...context.imageAssets],
      datasetAssets: [...context.datasetAssets],
      wikilinkTargets: [...context.wikilinkTargets],
      diagnostics: context.diagnostics
    }
  }
}

function buildExportNodes(nodes: MdxNode[], context: ParseContext): ExportIrNode[] {
  const output: ExportIrNode[] = []

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]

    if (node.type === 'yaml') {
      continue
    }

    if (isMdxJsxElement(node)) {
      output.push(...buildMdxJsxNode(node, context))
      continue
    }

    if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') {
      const decoded = decodeExpression(node as MdxExpression)
      if (decoded.ok && isRenderableChildLiteral(decoded.value)) {
        if (decoded.value !== null) {
          output.push(createTextNode(String(decoded.value), node.position, context))
        }
      } else {
        addDiagnostic(context, {
          code: 'UNSUPPORTED_MDX_EXPRESSION',
          severity: 'blocking',
          message: decoded.ok
            ? 'This MDX child expression is not a text literal. Replace it with prose or a trusted component prop.'
            : `This MDX child expression cannot be exported safely: ${decoded.reason}. Replace it with a literal value.`,
          position: node.position
        })
      }
      continue
    }

    if (node.type === 'mdxjsEsm') {
      addDiagnostic(context, {
        code: 'UNSUPPORTED_MDX_ESM',
        severity: 'blocking',
        message:
          'Import/export statements cannot be represented in a self-contained safe export. Move behavior to the registry or interactives/.',
        position: node.position
      })
      continue
    }

    if (containsExportSyntax(node)) {
      output.push(...buildMixedMarkdownNode(node, context))
      continue
    }

    const markdownChunk: MdxNode[] = [node]
    while (index + 1 < nodes.length && isOrdinaryMarkdownNode(nodes[index + 1])) {
      index += 1
      markdownChunk.push(nodes[index])
    }
    output.push(...renderMarkdownChunk(markdownChunk, context))
  }

  return output
}

function buildMixedMarkdownNode(node: MdxNode, context: ParseContext): ExportIrNode[] {
  const children = node.children ?? []

  if (node.type === 'paragraph' && children.length > 0 && children.every(isMdxJsxElement)) {
    return buildExportNodes(children, context)
  }

  if (node.type === 'text') {
    return [createTextNode(node.value ?? '', node.position, context)]
  }
  if (isMdxJsxElement(node)) {
    return buildMdxJsxNode(node, context)
  }
  if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') {
    return buildExportNodes([node], context)
  }

  if (node.type === 'inlineCode') {
    return [
      createElementNode(
        'code',
        {},
        [createTextNode(node.value ?? '', node.position, context)],
        node,
        context
      )
    ]
  }
  if (node.type === 'code') {
    const className = (node as MdxNode & { lang?: string }).lang
      ? [`language-${(node as MdxNode & { lang?: string }).lang}`]
      : []
    const code = createElementNode(
      'code',
      className.length > 0 ? { className } : {},
      [createTextNode(node.value ?? '', node.position, context)],
      node,
      context
    )
    return [createElementNode('pre', {}, [code], node, context)]
  }
  if (node.type === 'image' && typeof node.url === 'string') {
    const properties: Record<string, ExportJsonValue> = {
      src: node.url,
      alt: (node as MdxNode & { alt?: string }).alt ?? ''
    }
    const title = (node as MdxNode & { title?: string }).title
    if (title) properties.title = title
    inspectSubresource('img', properties, node.position, context)
    return [createElementNode('img', properties, [], node, context)]
  }

  const tagName = mdastTagName(node)
  if (!tagName) {
    return renderMarkdownChunk([node], context)
  }
  const properties: Record<string, ExportJsonValue> = {}
  if (node.type === 'link' && typeof node.url === 'string') {
    properties.href = node.url
    const title = (node as MdxNode & { title?: string }).title
    if (title) properties.title = title
  }
  if (node.type === 'list' && (node as MdxNode & { ordered?: boolean }).ordered) {
    const start = (node as MdxNode & { start?: number }).start
    if (typeof start === 'number') properties.start = start
  }

  return [
    createElementNode(tagName, properties, buildExportNodes(children, context), node, context)
  ]
}

function createElementNode(
  tagName: string,
  properties: Record<string, ExportJsonValue>,
  children: ExportIrNode[],
  source: MdxNode,
  context: ParseContext
): ExportIrElementNode {
  return {
    type: 'element',
    id: createNodeId('element', source.position, context),
    location: sourceLocation(source.position),
    tagName,
    properties,
    children
  }
}

function mdastTagName(node: MdxNode): string | null {
  switch (node.type) {
    case 'paragraph':
      return 'p'
    case 'heading':
      return `h${String((node as MdxNode & { depth?: number }).depth ?? 2)}`
    case 'emphasis':
      return 'em'
    case 'strong':
      return 'strong'
    case 'delete':
      return 'del'
    case 'blockquote':
      return 'blockquote'
    case 'list':
      return (node as MdxNode & { ordered?: boolean }).ordered ? 'ol' : 'ul'
    case 'listItem':
      return 'li'
    case 'link':
      return 'a'
    case 'table':
      return 'table'
    case 'tableRow':
      return 'tr'
    case 'tableCell':
      return 'td'
    case 'thematicBreak':
      return 'hr'
    case 'break':
      return 'br'
    default:
      return null
  }
}

function containsExportSyntax(node: MdxNode): boolean {
  return (node.children ?? []).some(
    (child) =>
      isMdxJsxElement(child) ||
      child.type === 'mdxFlowExpression' ||
      child.type === 'mdxTextExpression' ||
      child.type === 'mdxjsEsm' ||
      containsExportSyntax(child)
  )
}

function buildMdxJsxNode(node: MdxNode, context: ParseContext): ExportIrNode[] {
  const name = node.name ?? ''

  if (!name) {
    return buildExportNodes(node.children ?? [], context)
  }

  if (name === 'SandboxedHTML' || name === 'Interactive') {
    const id = createNodeId('sandbox', node.position, context)
    const props = readLiteralAttributes(name, node.attributes ?? [], node.position, context)
    const src = props.src
    const kind = name === 'SandboxedHTML' ? 'html' : 'interactive'

    if (typeof src !== 'string' || !src.trim()) {
      addDiagnostic(context, {
        code: 'SANDBOX_SRC_INVALID',
        severity: 'blocking',
        message: `${name} requires a non-empty literal string src.`,
        position: node.position,
        nodeId: id,
        componentName: name,
        propName: 'src'
      })
    }

    if ((node.children?.length ?? 0) > 0) {
      addDiagnostic(context, {
        code: 'SANDBOX_CHILDREN_UNSUPPORTED',
        severity: 'blocking',
        message: `${name} does not render children. Move this content before or after the island so export cannot silently discard it.`,
        position: node.position,
        nodeId: id,
        componentName: name
      })
    }

    delete props.src
    const safeSrc = typeof src === 'string' && src.trim() ? src : 'invalid-sandbox-src'
    const location = sourceLocation(node.position)
    context.sandboxes.push({
      nodeId: id,
      line: location?.line,
      kind,
      src: safeSrc,
      resolvedPath: safeSrc,
      manifestName: name,
      permissionStatus: 'prompt',
      fallbackAvailable: false,
      networkRequested: false,
      dataPaths: []
    })

    return [{ type: 'sandbox', id, location, kind, src: safeSrc, props }]
  }

  if (componentNameRegex.test(name)) {
    const id = createNodeId('component', node.position, context)
    const props = readLiteralAttributes(name, node.attributes ?? [], node.position, context)
    const children = buildExportNodes(node.children ?? [], context)
    const entry = registryByName.get(name)

    context.components.add(name)

    if (!entry) {
      addDiagnostic(context, {
        code: 'UNKNOWN_REGISTRY_COMPONENT',
        severity: 'blocking',
        message: `Trusted component ${name} is not registered. Register it or replace it before exporting.`,
        position: node.position,
        nodeId: id,
        componentName: name
      })
    } else {
      const propsForValidation: Record<string, unknown> = {
        ...entry.defaultProps,
        ...props
      }
      if (children.length > 0) {
        propsForValidation.children = 'export child content'
      }
      const validation = entry.propsSchema.safeParse(propsForValidation)
      if (!validation.success) {
        for (const issue of validation.error.issues) {
          addDiagnostic(context, {
            code: 'REGISTRY_PROPS_INVALID',
            severity: 'blocking',
            message: `${name}.${issue.path.join('.') || 'props'}: ${issue.message}`,
            position: node.position,
            nodeId: id,
            componentName: name,
            propName: issue.path.length > 0 ? String(issue.path[0]) : undefined
          })
        }
      }

      if (name === 'DataChart' && typeof props.src === 'string') {
        registerDatasetReference(props.src, node.position, context, name, id)
      }
    }

    return [
      {
        type: 'component',
        id,
        location: sourceLocation(node.position),
        name,
        props,
        children
      }
    ]
  }

  return buildSafeHtmlElement(node, context)
}

function buildSafeHtmlElement(node: MdxNode, context: ParseContext): ExportIrNode[] {
  const name = node.name ?? ''
  const rawProperties = readLiteralAttributes(
    name || 'HTML element',
    node.attributes ?? [],
    node.position,
    context
  )

  for (const attribute of node.attributes ?? []) {
    if (attribute.type === 'mdxJsxAttribute' && /^on/i.test(attribute.name)) {
      addDiagnostic(context, {
        code: 'UNSAFE_HTML_ATTRIBUTE',
        severity: 'blocking',
        message: `Inline event attribute ${attribute.name} is not allowed in exported HTML. Use a trusted component or sandbox.`,
        position: attribute.position ?? node.position,
        propName: attribute.name
      })
    }
  }

  const candidate: HastRoot = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: name,
        properties: rawProperties as HastElement['properties'],
        children: []
      }
    ]
  }
  const sanitized = sanitizeHastPipeline.runSync(candidate) as HastRoot
  const element = sanitized.children.find(isHastElement)

  if (!element || element.tagName !== name) {
    addDiagnostic(context, {
      code: 'UNSAFE_HTML_ELEMENT',
      severity: 'blocking',
      message: `HTML element <${name || 'unknown'}> is not in the safe export allowlist.`,
      position: node.position
    })
    return []
  }

  const properties = toJsonRecord(element.properties)
  inspectSubresource(name, properties, node.position, context)

  return [
    {
      type: 'element',
      id: createNodeId('element', node.position, context),
      location: sourceLocation(node.position),
      tagName: name,
      properties,
      children: buildExportNodes(node.children ?? [], context)
    }
  ]
}

function renderMarkdownChunk(nodes: MdxNode[], context: ParseContext): ExportIrNode[] {
  const root = { type: 'root', children: nodes } as MdastRoot
  const hast = markdownToHastPipeline.runSync(root) as HastRoot
  return hast.children.flatMap((node) => hastNodeToIr(node, context))
}

function hastNodeToIr(node: HastRootContent, context: ParseContext): ExportIrNode[] {
  if (node.type === 'text') {
    return [createTextNode(node.value, node.position as MdxPosition | undefined, context)]
  }

  if (!isHastElement(node)) {
    return []
  }

  const properties = toJsonRecord(node.properties)
  inspectSubresource(node.tagName, properties, node.position as MdxPosition | undefined, context)

  return [
    {
      type: 'element',
      id: createNodeId('element', node.position as MdxPosition | undefined, context),
      location: sourceLocation(node.position as MdxPosition | undefined),
      tagName: node.tagName,
      properties,
      children: node.children.flatMap((child) => hastNodeToIr(child, context))
    }
  ]
}

function readLiteralAttributes(
  componentName: string,
  attributes: MdxAttribute[],
  fallbackPosition: MdxPosition | undefined,
  context: ParseContext
): Record<string, ExportJsonValue> {
  const props: Record<string, ExportJsonValue> = {}

  for (const attribute of attributes) {
    if (attribute.type === 'mdxJsxExpressionAttribute') {
      addDiagnostic(context, {
        code: 'UNSUPPORTED_PROP_SPREAD',
        severity: 'blocking',
        message: `${componentName} uses a spread attribute. Write each prop as a safe literal instead.`,
        position: attribute.position ?? fallbackPosition,
        componentName
      })
      continue
    }

    if (forbiddenObjectKeys.has(attribute.name)) {
      addDiagnostic(context, {
        code: 'PROTOTYPE_KEY_REJECTED',
        severity: 'blocking',
        message: `${componentName}.${attribute.name} is not allowed because it can mutate object prototypes.`,
        position: attribute.position ?? fallbackPosition,
        componentName,
        propName: attribute.name
      })
      continue
    }

    if (typeof attribute.value === 'string') {
      props[attribute.name] = attribute.value
      continue
    }

    if (attribute.value === null || attribute.value === undefined) {
      props[attribute.name] = true
      continue
    }

    const decoded = decodeExpression(attribute.value)
    if (!decoded.ok) {
      addDiagnostic(context, {
        code: 'UNSUPPORTED_PROP_EXPRESSION',
        severity: 'blocking',
        message: `${componentName}.${attribute.name} cannot be exported safely: ${decoded.reason}. Replace it with a literal string, boolean, finite number, null, array, or plain object.`,
        position: attribute.position ?? fallbackPosition,
        componentName,
        propName: attribute.name
      })
      continue
    }

    props[attribute.name] = decoded.value
  }

  return props
}

function decodeExpression(
  expression: MdxExpression
): { ok: true; value: ExportJsonValue } | { ok: false; reason: string } {
  const program = expression.data?.estree as EstreeNode | undefined
  const statement = program?.body?.[0]

  if (
    program?.type !== 'Program' ||
    program.body?.length !== 1 ||
    statement?.type !== 'ExpressionStatement'
  ) {
    return { ok: false, reason: 'the expression is not one standalone literal' }
  }

  return decodeEstreeNode(statement.expression, 0)
}

function decodeEstreeNode(
  node: EstreeNode | undefined,
  depth: number
): { ok: true; value: ExportJsonValue } | { ok: false; reason: string } {
  if (!node) {
    return { ok: false, reason: 'the expression is empty' }
  }
  if (depth > 32) {
    return { ok: false, reason: 'the literal is nested more than 32 levels' }
  }

  if (node.type === 'Literal') {
    if (node.regex !== undefined || node.bigint !== undefined) {
      return { ok: false, reason: 'regular-expression and bigint literals are unsupported' }
    }
    if (node.value === null || typeof node.value === 'string' || typeof node.value === 'boolean') {
      return { ok: true, value: node.value }
    }
    if (typeof node.value === 'number' && Number.isFinite(node.value)) {
      return { ok: true, value: node.value }
    }
    return { ok: false, reason: 'the literal is not JSON-serializable' }
  }

  if (node.type === 'UnaryExpression' && (node.operator === '-' || node.operator === '+')) {
    const argument = decodeEstreeNode(node.argument, depth + 1)
    if (!argument.ok || typeof argument.value !== 'number') {
      return { ok: false, reason: 'unary operators are allowed only for finite numbers' }
    }
    const value = node.operator === '-' ? -argument.value : argument.value
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, reason: 'the number must be finite' }
  }

  if (node.type === 'ArrayExpression') {
    const output: ExportJsonValue[] = []
    for (const element of node.elements ?? []) {
      if (!element || element.type === 'SpreadElement') {
        return { ok: false, reason: 'array holes and spreads are unsupported' }
      }
      const decoded = decodeEstreeNode(element, depth + 1)
      if (!decoded.ok) return decoded
      output.push(decoded.value)
    }
    return { ok: true, value: output }
  }

  if (node.type === 'ObjectExpression') {
    const output: Record<string, ExportJsonValue> = {}
    for (const property of node.properties ?? []) {
      if (
        property.type !== 'Property' ||
        property.kind !== 'init' ||
        property.computed ||
        property.method ||
        property.shorthand
      ) {
        return {
          ok: false,
          reason: 'object spreads, computed keys, methods, and shorthand are unsupported'
        }
      }
      const key = readPropertyKey(property.key)
      if (!key.ok) return key
      if (forbiddenObjectKeys.has(key.value)) {
        return { ok: false, reason: `object key ${key.value} is forbidden` }
      }
      const decoded = decodeEstreeNode(property.value as EstreeNode | undefined, depth + 1)
      if (!decoded.ok) return decoded
      output[key.value] = decoded.value
    }
    return { ok: true, value: output }
  }

  if (node.type === 'TemplateLiteral') {
    if ((node.expressions?.length ?? 0) !== 0 || (node.quasis?.length ?? 0) !== 1) {
      return { ok: false, reason: 'template interpolation would require code execution' }
    }
    const cooked = node.quasis?.[0]?.value?.cooked
    return typeof cooked === 'string'
      ? { ok: true, value: cooked }
      : { ok: false, reason: 'the template literal is invalid' }
  }

  return { ok: false, reason: `${node.type ?? 'unknown syntax'} is not a safe literal form` }
}

function readPropertyKey(
  node: EstreeNode | undefined
): { ok: true; value: string } | { ok: false; reason: string } {
  if (node?.type === 'Identifier' && typeof node.value !== 'string') {
    const name = (node as EstreeNode & { name?: unknown }).name
    return typeof name === 'string'
      ? { ok: true, value: name }
      : { ok: false, reason: 'the object key is invalid' }
  }
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return { ok: true, value: node.value }
  }
  return { ok: false, reason: 'object keys must be static identifiers or strings' }
}

function collectMarkdownReferences(tree: MdastRoot, context: ParseContext): void {
  visit(tree, (candidate) => {
    const node = candidate as MdxNode
    if (node.type === 'image' && typeof node.url === 'string') {
      registerImageReference(node.url, node.position, context)
    }
    if (node.type === 'link' && typeof node.url === 'string' && node.url.startsWith('wikilink:')) {
      try {
        context.wikilinkTargets.add(decodeURIComponent(node.url.slice('wikilink:'.length)))
      } catch {
        addDiagnostic(context, {
          code: 'MALFORMED_WIKILINK',
          severity: 'warning',
          message: 'A malformed wikilink was preserved as unresolved text.',
          position: node.position
        })
      }
    }
  })
}

function inspectSubresource(
  tagName: string,
  properties: Record<string, ExportJsonValue>,
  position: MdxPosition | undefined,
  context: ParseContext
): void {
  if (tagName === 'img' && typeof properties.src === 'string') {
    registerImageReference(properties.src, position, context)
  }
}

function registerImageReference(
  source: string,
  position: MdxPosition | undefined,
  context: ParseContext
): void {
  if (source.startsWith('data:image/')) {
    return
  }
  if (isRemoteOrAbsoluteReference(source)) {
    addDiagnostic(context, {
      code: 'REMOTE_RUNTIME_ASSET',
      severity: 'blocking',
      message: `Image ${source} is not offline-safe. Copy it into the vault and use a relative path.`,
      position
    })
    return
  }
  context.imageAssets.add(source)
}

function registerDatasetReference(
  source: string,
  position: MdxPosition | undefined,
  context: ParseContext,
  componentName: string,
  nodeId: string
): void {
  if (isRemoteOrAbsoluteReference(source)) {
    addDiagnostic(context, {
      code: 'REMOTE_RUNTIME_ASSET',
      severity: 'blocking',
      message: `${componentName}.src is not offline-safe. Copy the dataset into the vault and use a relative path.`,
      position,
      nodeId,
      componentName,
      propName: 'src'
    })
    return
  }
  context.datasetAssets.add(source)
}

function addDiagnostic(
  context: ParseContext,
  input: {
    code: string
    severity: 'blocking' | 'warning'
    message: string
    position?: MdxPosition
    nodeId?: string
    componentName?: string
    propName?: string
  }
): void {
  const location = sourceLocation(input.position)
  context.diagnostics.push({
    code: input.code,
    severity: input.severity,
    message: input.message,
    line: location?.line,
    column: location?.column,
    nodeId: input.nodeId,
    componentName: input.componentName,
    propName: input.propName,
    modes: ['static', 'interactive']
  })
}

function createTextNode(
  value: string,
  position: MdxPosition | undefined,
  context: ParseContext
): ExportIrTextNode {
  return {
    type: 'text',
    id: createNodeId('text', position, context),
    location: sourceLocation(position),
    value
  }
}

function createNodeId(
  kind: string,
  position: MdxPosition | undefined,
  context: ParseContext
): string {
  const offset = position?.start?.offset ?? context.sequence
  const id = `${kind}-${offset}-${context.sequence}`
  context.sequence += 1
  return id
}

function sourceLocation(position: MdxPosition | undefined): ExportSourceLocation | undefined {
  const line = position?.start?.line
  const column = position?.start?.column
  if (typeof line !== 'number' || typeof column !== 'number') {
    return undefined
  }
  return {
    line,
    column,
    offset: position?.start?.offset
  }
}

function isMdxJsxElement(node: MdxNode): boolean {
  return node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement'
}

function isOrdinaryMarkdownNode(node: MdxNode): boolean {
  return (
    !isMdxJsxElement(node) &&
    node.type !== 'mdxFlowExpression' &&
    node.type !== 'mdxTextExpression' &&
    node.type !== 'mdxjsEsm'
  )
}

function isRenderableChildLiteral(value: ExportJsonValue): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isHastElement(node: HastRootContent): node is HastElement {
  return node.type === 'element'
}

function toJsonRecord(input: Record<string, unknown> | undefined): Record<string, ExportJsonValue> {
  const output: Record<string, ExportJsonValue> = {}
  for (const [key, value] of Object.entries(input ?? {})) {
    const parsed = jsonValueSchema.safeParse(value)
    if (parsed.success) {
      output[key] = parsed.data
    }
  }
  return output
}

function isRemoteOrAbsoluteReference(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//') || value.startsWith('/')
}

function exportSanitizeSchema(): SanitizeSchema {
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
      '*': [
        'ariaLabel',
        'ariaLabelledBy',
        'ariaDescribedBy',
        'title',
        'className',
        ['id', /^[A-Za-z][A-Za-z0-9_:.-]*$/]
      ],
      a: ['href', 'title'],
      aside: [
        ['className', 'mdx-callout'],
        ['dataCallout', ...calloutTypes]
      ],
      blockquote: ['cite'],
      code: [['className', /^language-[\w-]+$/, 'math-inline', 'math-display']],
      del: ['cite'],
      div: [['className', 'mdx-callout-title']],
      img: ['alt', 'src', 'title', 'width', 'height'],
      ol: ['start', ['type', '1', 'a', 'A', 'i', 'I']],
      th: ['align'],
      td: ['align'],
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
    clobber: [],
    clobberPrefix: 'mdx-vault-',
    protocols: {
      cite: ['http', 'https', 'mailto'],
      href: ['http', 'https', 'mailto'],
      src: ['data']
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
      'var'
    ]
  }
}

function rehypeMermaidFallback() {
  return function transform(tree: HastRoot): void {
    visit(tree, 'element', (node: HastElement) => {
      if (node.tagName !== 'pre') return
      const code = node.children.find(
        (child): child is HastElement => isHastElement(child) && child.tagName === 'code'
      )
      if (!code || !hasClassName(code, 'language-mermaid')) return

      node.tagName = 'figure'
      node.properties = { className: ['mdx-mermaid-fallback'] }
      node.children = [
        {
          type: 'element',
          tagName: 'figcaption',
          properties: {},
          children: [
            {
              type: 'text',
              value: 'Mermaid diagram fallback. Open this note in mdx-vault to render it.'
            }
          ]
        },
        { type: 'element', tagName: 'pre', properties: {}, children: [code] }
      ]
      return SKIP
    })
  }
}

function hasClassName(node: HastElement, className: string): boolean {
  const value = node.properties.className
  return Array.isArray(value)
    ? value.includes(className)
    : typeof value === 'string' && value.split(/\s+/).includes(className)
}

function resolvePluginDefault<TPlugin extends Pluggable>(plugin: TPlugin): TPlugin {
  if (typeof plugin === 'function') return plugin
  const candidate = plugin as { default?: unknown }
  return typeof candidate.default === 'function' ? (candidate.default as TPlugin) : plugin
}

export const __internalTesting = {
  decodeExpression,
  decodeEstreeNode,
  buildExportNodes
}
