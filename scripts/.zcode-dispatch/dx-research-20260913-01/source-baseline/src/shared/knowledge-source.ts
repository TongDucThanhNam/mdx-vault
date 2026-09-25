import { createHash } from 'node:crypto'
import { posix as pathPosix } from 'node:path'
import { visit } from 'unist-util-visit'

import {
  type FootnoteEntry,
  type FootnoteModel,
  KNOWLEDGE_MAX_FOOTNOTES,
  KNOWLEDGE_MAX_MENTION_CANDIDATES,
  KNOWLEDGE_MAX_MENTIONS,
  KNOWLEDGE_MAX_OUTGOING_LINKS,
  KNOWLEDGE_MENTION_TIME_BUDGET_MS,
  KNOWLEDGE_SOURCE_MAX_BYTES,
  type MentionCandidate,
  type OutgoingLink,
  type SourceRange,
  type UnlinkedMention
} from './knowledge'
import { parseSourceAst } from './markdown-source'
import { formatWikilinkSubpath, parseWikilinkTarget, parseWikilinkUrl } from './wikilinks'

interface PositionedNode {
  type: string
  identifier?: string
  label?: string
  url?: string
  value?: string
  children?: PositionedNode[]
  data?: Record<string, unknown>
  position?: {
    start: { offset?: number }
    end: { offset?: number }
  }
}

interface MentionSearchInput {
  source: string
  activeRelativePath: string
  candidates: MentionCandidate[]
}

const PROTECTED_MENTION_PARENTS = new Set([
  'link',
  'linkReference',
  'image',
  'imageReference',
  'inlineCode',
  'code',
  'html',
  'yaml',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxJsxFlowElement',
  'mdxJsxTextElement'
])

export function extractOutgoingLinks(sourceRelativePath: string, source: string): OutgoingLink[] {
  assertBoundedSource(source)
  const links: OutgoingLink[] = []
  const tree = parseSourceAst(source)

  visit(tree, 'link', (rawNode) => {
    if (links.length >= KNOWLEDGE_MAX_OUTGOING_LINKS) {
      return
    }

    const node = rawNode as PositionedNode
    const range = readOutgoingLinkRange(source, node)

    if (!range) {
      return
    }

    const wikilinkTarget = readDataString(node, 'target') ?? parseWikilinkUrl(node.url ?? '')

    if (wikilinkTarget) {
      const parsed = parseWikilinkTarget(wikilinkTarget)

      if (!parsed) {
        return
      }

      links.push({
        kind: 'wikilink',
        target: parsed.noteTarget || normalizeVaultPath(sourceRelativePath),
        subpath: parsed.subpath ? formatWikilinkSubpath(parsed.subpath) : null,
        display: readDataString(node, 'display') ?? readText(node) ?? wikilinkTarget,
        range
      })
      return
    }

    const markdownTarget = resolveMarkdownTarget(sourceRelativePath, node.url ?? '')

    if (!markdownTarget) {
      return
    }

    links.push({
      kind: 'markdown',
      target: markdownTarget.target,
      subpath: markdownTarget.subpath,
      display: readText(node) || markdownTarget.target,
      range
    })
  })

  return links.sort((left, right) => left.range.from - right.range.from)
}

export function findUnlinkedMentions({
  source,
  activeRelativePath,
  candidates
}: MentionSearchInput): UnlinkedMention[] {
  assertBoundedSource(source)

  if (candidates.length > KNOWLEDGE_MAX_MENTION_CANDIDATES) {
    throw new Error(
      `Too many mention candidates. Narrow the vault below ${KNOWLEDGE_MAX_MENTION_CANDIDATES} notes.`
    )
  }

  const activePath = normalizeVaultPath(activeRelativePath)
  const termCandidates = new Map<string, MentionCandidate[]>()

  for (const candidate of candidates) {
    if (normalizeVaultPath(candidate.relativePath) === activePath) {
      continue
    }

    for (const term of [candidate.title, ...candidate.aliases]) {
      const normalizedTerm = term.trim().toLocaleLowerCase()

      if (!normalizedTerm) {
        continue
      }

      const matches = termCandidates.get(normalizedTerm) ?? []
      matches.push(candidate)
      termCandidates.set(normalizedTerm, matches)
    }
  }

  const terms = [...termCandidates.keys()].sort(
    (left, right) => right.length - left.length || left.localeCompare(right)
  )
  const occupiedRanges: SourceRange[] = []
  const mentions: UnlinkedMention[] = []
  const startedAt = performance.now()
  const sourceHash = hashSource(source)
  const tree = parseSourceAst(source)

  walkVisibleText(tree as PositionedNode, [], (node) => {
    if (
      mentions.length >= KNOWLEDGE_MAX_MENTIONS ||
      performance.now() - startedAt > KNOWLEDGE_MENTION_TIME_BUDGET_MS
    ) {
      return
    }

    const nodeRange = readNodeRange(node)

    if (!nodeRange || typeof node.value !== 'string') {
      return
    }

    for (const term of terms) {
      const regex = new RegExp(
        `(^|[^\\p{Letter}\\p{Number}_-])(${escapeRegExp(term)})(?=$|[^\\p{Letter}\\p{Number}_-])`,
        'giu'
      )

      for (const match of node.value.matchAll(regex)) {
        const matchedText = match[2]
        const matchIndex = (match.index ?? 0) + match[1].length
        const range = {
          from: nodeRange.from + matchIndex,
          to: nodeRange.from + matchIndex + matchedText.length
        }

        if (occupiedRanges.some((occupied) => rangesOverlap(occupied, range))) {
          continue
        }

        const matchingCandidates = uniqueCandidates(termCandidates.get(term) ?? []).sort(
          (left, right) => left.relativePath.localeCompare(right.relativePath)
        )

        if (matchingCandidates.length === 0) {
          continue
        }

        mentions.push({
          text: source.slice(range.from, range.to),
          range,
          sourceHash,
          candidates: matchingCandidates
        })
        occupiedRanges.push(range)

        if (mentions.length >= KNOWLEDGE_MAX_MENTIONS) {
          return
        }
      }
    }
  })

  return mentions.sort((left, right) => left.range.from - right.range.from)
}

export function linkUnlinkedMention(
  source: string,
  mention: UnlinkedMention,
  targetRelativePath: string,
  expectedSourceHash: string
): string {
  if (hashSource(source) !== expectedSourceHash || mention.sourceHash !== expectedSourceHash) {
    throw new Error('The note changed after mentions were discovered. Recompute before linking.')
  }

  if (source.slice(mention.range.from, mention.range.to) !== mention.text) {
    throw new Error('The mention source range is stale. Recompute before linking.')
  }

  const candidate = mention.candidates.find(
    (item) => normalizeVaultPath(item.relativePath) === normalizeVaultPath(targetRelativePath)
  )

  if (!candidate) {
    throw new Error('The selected note is not a candidate for this mention.')
  }

  const replacement = `[[${normalizeVaultPath(candidate.relativePath)}|${mention.text}]]`
  return `${source.slice(0, mention.range.from)}${replacement}${source.slice(mention.range.to)}`
}

export function extractFootnotes(source: string): FootnoteModel {
  assertBoundedSource(source)
  const tree = parseSourceAst(source) as PositionedNode
  const definitions = new Map<string, { range: SourceRange; preview: string; order: number }>()
  const references = new Map<string, SourceRange[]>()
  const protectedRanges: SourceRange[] = []
  let order = 0

  walkNodes(tree, (node) => {
    if (definitions.size + references.size >= KNOWLEDGE_MAX_FOOTNOTES) {
      return
    }

    const identifier = normalizeFootnoteIdentifier(node.identifier ?? node.label)
    const range = readNodeRange(node)

    if (range && (PROTECTED_MENTION_PARENTS.has(node.type) || node.type === 'footnoteDefinition')) {
      protectedRanges.push(range)
    }

    if (!identifier || !range) {
      return
    }

    if (node.type === 'footnoteDefinition') {
      if (!definitions.has(identifier)) {
        definitions.set(identifier, {
          range,
          preview: collapseWhitespace(readText(node)).slice(0, 180),
          order: order++
        })
      }
      return
    }

    if (node.type === 'footnoteReference') {
      const current = references.get(identifier) ?? []
      current.push(range)
      references.set(identifier, current)
    }
  })

  const referencePattern = /\[\^([^\]\s]+)\]/gu
  for (const match of source.matchAll(referencePattern)) {
    const identifier = normalizeFootnoteIdentifier(match[1])
    const from = match.index ?? -1
    const range = { from, to: from + match[0].length }

    if (
      !identifier ||
      from < 0 ||
      protectedRanges.some((protectedRange) => rangesOverlap(protectedRange, range))
    ) {
      continue
    }

    const current = references.get(identifier) ?? []
    if (!current.some((existing) => existing.from === range.from && existing.to === range.to)) {
      current.push(range)
      references.set(identifier, current)
    }
  }

  const identifiers = new Set([...definitions.keys(), ...references.keys()])
  const entries: FootnoteEntry[] = [...identifiers].map((identifier) => {
    const definition = definitions.get(identifier)
    const referenceRanges = references.get(identifier) ?? []

    return {
      identifier,
      preview: definition?.preview ?? 'Definition missing',
      status: definition
        ? referenceRanges.length > 0
          ? 'defined'
          : 'unreferenced'
        : 'missing-definition',
      definitionRange: definition?.range ?? null,
      referenceRanges,
      referenceCount: referenceRanges.length
    }
  })

  entries.sort((left, right) => {
    const leftDefinition = definitions.get(left.identifier)
    const rightDefinition = definitions.get(right.identifier)

    if (leftDefinition && rightDefinition) {
      return leftDefinition.order - rightDefinition.order
    }
    if (leftDefinition) return -1
    if (rightDefinition) return 1
    return (left.referenceRanges[0]?.from ?? 0) - (right.referenceRanges[0]?.from ?? 0)
  })

  return { entries, sourceHash: hashSource(source) }
}

function walkVisibleText(
  node: PositionedNode,
  ancestors: PositionedNode[],
  visitor: (node: PositionedNode) => void
): void {
  if (
    node.type === 'text' &&
    !ancestors.some((ancestor) => PROTECTED_MENTION_PARENTS.has(ancestor.type))
  ) {
    visitor(node)
  }

  for (const child of node.children ?? []) {
    walkVisibleText(child, [...ancestors, node], visitor)
  }
}

function walkNodes(node: PositionedNode, visitor: (node: PositionedNode) => void): void {
  visitor(node)
  for (const child of node.children ?? []) {
    walkNodes(child, visitor)
  }
}

function resolveMarkdownTarget(
  sourceRelativePath: string,
  rawUrl: string
): { target: string; subpath: string | null } | null {
  const hashIndex = rawUrl.indexOf('#')
  const rawPath = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex)
  const subpath = hashIndex === -1 ? null : decodeUrlFragment(rawUrl.slice(hashIndex))

  if (!rawPath || rawPath.startsWith('//') || /^[a-z][a-z\d+.-]*:/iu.test(rawPath)) {
    return null
  }

  try {
    const decodedPath = decodeURIComponent(rawPath).replaceAll('\\', '/')
    const resolvedPath = decodedPath.startsWith('/')
      ? pathPosix.normalize(decodedPath.slice(1))
      : pathPosix.normalize(pathPosix.join(pathPosix.dirname(sourceRelativePath), decodedPath))

    if (!resolvedPath || resolvedPath === '..' || resolvedPath.startsWith('../')) {
      return null
    }

    return { target: resolvedPath, subpath }
  } catch {
    return null
  }
}

function decodeUrlFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
}

function readDataString(node: PositionedNode, key: string): string | null {
  const value = node.data?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readNodeRange(node: PositionedNode): SourceRange | null {
  const from = node.position?.start.offset
  const to = node.position?.end.offset

  return typeof from === 'number' && typeof to === 'number' && to >= from ? { from, to } : null
}

function readOutgoingLinkRange(source: string, node: PositionedNode): SourceRange | null {
  const positionedRange = readNodeRange(node)
  if (positionedRange) return positionedRange

  const targetRange = node.data?.targetRange
  if (
    !targetRange ||
    typeof targetRange !== 'object' ||
    !('start' in targetRange) ||
    !('end' in targetRange) ||
    typeof targetRange.start !== 'number' ||
    typeof targetRange.end !== 'number'
  ) {
    return null
  }

  const from = source.lastIndexOf('[[', targetRange.start)
  const closingIndex = source.indexOf(']]', targetRange.end)
  return from >= 0 && closingIndex >= targetRange.end ? { from, to: closingIndex + 2 } : null
}

function readText(node: PositionedNode): string {
  if (typeof node.value === 'string') {
    return node.value
  }

  return (node.children ?? []).map(readText).join('')
}

function normalizeFootnoteIdentifier(value: string | undefined): string | null {
  const normalized = value?.trim().toLocaleLowerCase()
  return normalized ? normalized : null
}

function uniqueCandidates(candidates: MentionCandidate[]): MentionCandidate[] {
  const byPath = new Map<string, MentionCandidate>()
  for (const candidate of candidates) {
    byPath.set(normalizeVaultPath(candidate.relativePath), candidate)
  }
  return [...byPath.values()]
}

function rangesOverlap(left: SourceRange, right: SourceRange): boolean {
  return left.from < right.to && right.from < left.to
}

function assertBoundedSource(source: string): void {
  if (Buffer.byteLength(source, 'utf8') > KNOWLEDGE_SOURCE_MAX_BYTES) {
    throw new Error(
      `Note is too large for knowledge utilities. The limit is ${KNOWLEDGE_SOURCE_MAX_BYTES} bytes.`
    )
  }
}

function normalizeVaultPath(value: string): string {
  return value.replaceAll('\\', '/')
}

function hashSource(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}
