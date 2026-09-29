import type { Nodes, Root } from 'mdast'
import remarkFrontmatterImport from 'remark-frontmatter'
import remarkGfmImport from 'remark-gfm'
import remarkMdxImport from 'remark-mdx'
import remarkParseImport from 'remark-parse'
import { type Pluggable, unified } from 'unified'
import { visit } from 'unist-util-visit'

import { createUniqueHeadingId } from './heading-identity'
import { remarkWikilink } from './remark-wikilink'

export const MAX_MDX_STRUCTURE_HEADINGS = 2_000
export const MAX_MDX_SECTION_TEXT_LENGTH = 100_000

export interface MdxStructureHeading {
  id: string
  depth: number
  text: string
  /** Normalized heading key used by wikilink resolution. */
  slug: string
  /** Zero-based heading ordinal in source order. */
  position: number
  /** UTF-16 source offsets covering the heading syntax and content. */
  sourceFrom: number
  sourceTo: number
}

export interface MdxStructureSection {
  /** Zero-based section ordinal; the optional preamble is position zero. */
  position: number
  heading: MdxStructureHeading | null
  sourceFrom: number
  sourceTo: number
  body: string
}

export interface MdxStructureAnalysis {
  headings: MdxStructureHeading[]
  sections: MdxStructureSection[]
}

const remarkParse = resolvePluginDefault(remarkParseImport)
const remarkMdx = resolvePluginDefault(remarkMdxImport)
const remarkGfm = resolvePluginDefault(remarkGfmImport)
const remarkFrontmatter = resolvePluginDefault(remarkFrontmatterImport)

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkWikilink)

const markdownFallbackProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkWikilink)

export function parseSourceAst(source: string): Root {
  try {
    return markdownProcessor.runSync(markdownProcessor.parse(source)) as Root
  } catch {
    return markdownFallbackProcessor.runSync(markdownFallbackProcessor.parse(source)) as Root
  }
}

/**
 * Parse MDX as inert syntax and project document structure without compiling,
 * importing or evaluating any expression or component.
 */
export function analyzeMdxStructure(
  source: string,
  parsedTree: Root = parseSourceAst(source)
): MdxStructureAnalysis {
  const headings: MdxStructureHeading[] = []
  const occurrences = new Map<string, number>()

  visit(parsedTree, (node) => {
    if (headings.length >= MAX_MDX_STRUCTURE_HEADINGS) return
    const depth = node.type === 'heading' ? node.depth : jsxHeadingDepth(node)
    if (depth === null) return

    const text = readStaticHeadingText(node).trim()
    if (!text) return

    const identity = createUniqueHeadingId(text, occurrences)
    const authorId =
      node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement'
        ? staticHeadingId(node)
        : null
    const sourceFrom = clampSourceOffset(node.position?.start.offset, source.length, 0)
    const sourceTo = clampSourceOffset(node.position?.end.offset, source.length, sourceFrom)

    headings.push({
      ...identity,
      id: authorId ?? identity.id,
      depth,
      text,
      position: headings.length,
      sourceFrom,
      sourceTo
    })
  })

  const sections = createSections(source, parsedTree, headings)
  return { headings, sections }
}

function createSections(
  source: string,
  tree: Root,
  headings: MdxStructureHeading[]
): MdxStructureSection[] {
  const sections: MdxStructureSection[] = [
    {
      position: 0,
      heading: null,
      sourceFrom: 0,
      sourceTo: headings[0]?.sourceFrom ?? source.length,
      body: ''
    },
    ...headings.map((heading, index) => ({
      position: index + 1,
      heading,
      sourceFrom: heading.sourceFrom,
      sourceTo: headings[index + 1]?.sourceFrom ?? source.length,
      body: ''
    }))
  ]
  const bodyParts = sections.map(() => [] as string[])
  let sectionIndex = 0

  visit(tree, (node, _index, parent) => {
    if (!isSearchableValueNode(node) || parent?.type === 'heading') return

    const nodeOffset = clampSourceOffset(node.position?.start.offset, source.length, 0)
    while (
      sectionIndex + 1 < sections.length &&
      nodeOffset >= sections[sectionIndex + 1].sourceFrom
    ) {
      sectionIndex += 1
    }

    const activeHeading = sections[sectionIndex].heading
    if (activeHeading && nodeOffset < activeHeading.sourceTo) return

    bodyParts[sectionIndex].push(node.value)
  })

  return sections
    .map((section, index) => ({
      ...section,
      body: bodyParts[index].join('\n').trim().slice(0, MAX_MDX_SECTION_TEXT_LENGTH)
    }))
    .filter((section) => section.heading !== null || section.body.length > 0)
    .map((section, position) => ({ ...section, position }))
}

function jsxHeadingDepth(node: Nodes): number | null {
  if (
    (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') ||
    !/^h[1-6]$/.test(node.name ?? '')
  )
    return null
  return Number(node.name?.slice(1))
}

/** Expressions and component output are never used to derive navigation identity. */
function readStaticHeadingText(node: Nodes): string {
  if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') return ''
  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    if (!node.name || !/^[a-z][a-z\d-]*$/.test(node.name)) return ''
  }
  if ('value' in node && typeof node.value === 'string') return node.value
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => readStaticHeadingText(child)).join('')
  }
  return ''
}

function staticHeadingId(
  node: Extract<Nodes, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>
): string | null {
  const attribute = node.attributes.find(
    (candidate) => candidate.type === 'mdxJsxAttribute' && candidate.name === 'id'
  )
  if (!attribute || attribute.type !== 'mdxJsxAttribute') return null
  const value = attribute.value
  // The sanitizer's clobber prefix remains mandatory for user-authored IDs.
  return typeof value === 'string' && /^[^\p{Cc}\s]{1,96}$/u.test(value)
    ? `user-content-${value}`
    : null
}

function isSearchableValueNode(node: Nodes): node is Nodes & { value: string } {
  return (
    'value' in node &&
    typeof node.value === 'string' &&
    (node.type === 'text' ||
      node.type === 'inlineCode' ||
      node.type === 'code' ||
      node.type === 'html')
  )
}

function clampSourceOffset(
  value: number | undefined,
  sourceLength: number,
  fallback: number
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(0, value), sourceLength)
}

function resolvePluginDefault<TPlugin extends Pluggable>(plugin: TPlugin): TPlugin {
  if (typeof plugin === 'function') {
    return plugin
  }

  const maybeModule = plugin as { default?: unknown }

  return typeof maybeModule.default === 'function' ? (maybeModule.default as TPlugin) : plugin
}
