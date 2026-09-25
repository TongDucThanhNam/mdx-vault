import { createHash } from 'crypto'
import matter from 'gray-matter'
import type { Link, Nodes, Root } from 'mdast'
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx'
import { extname, posix as pathPosix } from 'path'
import { visit } from 'unist-util-visit'

import type { IndexedProperty } from '../../shared/knowledge'
import {
  analyzeMdxStructure,
  type MdxStructureHeading,
  type MdxStructureSection,
  parseSourceAst
} from '../../shared/markdown-source'
import {
  formatWikilinkSubpath,
  getFilenameStem,
  normalizeLinkKey,
  parseWikilinkTarget,
  parseWikilinkUrl
} from '../../shared/wikilinks'
import { parseFrontmatterProperties, toIndexedProperties } from './frontmatter-properties'

export type NoteHeading = MdxStructureHeading
export type NoteSection = MdxStructureSection

export interface NoteWikilink {
  kind: 'wikilink' | 'markdown'
  target: string
  targetNormalized: string
  display: string
  noteTarget: string
  subpath: string | null
  sourceFrom: number
  sourceTo: number
}

export interface NoteIndex {
  relativePath: string
  title: string
  aliases: string[]
  headings: NoteHeading[]
  sections: NoteSection[]
  wikilinks: NoteWikilink[]
  tags: string[]
  components: string[]
  properties: IndexedProperty[]
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

export function buildNoteIndex({ relativePath, source, mtimeMs }: BuildNoteIndexInput): NoteIndex {
  const parsedMatter = matter(source)
  const tree = parseSourceAst(source)
  const structure = analyzeMdxStructure(source, tree)
  const headings = structure.headings
  const title = getTitle(parsedMatter.data, headings, relativePath)

  return {
    relativePath: normalizeVaultPath(relativePath),
    title,
    aliases: readStringArray(parsedMatter.data.aliases),
    headings,
    sections: structure.sections,
    wikilinks: extractWikilinks(tree, relativePath, source),
    tags: readStringArray(parsedMatter.data.tags),
    components: extractComponents(tree),
    properties: toIndexedProperties(parseFrontmatterProperties(source).properties),
    body: structure.sections
      .flatMap((section) => [section.heading?.text ?? '', section.body])
      .filter(Boolean)
      .join('\n')
      .trim(),
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

function extractWikilinks(tree: Root, sourceRelativePath: string, source: string): NoteWikilink[] {
  const wikilinks: NoteWikilink[] = []

  visit(tree, 'link', (node: Link) => {
    const wikilinkTarget = getWikilinkTarget(node)
    const markdownTarget = wikilinkTarget
      ? null
      : resolveMarkdownLinkTarget(sourceRelativePath, node.url)
    const target = wikilinkTarget ?? markdownTarget?.target

    if (!target) {
      return
    }

    const reference = parseWikilinkTarget(target)

    if (!reference) {
      return
    }

    const display = getWikilinkDataValue(node, 'display') ?? extractText(node).trim() ?? target
    const backlinkTarget = reference.noteTarget || sourceRelativePath
    const subpath = wikilinkTarget
      ? formatWikilinkSubpath(reference.subpath)
      : (markdownTarget?.subpath ?? null)
    const sourceRange = readLinkSourceRange(node, source)

    wikilinks.push({
      kind: wikilinkTarget ? 'wikilink' : 'markdown',
      target: wikilinkTarget ?? `${target}${subpath ?? ''}`,
      targetNormalized: normalizeLinkKey(backlinkTarget),
      display,
      noteTarget: backlinkTarget,
      subpath,
      sourceFrom: sourceRange.from,
      sourceTo: sourceRange.to
    })
  })

  return wikilinks
}

function resolveMarkdownLinkTarget(
  sourceRelativePath: string,
  url: string
): { target: string; subpath: string | null } | null {
  const hashIndex = url.indexOf('#')
  const rawPath = (hashIndex === -1 ? url : url.slice(0, hashIndex)).split('?', 1)[0]

  if (!rawPath || rawPath.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(rawPath)) {
    return null
  }

  let decodedPath: string

  try {
    decodedPath = decodeURIComponent(rawPath).replaceAll('\\', '/')
  } catch {
    return null
  }

  const resolvedPath = decodedPath.startsWith('/')
    ? pathPosix.normalize(decodedPath.slice(1))
    : pathPosix.normalize(pathPosix.join(pathPosix.dirname(sourceRelativePath), decodedPath))

  if (!resolvedPath || resolvedPath === '..' || resolvedPath.startsWith('../')) {
    return null
  }

  return {
    target: resolvedPath,
    subpath: hashIndex === -1 ? null : decodeFragment(url.slice(hashIndex))
  }
}

function readLinkSourceRange(node: Link, source: string): { from: number; to: number } {
  const from = node.position?.start.offset
  const to = node.position?.end.offset

  if (typeof from === 'number' && typeof to === 'number') {
    return { from, to }
  }

  const targetRange = node.data?.targetRange
  if (
    targetRange &&
    typeof targetRange === 'object' &&
    'start' in targetRange &&
    'end' in targetRange &&
    typeof targetRange.start === 'number' &&
    typeof targetRange.end === 'number'
  ) {
    const wikilinkStart = source.lastIndexOf('[[', targetRange.start)
    const wikilinkEnd = source.indexOf(']]', targetRange.end)
    if (wikilinkStart >= 0 && wikilinkEnd >= targetRange.end) {
      return { from: wikilinkStart, to: wikilinkEnd + 2 }
    }
  }

  return { from: 0, to: 0 }
}

function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
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

function normalizeVaultPath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/')
}

export function isMarkdownPath(relativePath: string): boolean {
  const extension = extname(relativePath).toLocaleLowerCase()
  return extension === '.md' || extension === '.mdx'
}

export { parseSourceAst } from '../../shared/markdown-source'
