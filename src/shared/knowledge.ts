export const KNOWLEDGE_SOURCE_MAX_BYTES = 2 * 1024 * 1024
export const KNOWLEDGE_MAX_OUTGOING_LINKS = 500
export const KNOWLEDGE_MAX_MENTION_CANDIDATES = 2_000
export const KNOWLEDGE_MAX_MENTIONS = 200
export const KNOWLEDGE_MENTION_TIME_BUDGET_MS = 40
export const KNOWLEDGE_MAX_FOOTNOTES = 500
export const KNOWLEDGE_PREVIEW_CACHE_SIZE = 24

export interface SourceRange {
  from: number
  to: number
}

export interface KnowledgePreviewTarget {
  relativePath: string
  heading?: string
}

export type KnowledgePanelId =
  | 'outline'
  | 'tags'
  | 'backlinks'
  | 'outgoing'
  | 'properties'
  | 'bookmarks'
  | 'footnotes'

export type OutgoingLinkKind = 'wikilink' | 'markdown'

export interface OutgoingLink {
  kind: OutgoingLinkKind
  target: string
  subpath: string | null
  display: string
  range: SourceRange
}

export interface ResolvedNoteTarget {
  relativePath: string
  title: string
  aliases: string[]
  contentHash: string
}

export interface OutgoingLinkResult {
  kind: OutgoingLinkKind
  target: string
  noteTarget: string
  subpath: string | null
  display: string
  sourceFrom: number
  sourceTo: number
  resolved: ResolvedNoteTarget[]
}

export interface MentionCandidate {
  relativePath: string
  title: string
  aliases: string[]
}

export interface UnlinkedMention {
  text: string
  range: SourceRange
  sourceHash: string
  candidates: MentionCandidate[]
}

export type IndexedPropertyType =
  | 'text'
  | 'list'
  | 'number'
  | 'checkbox'
  | 'date'
  | 'date-time'
  | 'tags'
  | 'unsupported'

export interface IndexedProperty {
  name: string
  normalizedName: string
  type: IndexedPropertyType
  values: string[]
  empty: boolean
  editable: boolean
  unsupportedReason: string | null
}

export type PropertyInventoryType = IndexedPropertyType | 'mixed'

export interface PropertySummary {
  name: string
  normalizedName: string
  type: PropertyInventoryType
  useCount: number
}

export interface FileProperty extends IndexedProperty {
  keyRange: SourceRange
  valueRange: SourceRange | null
  rawValue: string
}

export type FootnoteStatus = 'defined' | 'unreferenced' | 'missing-definition'

export interface FootnoteEntry {
  identifier: string
  preview: string
  status: FootnoteStatus
  definitionRange: SourceRange | null
  referenceRanges: SourceRange[]
  referenceCount: number
}

export interface FootnoteModel {
  entries: FootnoteEntry[]
  sourceHash: string
}

export interface KnowledgeNoteSnapshot {
  relativePath: string
  contentHash: string
  outgoingLinks: OutgoingLinkResult[]
  mentions: UnlinkedMention[]
  properties: FileProperty[]
  propertyParseError: string | null
  footnotes: FootnoteModel
}

export type PropertyValue = string | number | boolean | null | Array<string | number | boolean>

export type PropertyMutationInput =
  | { kind: 'add'; name: string; value: PropertyValue }
  | { kind: 'set'; name: string; value: PropertyValue }
  | { kind: 'delete'; name: string }

export interface PropertyMutationRequest {
  relativePath: string
  expectedContentHash: string
  mutation: PropertyMutationInput
}

export interface PropertyMutationResponse {
  relativePath: string
  source: string
  contentHash: string
}

export interface LinkMentionRequest {
  relativePath: string
  expectedContentHash: string
  mention: UnlinkedMention
  targetRelativePath: string
}

export interface PropertyRenameFile {
  relativePath: string
  contentHash: string
  collision: boolean
  unsupportedReason: string | null
}

export interface PropertyRenamePlan {
  oldName: string
  newName: string
  affectedFiles: PropertyRenameFile[]
  canApply: boolean
}

export interface PropertyRenameApplyRequest {
  oldName: string
  newName: string
  expectedFiles: Array<{ relativePath: string; contentHash: string }>
}

export interface PropertyRenameResult {
  updatedFiles: Array<{ relativePath: string; contentHash: string; source: string }>
}
