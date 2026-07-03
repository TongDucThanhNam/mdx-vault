import { createHash } from 'crypto'
import { extname } from 'path'
import matter from 'gray-matter'
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import type { Heading, Link, Nodes, Root } from 'mdast'
import remarkFrontmatterImport from 'remark-frontmatter'
import remarkGfmImport from 'remark-gfm'
import remarkMdxImport from 'remark-mdx'
import remarkParseImport from 'remark-parse'
import { unified, type Pluggable } from 'unified'
import { visit } from 'unist-util-visit'

import { remarkWikilink } from '../../shared/remark-wikilink'
import { getFilenameStem, normalizeLinkKey, parseWikilinkUrl } from '../../shared/wikilinks'

export interface NoteHeading {
  depth: number
  text: string
  slug: string
  position: number
}

export interface NoteWikilink {
  target: string
  targetNormalized: string
  display: string
}

export interface NoteIndex {
  relativePath: string
  title: string
  aliases: string[]
  headings: NoteHeading[]
  wikilinks: NoteWikilink[]
  tags: string[]
  components: string[]
  body: string
  mtimeMs: number
  contentHash: string
}

interface BuildNoteIndexInput {
  relativePath: string
  source: string
  mtimeMs: number
}

type MdxJsxNode = MdxJsxFlowElement | MdxJsxTextElement

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

export function buildNoteIndex({ relativePath, source, mtimeMs }: BuildNoteIndexInput): NoteIndex {
  const parsedMatter = matter(source)
  const tree = parseSourceAst(source)
  const headings = extractHeadings(tree)
  const title = getTitle(parsedMatter.data, headings, relativePath)

  return {
    relativePath: normalizeVaultPath(relativePath),
    title,
    aliases: readStringArray(parsedMatter.data.aliases),
    headings,
    wikilinks: extractWikilinks(tree),
    tags: readStringArray(parsedMatter.data.tags),
    components: extractComponents(tree),
    body: extractSearchBody(tree),
    mtimeMs,
    contentHash: hashContent(source)
  }
}

export function hashContent(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

function getTitle(
  frontmatter: Record<string, unknown>,
  headings: NoteHeading[],
  relativePath: string
): string {
  if (typeof frontmatter.title === 'string' && frontmatter.title.trim()) {
    return frontmatter.title.trim()
  }

  const firstHeading = headings.find((heading) => heading.depth === 1)

  if (firstHeading) {
    return firstHeading.text
  }

  return getFilenameStem(relativePath)
}

function extractHeadings(tree: Root): NoteHeading[] {
  const headings: NoteHeading[] = []

  visit(tree, 'heading', (node: Heading) => {
    const text = extractText(node).trim()

    if (!text) {
      return
    }

    headings.push({
      depth: node.depth,
      text,
      slug: slugify(text),
      position: headings.length
    })
  })

  return headings
}

function extractWikilinks(tree: Root): NoteWikilink[] {
  const wikilinks: NoteWikilink[] = []

  visit(tree, 'link', (node: Link) => {
    const target = getWikilinkTarget(node)

    if (!target) {
      return
    }

    const display = getWikilinkDataValue(node, 'display') ?? extractText(node).trim() ?? target

    wikilinks.push({
      target,
      targetNormalized: normalizeLinkKey(target),
      display
    })
  })

  return wikilinks
}

function extractComponents(tree: Root): string[] {
  const components = new Set<string>()

  visit(tree, (node) => {
    if (!isMdxJsxNode(node) || !node.name || !isComponentName(node.name)) {
      return
    }

    components.add(node.name)
  })

  return [...components].sort((left, right) => left.localeCompare(right))
}

function extractSearchBody(tree: Root): string {
  const parts: string[] = []

  visit(tree, (node) => {
    if (node.type === 'yaml') {
      return
    }

    if ('value' in node && typeof node.value === 'string' && isSearchableValueNode(node)) {
      parts.push(node.value)
    }
  })

  return parts.join('\n').trim()
}

function extractText(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value
  }

  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => extractText(child)).join('')
  }

  return ''
}

function getWikilinkTarget(node: Link): string | null {
  const dataTarget = getWikilinkDataValue(node, 'target')

  if (dataTarget) {
    return dataTarget
  }

  return parseWikilinkUrl(node.url)
}

function getWikilinkDataValue(node: Link, key: 'target' | 'display'): string | null {
  const value = node.data?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isMdxJsxNode(node: Nodes): node is MdxJsxNode {
  return node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement'
}

function isComponentName(name: string): boolean {
  const firstCharacter = name.at(0)
  return firstCharacter !== undefined && firstCharacter === firstCharacter.toLocaleUpperCase()
}

function isSearchableValueNode(node: Nodes): boolean {
  return (
    node.type === 'text' ||
    node.type === 'inlineCode' ||
    node.type === 'code' ||
    node.type === 'html'
  )
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(isNonEmptyString).map((item) => item.trim())
  }

  if (isNonEmptyString(value)) {
    return [value.trim()]
  }

  return []
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function slugify(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

function normalizeVaultPath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/')
}

export function isMarkdownPath(relativePath: string): boolean {
  const extension = extname(relativePath).toLocaleLowerCase()
  return extension === '.md' || extension === '.mdx'
}

function parseSourceAst(source: string): Root {
  try {
    return markdownProcessor.runSync(markdownProcessor.parse(source)) as Root
  } catch {
    return markdownFallbackProcessor.runSync(markdownFallbackProcessor.parse(source)) as Root
  }
}

function resolvePluginDefault<TPlugin extends Pluggable>(plugin: TPlugin): TPlugin {
  if (typeof plugin === 'function') {
    return plugin
  }

  const maybeModule = plugin as { default?: unknown }

  return typeof maybeModule.default === 'function' ? (maybeModule.default as TPlugin) : plugin
}
