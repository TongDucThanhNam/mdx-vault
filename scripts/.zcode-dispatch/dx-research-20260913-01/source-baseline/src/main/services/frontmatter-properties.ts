import { createHash } from 'node:crypto'
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  type Pair,
  type ParsedNode,
  parseDocument,
  stringify
} from 'yaml'

import {
  type FileProperty,
  type IndexedProperty,
  type IndexedPropertyType,
  KNOWLEDGE_SOURCE_MAX_BYTES,
  type SourceRange
} from '../../shared/knowledge'

interface FrontmatterEnvelope {
  contentStart: number
  contentEnd: number
  closingStart: number
  lineEnding: '\n' | '\r\n'
  yaml: string
}

export interface ParsedFrontmatterProperties {
  properties: FileProperty[]
  lineEnding: '\n' | '\r\n'
  hasFrontmatter: boolean
  parseError: string | null
}

export type PropertyMutation =
  | {
      kind: 'add'
      name: string
      value: PropertyValue
      expectedSourceHash: string
    }
  | {
      kind: 'set'
      name: string
      value: PropertyValue
      expectedSourceHash: string
    }
  | {
      kind: 'delete'
      name: string
      expectedSourceHash: string
    }

export type PropertyValue = string | number | boolean | null | Array<string | number | boolean>

export interface PropertyMutationResult {
  source: string
  contentHash: string
  edits: Array<{ range: SourceRange; replacement: string }>
}

export function parseFrontmatterProperties(source: string): ParsedFrontmatterProperties {
  assertBoundedSource(source)
  const envelope = findFrontmatterEnvelope(source)
  const lineEnding = detectLineEnding(source)

  if (!envelope) {
    return { properties: [], lineEnding, hasFrontmatter: false, parseError: null }
  }

  const document = parseDocument(envelope.yaml, {
    keepSourceTokens: true,
    prettyErrors: false,
    strict: true,
    uniqueKeys: true
  })

  if (document.errors.length > 0) {
    return {
      properties: [],
      lineEnding: envelope.lineEnding,
      hasFrontmatter: true,
      parseError: document.errors[0]?.message ?? 'Frontmatter could not be parsed.'
    }
  }

  if (!isMap(document.contents)) {
    return {
      properties: [],
      lineEnding: envelope.lineEnding,
      hasFrontmatter: true,
      parseError: 'Top-level frontmatter must be a YAML mapping.'
    }
  }

  const flowMapping = document.contents.flow === true
  const properties: FileProperty[] = []

  for (const pair of document.contents.items) {
    const property = readProperty(pair, envelope, flowMapping)
    if (property) {
      properties.push(property)
    }
  }

  return {
    properties,
    lineEnding: envelope.lineEnding,
    hasFrontmatter: true,
    parseError: null
  }
}

export function toIndexedProperties(properties: FileProperty[]): IndexedProperty[] {
  return properties.map(
    ({ keyRange: _keyRange, valueRange: _valueRange, rawValue: _raw, ...rest }) => rest
  )
}

export function applyPropertyMutation(
  source: string,
  mutation: PropertyMutation
): PropertyMutationResult {
  if (hashSource(source) !== mutation.expectedSourceHash) {
    throw new Error('The note changed before the property edit could be applied.')
  }

  validatePropertyName(mutation.name)
  const parsed = parseFrontmatterProperties(source)

  if (parsed.parseError) {
    throw new Error(parsed.parseError)
  }

  const normalizedName = normalizePropertyName(mutation.name)
  const existing = parsed.properties.find((property) => property.normalizedName === normalizedName)

  if (mutation.kind === 'add') {
    if (existing) {
      throw new Error(`Property "${mutation.name}" already exists.`)
    }
    return addProperty(source, mutation.name.trim(), mutation.value)
  }

  if (!existing) {
    throw new Error(`Property "${mutation.name}" does not exist.`)
  }

  if (!existing.editable) {
    throw new Error(existing.unsupportedReason ?? 'This property is read-only and unsupported.')
  }

  if (mutation.kind === 'delete') {
    const envelope = requireFrontmatterEnvelope(source)
    const range = findPropertyDeletionRange(source, existing, parsed.properties, envelope)
    return applyEdits(source, [{ range, replacement: '' }])
  }

  const range = existing.valueRange
  if (!range) {
    const insertionRange = { from: existing.keyRange.to, to: existing.keyRange.to }
    return applyEdits(source, [
      {
        range: insertionRange,
        replacement: `: ${serializePropertyValueForPair(mutation.value, parsed.lineEnding)}`
      }
    ])
  }

  const serialized = serializePropertyValue(mutation.value, existing.rawValue, parsed.lineEnding)
  const indent = source.slice(source.lastIndexOf('\n', range.from - 1) + 1, range.from)
  const replacement = Array.isArray(mutation.value)
    ? `${serialized.replaceAll(
        parsed.lineEnding,
        `${parsed.lineEnding}${indent}`
      )}${existing.rawValue.endsWith(parsed.lineEnding) ? parsed.lineEnding : ''}`
    : `${range.from === range.to ? ' ' : ''}${serialized}`
  return applyEdits(source, [{ range, replacement }])
}

export function renamePropertyKey(
  source: string,
  oldName: string,
  newName: string
): PropertyMutationResult {
  validatePropertyName(newName)
  const parsed = parseFrontmatterProperties(source)

  if (parsed.parseError) {
    throw new Error(parsed.parseError)
  }

  const oldNormalized = normalizePropertyName(oldName)
  const newNormalized = normalizePropertyName(newName)
  const property = parsed.properties.find((item) => item.normalizedName === oldNormalized)

  if (!property) {
    throw new Error(`Property "${oldName}" does not exist.`)
  }

  if (
    parsed.properties.some(
      (item) => item.normalizedName === newNormalized && item.normalizedName !== oldNormalized
    )
  ) {
    throw new Error(`Property "${newName}" already exists in this note.`)
  }

  const originalKey = source.slice(property.keyRange.from, property.keyRange.to)
  const replacement = serializeKeyLike(originalKey, newName.trim())
  return applyEdits(source, [{ range: property.keyRange, replacement }])
}

function readProperty(
  pair: Pair,
  envelope: FrontmatterEnvelope,
  flowMapping: boolean
): FileProperty | null {
  if (!isScalar(pair.key) || typeof pair.key.value !== 'string' || !pair.key.range) {
    return null
  }

  const name = pair.key.value.trim()
  if (!name) return null
  const keyRange = offsetRange(pair.key.range, envelope.contentStart)
  const valueNode = pair.value as ParsedNode | null
  const valueRange = valueNode?.range
    ? offsetRange([valueNode.range[0], valueNode.range[1]], envelope.contentStart)
    : null
  const rawValue = valueRange ? envelopeSourceSlice(envelope, valueRange) : ''

  if (flowMapping) {
    return unsupportedProperty(
      name,
      keyRange,
      valueRange,
      rawValue,
      'JSON-style or flow-map frontmatter is readable but must be edited in Source view.'
    )
  }

  const classification = classifyValue(name, valueNode)
  return {
    name,
    normalizedName: normalizePropertyName(name),
    type: classification.type,
    values: classification.values,
    empty: classification.empty,
    editable: classification.editable,
    unsupportedReason: classification.unsupportedReason,
    keyRange,
    valueRange,
    rawValue
  }
}

function classifyValue(
  name: string,
  node: ParsedNode | null
): Pick<FileProperty, 'type' | 'values' | 'empty' | 'editable' | 'unsupportedReason'> {
  if (node === null) {
    return editableClassification('text', [], true)
  }

  if (isAlias(node) || hasAnchorOrCustomTag(node)) {
    return readOnlyClassification('YAML aliases, anchors, and custom tags are read-only.')
  }

  if (isMap(node)) {
    return readOnlyClassification('Nested YAML properties are read-only; use Source view.')
  }

  if (isSeq(node)) {
    if (
      node.items.some((item) => item !== null && (!isScalar(item) || hasAnchorOrCustomTag(item)))
    ) {
      return readOnlyClassification('Lists containing nested or tagged YAML values are read-only.')
    }

    const values = node.items.map((item) =>
      item !== null && isScalar(item) ? scalarToString(item.value) : ''
    )
    return editableClassification(
      normalizePropertyName(name) === 'tags' ? 'tags' : 'list',
      values,
      false
    )
  }

  if (!isScalar(node)) {
    return readOnlyClassification('This YAML property type is unsupported.')
  }

  if (node.value === null) {
    return editableClassification('text', [], true)
  }
  if (typeof node.value === 'boolean') {
    return editableClassification('checkbox', [String(node.value)], false)
  }
  if (typeof node.value === 'number') {
    return editableClassification('number', [String(node.value)], false)
  }

  const value = scalarToString(node.value)
  const rawSource = typeof node.source === 'string' ? node.source : value
  const type: IndexedPropertyType = isDateTime(rawSource)
    ? 'date-time'
    : isDate(rawSource)
      ? 'date'
      : 'text'
  return editableClassification(type, [value], value.length === 0)
}

function editableClassification(
  type: IndexedPropertyType,
  values: string[],
  empty: boolean
): Pick<FileProperty, 'type' | 'values' | 'empty' | 'editable' | 'unsupportedReason'> {
  return { type, values, empty, editable: true, unsupportedReason: null }
}

function readOnlyClassification(
  unsupportedReason: string
): Pick<FileProperty, 'type' | 'values' | 'empty' | 'editable' | 'unsupportedReason'> {
  return {
    type: 'unsupported',
    values: [],
    empty: false,
    editable: false,
    unsupportedReason
  }
}

function unsupportedProperty(
  name: string,
  keyRange: SourceRange,
  valueRange: SourceRange | null,
  rawValue: string,
  unsupportedReason: string
): FileProperty {
  return {
    name,
    normalizedName: normalizePropertyName(name),
    type: 'unsupported',
    values: [],
    empty: false,
    editable: false,
    unsupportedReason,
    keyRange,
    valueRange,
    rawValue
  }
}

function addProperty(source: string, name: string, value: PropertyValue): PropertyMutationResult {
  const envelope = findFrontmatterEnvelope(source)
  const lineEnding = detectLineEnding(source)
  const serializedValue = serializePropertyValueForPair(value, lineEnding)
  const separator = Array.isArray(value) ? '' : ' '

  if (!envelope) {
    const prefix = `---${lineEnding}${name}:${separator}${serializedValue}${lineEnding}---${lineEnding}`
    return applyEdits(source, [{ range: { from: 0, to: 0 }, replacement: prefix }])
  }

  const needsLeadingLineEnding =
    envelope.contentEnd > envelope.contentStart &&
    !source.slice(envelope.contentStart, envelope.contentEnd).endsWith(envelope.lineEnding)
  const replacement = `${needsLeadingLineEnding ? envelope.lineEnding : ''}${name}:${separator}${serializedValue}${envelope.lineEnding}`
  return applyEdits(source, [
    { range: { from: envelope.closingStart, to: envelope.closingStart }, replacement }
  ])
}

function findPropertyDeletionRange(
  source: string,
  property: FileProperty,
  properties: FileProperty[],
  envelope: FrontmatterEnvelope
): SourceRange {
  const lineStart = source.lastIndexOf('\n', Math.max(0, property.keyRange.from - 1)) + 1
  const nextProperty = properties
    .filter((candidate) => candidate.keyRange.from > property.keyRange.from)
    .sort((left, right) => left.keyRange.from - right.keyRange.from)[0]

  if (nextProperty) {
    return {
      from: lineStart,
      to: source.lastIndexOf('\n', Math.max(0, nextProperty.keyRange.from - 1)) + 1
    }
  }

  return { from: lineStart, to: envelope.closingStart }
}

function applyEdits(
  source: string,
  edits: Array<{ range: SourceRange; replacement: string }>
): PropertyMutationResult {
  const ordered = [...edits].sort((left, right) => right.range.from - left.range.from)
  let nextSource = source

  for (const edit of ordered) {
    nextSource = `${nextSource.slice(0, edit.range.from)}${edit.replacement}${nextSource.slice(
      edit.range.to
    )}`
  }

  return { source: nextSource, contentHash: hashSource(nextSource), edits }
}

function serializePropertyValue(
  value: PropertyValue,
  originalRaw?: string,
  lineEnding: '\n' | '\r\n' = '\n'
): string {
  if (typeof value === 'string') {
    if (originalRaw?.startsWith("'")) {
      return `'${value.replaceAll("'", "''")}'`
    }
    if (originalRaw?.startsWith('"')) {
      return JSON.stringify(value)
    }
  }

  const serialized = stringify(value, { lineWidth: 0 }).trimEnd()
  return serialized.replaceAll('\n', lineEnding)
}

function serializePropertyValueForPair(value: PropertyValue, lineEnding: '\n' | '\r\n'): string {
  const serialized = serializePropertyValue(value, undefined, lineEnding)
  if (!Array.isArray(value)) {
    return serialized
  }
  return `${lineEnding}${serialized
    .split(lineEnding)
    .map((line) => `  ${line}`)
    .join(lineEnding)}`
}

function serializeKeyLike(originalKey: string, nextName: string): string {
  if (originalKey.startsWith("'")) {
    return `'${nextName.replaceAll("'", "''")}'`
  }
  if (originalKey.startsWith('"')) {
    return JSON.stringify(nextName)
  }
  return nextName
}

function findFrontmatterEnvelope(source: string): FrontmatterEnvelope | null {
  const opening = /^(?:\uFEFF)?---[ \t]*(\r?\n)/u.exec(source)
  if (!opening) return null
  const lineEnding = opening[1] as '\n' | '\r\n'
  const contentStart = opening[0].length
  const closingPattern = /^---[ \t]*(?:\r?\n|$)/gmu
  closingPattern.lastIndex = contentStart
  const closing = closingPattern.exec(source)

  if (!closing) return null

  return {
    contentStart,
    contentEnd: closing.index,
    closingStart: closing.index,
    lineEnding,
    yaml: source.slice(contentStart, closing.index)
  }
}

function requireFrontmatterEnvelope(source: string): FrontmatterEnvelope {
  const envelope = findFrontmatterEnvelope(source)
  if (!envelope) throw new Error('The note has no editable YAML frontmatter.')
  return envelope
}

function offsetRange(range: readonly number[], offset: number): SourceRange {
  return { from: offset + range[0], to: offset + range[1] }
}

function envelopeSourceSlice(envelope: FrontmatterEnvelope, absoluteRange: SourceRange): string {
  const from = absoluteRange.from - envelope.contentStart
  const to = absoluteRange.to - envelope.contentStart
  return envelope.yaml.slice(from, to)
}

function detectLineEnding(source: string): '\n' | '\r\n' {
  return source.includes('\r\n') ? '\r\n' : '\n'
}

function validatePropertyName(value: string): void {
  const trimmed = value.trim()
  if (!/^[\p{Letter}_][\p{Letter}\p{Number}_.-]*$/u.test(trimmed)) {
    throw new Error(
      'Property names must begin with a letter or underscore and use letters, numbers, dot, dash, or underscore.'
    )
  }
}

function normalizePropertyName(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function scalarToString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return value === null || value === undefined ? '' : String(value)
}

function hasAnchorOrCustomTag(node: ParsedNode): boolean {
  const anchor = 'anchor' in node ? node.anchor : undefined
  const tag = 'tag' in node ? node.tag : undefined
  return Boolean(anchor) || (typeof tag === 'string' && tag.startsWith('!'))
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/u.test(value.trim())
}

function isDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}[Tt][0-2]\d:[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:\d{2})?$/u.test(
    value.trim()
  )
}

function assertBoundedSource(source: string): void {
  if (Buffer.byteLength(source, 'utf8') > KNOWLEDGE_SOURCE_MAX_BYTES) {
    throw new Error('Note is too large for property indexing.')
  }
}

function hashSource(source: string): string {
  return createHash('sha256').update(source).digest('hex')
}
