import type { Link } from 'mdast'
import { posix as pathPosix } from 'path'
import { visit } from 'unist-util-visit'

import {
  getFilenameStem,
  normalizeLinkKey,
  resolveWikilinkTarget,
  stripNoteExtension,
  type WikilinkNoteCandidate
} from '../../shared/wikilinks'
import { parseSourceAst } from './index-service'

export interface RenamePlanSource {
  relativePath: string
  content: string
}

export interface RenameEdit {
  start: number
  end: number
  oldTarget: string
  newTarget: string
  kind: 'wikilink' | 'markdown'
}

export interface RenamePlanFile {
  relativePath: string
  edits: RenameEdit[]
}

export interface RenamePlan {
  oldRelativePath: string
  newRelativePath: string
  files: RenamePlanFile[]
  linkCount: number
  noteCount: number
}

export interface BuildRenamePlanInput {
  oldRelativePath: string
  newRelativePath: string
  notes: WikilinkNoteCandidate[]
  sources: RenamePlanSource[]
}

export function buildRenamePlan({
  oldRelativePath,
  newRelativePath,
  notes,
  sources
}: BuildRenamePlanInput): RenamePlan {
  const normalizedOldPath = normalizeVaultPath(oldRelativePath)
  const normalizedNewPath = normalizeVaultPath(newRelativePath)
  const files: RenamePlanFile[] = []
  let linkCount = 0

  for (const source of sources) {
    const edits = collectRenameEdits({
      source: {
        relativePath: normalizeVaultPath(source.relativePath),
        content: source.content
      },
      oldRelativePath: normalizedOldPath,
      newRelativePath: normalizedNewPath,
      notes
    })

    if (edits.length === 0) {
      continue
    }

    files.push({
      relativePath: normalizeVaultPath(source.relativePath),
      edits
    })
    linkCount += edits.length
  }

  return {
    oldRelativePath: normalizedOldPath,
    newRelativePath: normalizedNewPath,
    files,
    linkCount,
    noteCount: files.length
  }
}

export function applyRenameEdits(content: string, edits: RenameEdit[]): string {
  const orderedEdits = [...edits].sort((left, right) => right.start - left.start)
  let rewritten = content
  let previousStart = content.length

  for (const edit of orderedEdits) {
    if (edit.start < 0 || edit.end < edit.start || edit.end > content.length) {
      throw new Error('Rename edit is outside the source content')
    }

    if (edit.end > previousStart) {
      throw new Error('Rename edits overlap')
    }

    if (content.slice(edit.start, edit.end) !== edit.oldTarget) {
      throw new Error('Rename source changed after the plan was created')
    }

    rewritten = `${rewritten.slice(0, edit.start)}${edit.newTarget}${rewritten.slice(edit.end)}`
    previousStart = edit.start
  }

  return rewritten
}

function collectRenameEdits({
  source,
  oldRelativePath,
  newRelativePath,
  notes
}: {
  source: RenamePlanSource
  oldRelativePath: string
  newRelativePath: string
  notes: WikilinkNoteCandidate[]
}): RenameEdit[] {
  const tree = parseSourceAst(source.content)
  const edits: RenameEdit[] = []

  visit(tree, 'link', (node: Link) => {
    const edit = node.data?.wikilink
      ? planWikilinkEdit(node, notes, oldRelativePath, newRelativePath)
      : planMarkdownLinkEdit(node, source, notes, oldRelativePath, newRelativePath)

    if (edit) {
      edits.push(edit)
    }
  })

  return edits.sort((left, right) => left.start - right.start)
}

function planWikilinkEdit(
  node: Link,
  notes: WikilinkNoteCandidate[],
  oldRelativePath: string,
  newRelativePath: string
): RenameEdit | null {
  const target = typeof node.data?.target === 'string' ? node.data.target : null
  const range = node.data?.targetRange

  if (!target || !range || !resolvesToRenamedNote(notes, target, oldRelativePath)) {
    return null
  }

  const newTarget = rewriteWikilinkTarget(target, newRelativePath)

  if (newTarget === target) {
    return null
  }

  return {
    start: range.start,
    end: range.end,
    oldTarget: target,
    newTarget,
    kind: 'wikilink'
  }
}

function planMarkdownLinkEdit(
  node: Link,
  source: RenamePlanSource,
  notes: WikilinkNoteCandidate[],
  oldRelativePath: string,
  newRelativePath: string
): RenameEdit | null {
  const range = findMarkdownDestinationRange(source.content, node)

  if (!range) {
    return null
  }

  const rawDestination = source.content.slice(range.start, range.end)
  const destination = splitDestination(rawDestination)
  const decodedPath = decodeLinkPath(destination.path)

  if (!decodedPath || isExternalLinkPath(decodedPath)) {
    return null
  }

  const resolvedPath = resolveMarkdownPath(source.relativePath, decodedPath)

  if (!resolvedPath || !resolvesToRenamedNote(notes, resolvedPath, oldRelativePath)) {
    return null
  }

  const sourcePathAfterRename = sameVaultPath(source.relativePath, oldRelativePath)
    ? newRelativePath
    : source.relativePath
  const rewrittenPath = buildMarkdownPath(decodedPath, sourcePathAfterRename, newRelativePath)
  const encodedPath = isPercentEncoded(destination.path)
    ? encodeLinkPath(rewrittenPath)
    : rewrittenPath
  const newTarget = `${encodedPath}${destination.suffix}`

  if (newTarget === rawDestination) {
    return null
  }

  return {
    start: range.start,
    end: range.end,
    oldTarget: rawDestination,
    newTarget,
    kind: 'markdown'
  }
}

function resolvesToRenamedNote(
  notes: WikilinkNoteCandidate[],
  target: string,
  oldRelativePath: string
): boolean {
  const resolved = resolveWikilinkTarget(notes, target)
  return resolved !== null && sameVaultPath(resolved.relativePath, oldRelativePath)
}

function rewriteWikilinkTarget(target: string, newRelativePath: string): string {
  const hasPath = target.includes('/') || target.includes('\\')
  const hasExtension = /\.(mdx|md)$/i.test(target)
  let rewritten: string

  if (hasPath) {
    rewritten = hasExtension ? newRelativePath : stripNoteExtension(newRelativePath)
  } else {
    rewritten = hasExtension
      ? pathPosix.basename(newRelativePath)
      : getFilenameStem(newRelativePath)
  }

  return target.includes('\\') && !target.includes('/')
    ? rewritten.replaceAll('/', '\\')
    : rewritten
}

function findMarkdownDestinationRange(
  content: string,
  node: Link
): { start: number; end: number } | null {
  const nodeStart = node.position?.start.offset
  const nodeEnd = node.position?.end.offset

  if (nodeStart === undefined || nodeEnd === undefined) {
    return null
  }

  let cursor = nodeStart
  let bracketDepth = 0
  let labelClosed = false

  for (; cursor < nodeEnd; cursor += 1) {
    const character = content[cursor]

    if (character === '\\') {
      cursor += 1
      continue
    }

    if (character === '[') {
      bracketDepth += 1
    } else if (character === ']') {
      bracketDepth -= 1

      if (bracketDepth === 0) {
        labelClosed = true
        cursor += 1
        break
      }
    }
  }

  if (!labelClosed) {
    return null
  }

  while (cursor < nodeEnd && /\s/.test(content[cursor])) {
    cursor += 1
  }

  if (content[cursor] !== '(') {
    return null
  }

  cursor += 1

  while (cursor < nodeEnd && /\s/.test(content[cursor])) {
    cursor += 1
  }

  if (content[cursor] === '<') {
    const start = cursor + 1
    cursor = start

    while (cursor < nodeEnd && content[cursor] !== '>') {
      if (content[cursor] === '\\') {
        cursor += 1
      }
      cursor += 1
    }

    return cursor < nodeEnd ? { start, end: cursor } : null
  }

  const start = cursor
  let parenthesisDepth = 0

  while (cursor < nodeEnd) {
    const character = content[cursor]

    if (character === '\\') {
      cursor += 2
      continue
    }

    if (character === '(') {
      parenthesisDepth += 1
    } else if (character === ')') {
      if (parenthesisDepth === 0) {
        break
      }
      parenthesisDepth -= 1
    } else if (/\s/.test(character) && parenthesisDepth === 0) {
      break
    }

    cursor += 1
  }

  return cursor > start ? { start, end: cursor } : null
}

function splitDestination(destination: string): { path: string; suffix: string } {
  for (let index = 0; index < destination.length; index += 1) {
    if (destination[index] === '\\') {
      index += 1
      continue
    }

    if (destination[index] === '#' || destination[index] === '?') {
      return {
        path: destination.slice(0, index),
        suffix: destination.slice(index)
      }
    }
  }

  return { path: destination, suffix: '' }
}

function decodeLinkPath(path: string): string | null {
  try {
    return decodeURIComponent(path.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g, '$1'))
  } catch {
    return null
  }
}

function isExternalLinkPath(path: string): boolean {
  return path.startsWith('#') || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)
}

function resolveMarkdownPath(sourceRelativePath: string, targetPath: string): string | null {
  const normalizedTarget = targetPath.replaceAll('\\', '/')
  const resolved = normalizedTarget.startsWith('/')
    ? pathPosix.normalize(normalizedTarget.slice(1))
    : pathPosix.normalize(pathPosix.join(pathPosix.dirname(sourceRelativePath), normalizedTarget))

  if (!resolved || resolved === '..' || resolved.startsWith('../')) {
    return null
  }

  return resolved
}

function buildMarkdownPath(
  oldDecodedPath: string,
  sourceRelativePath: string,
  newRelativePath: string
): string {
  const hadExtension = /\.(mdx|md)$/i.test(oldDecodedPath)
  const destinationPath = hadExtension ? newRelativePath : stripNoteExtension(newRelativePath)

  if (oldDecodedPath.replaceAll('\\', '/').startsWith('/')) {
    return `/${destinationPath}`
  }

  const relativePath = pathPosix.relative(pathPosix.dirname(sourceRelativePath), destinationPath)
  return oldDecodedPath.startsWith('./') && !relativePath.startsWith('.')
    ? `./${relativePath}`
    : relativePath
}

function isPercentEncoded(path: string): boolean {
  return /%[\da-f]{2}/i.test(path)
}

function encodeLinkPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function sameVaultPath(left: string, right: string): boolean {
  return normalizeLinkKey(normalizeVaultPath(left)) === normalizeLinkKey(normalizeVaultPath(right))
}

function normalizeVaultPath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/')
}
