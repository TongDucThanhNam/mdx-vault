import {
  AI_ERROR_CODES,
  type PatchOperation,
  type PatchProposal,
  patchOperationSchema,
  patchProposalSchema
} from '../../shared/ai'

/**
 * Pure functions that turn AI text output into `PatchOperation`s and apply
 * them to the current note text. Keeping these pure (no fs, no Electron, no
 * TanStack) makes them unit-testable and means AI never writes to disk — the
 * renderer still routes every write through `vault:write-file`.
 */

export class AiPatchParseError extends Error {
  readonly code = AI_ERROR_CODES.PATCH_PARSE

  constructor(message: string) {
    super(message)
    this.name = 'AiPatchParseError'
  }
}

export class AiPatchDriftError extends Error {
  readonly code = AI_ERROR_CODES.PATCH_DRIFT

  constructor(message: string) {
    super(message)
    this.name = 'AiPatchDriftError'
  }
}

/**
 * The model occasionally wraps its answer in prose (e.g. "Here's the patch:")
 * before a JSON object. This finds the FIRST balanced top-level JSON object
 * and tries to parse it as a `PatchProposal`. Anything else fails with a
 * structured parse error.
 */
export function parsePatchResponse(rawText: string): PatchProposal {
  const candidate = extractFirstJsonObject(rawText)
  let parsed: unknown

  try {
    parsed = JSON.parse(candidate)
  } catch (error) {
    throw new AiPatchParseError(
      `Could not parse AI response as JSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const normalized = normalizeProposalShape(parsed)
  const proposal = patchProposalSchema.safeParse(normalized)

  if (!proposal.success) {
    throw new AiPatchParseError(
      `AI proposal did not match the patch schema: ${proposal.error.issues
        .map((issue) => `${issue.path.join('.') || 'proposal'}: ${issue.message}`)
        .join('; ')}`
    )
  }

  return proposal.data
}

/**
 * Validates and applies a single operation to the current note text. For
 * `componentDraft` operations the note text isn't actually mutated — the
 * caller receives a "files to write" descriptor and leaves it alone.
 */
export function applyOperation(
  currentContent: string,
  operation: PatchOperation
):
  | { kind: 'note'; text: string }
  | { kind: 'componentDraft'; files: Array<{ relativePath: string; content: string }> } {
  switch (operation.kind) {
    case 'textPatch': {
      return {
        kind: 'note',
        text: applyTextPatch(currentContent, operation.start, operation.end, operation.replacement)
      }
    }
    case 'interactiveInsert': {
      return {
        kind: 'note',
        text: applyInteractiveInsert(
          currentContent,
          operation.atOffset,
          operation.src,
          operation.propsJson
        )
      }
    }
    case 'componentDraft': {
      return { kind: 'componentDraft', files: synthesiseComponentFiles(operation) }
    }
    default: {
      const _exhaustive: never = operation
      throw new AiPatchParseError(`Unsupported patch operation: ${String(_exhaustive)}`)
    }
  }
}

/**
 * Applies each operation in order against the running note content. Stops at
 * the first byte-range / anchor mismatch with an `AiPatchDriftError`. The
 * returned text is what the diff review shows AND what `vault:write-file`
 * would later persist if the user clicks Approve.
 */
export function applyAllOperations(
  currentContent: string,
  operations: PatchOperation[]
): {
  kind: 'combined'
  text: string
  files: Array<{ relativePath: string; content: string }>
} {
  let workingText = currentContent
  const files: Array<{ relativePath: string; content: string }> = []

  for (const operation of operations) {
    if (operation.kind === 'componentDraft') {
      // Component drafts don't touch the note text; the note side receives
      // the `<Interactive src=...>` *after* the user approves, and the
      // scaffolding files (component.tsx + manifest.json) get written by
      // separate `vault:write-file` calls. We hold on to the file list so we
      // can return it alongside the (unchanged) note text.
      const result = applyOperation(workingText, operation)
      if (result.kind === 'componentDraft') {
        files.push(...result.files)
      }
      continue
    }

    const result = applyOperation(workingText, operation)

    if (result.kind !== 'note') {
      continue
    }

    workingText = result.text
  }

  return { kind: 'combined', text: workingText, files }
}

/* -------------------------------------------------------------------------- */
/*                              JSON extraction                               */
/* -------------------------------------------------------------------------- */

function extractFirstJsonObject(rawText: string): string {
  const text = rawText.trim()

  if (!text) {
    throw new AiPatchParseError('AI returned an empty response')
  }

  if (text.startsWith('{') && text.endsWith('}')) {
    return text
  }

  // Find the first '{' that begins a balanced top-level object.
  let depth = 0
  let inString = false
  let escaped = false
  let startIndex = -1

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (inString) {
      if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        inString = false
      }
      continue
    }

    if (character === '"') {
      inString = true
      continue
    }

    if (character === '{') {
      if (depth === 0) {
        startIndex = index
      }
      depth += 1
      continue
    }

    if (character === '}') {
      depth -= 1
      if (depth === 0 && startIndex !== -1) {
        return text.slice(startIndex, index + 1)
      }
    }
  }

  throw new AiPatchParseError('AI response did not contain a JSON object')
}

function normalizeProposalShape(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>

  if (!('patches' in record) && 'patch' in record) {
    return { ...record, patches: record.patch }
  }

  return record
}

/* -------------------------------------------------------------------------- */
/*                              Text patches                                  */
/* -------------------------------------------------------------------------- */

export function applyTextPatch(
  content: string,
  start: number,
  end: number,
  replacement: string
): string {
  if (start < 0 || end > content.length || start > end) {
    throw new AiPatchDriftError(
      `Byte range [${start}, ${end}) is invalid for note of length ${content.length}; the note may have changed since the patch was suggested.`
    )
  }

  return `${content.slice(0, start)}${replacement}${content.slice(end)}`
}

export function applyInteractiveInsert(
  content: string,
  atOffset: number,
  src: string,
  propsJson: string
): string {
  if (atOffset < 0 || atOffset > content.length) {
    throw new AiPatchDriftError(
      `Insertion offset ${atOffset} is invalid for note of length ${content.length}.`
    )
  }

  const before = content.slice(0, atOffset)
  const after = content.slice(atOffset)
  const needsLeadingNewline = before.length > 0 && !before.endsWith('\n')
  const needsTrailingNewline = after.length > 0 && !after.startsWith('\n')

  const openTag = `<Interactive src="${src}"`
  const propLines = propsJson
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  let attributeString = ''
  if (propLines.length === 0) {
    attributeString = ' />'
  } else if (propLines.length === 1) {
    attributeString = ` ${propLines[0]} />`
  } else {
    const inner = propLines.map((line) => `  ${line}`).join('\n')
    attributeString = `\n${inner}\n/>`
  }

  const block = `${openTag}${attributeString}`
  const prefix = needsLeadingNewline ? '\n\n' : ''
  const suffix = needsTrailingNewline ? '\n\n' : '\n'

  return `${before}${prefix}${block}${suffix}${after}`
}

/* -------------------------------------------------------------------------- */
/*                          Component draft synthesis                        */
/* -------------------------------------------------------------------------- */

function synthesiseComponentFiles(
  draft: Extract<PatchOperation, { kind: 'componentDraft' }>
): Array<{ relativePath: string; content: string }> {
  // Validate manifest before persisting strings.
  patchOperationSchema.parse(draft)

  // Trim trailing slash; the renderer never uses a leading slash here.
  const folder = draft.folderRelativePath.replace(/\/+$/, '')
  const componentRelativePath = `${folder}/component.tsx`
  const manifestRelativePath = `${folder}/manifest.json`
  const readmeRelativePath = `${folder}/README.md`

  return [
    { relativePath: componentRelativePath, content: draft.componentSource },
    { relativePath: manifestRelativePath, content: prettyJson(draft.manifestJson) },
    {
      relativePath: readmeRelativePath,
      content: `${draft.readmeMarkdown.trim()}\n\n## AI provenance\n\n- Prompt: ${draft.provenance.prompt}\n- Source note: ${draft.provenance.noteRelativePath}\n- Model: ${draft.provenance.modelName}\n- Generated: ${draft.provenance.generatedAt}\n`
    }
  ]
}

function prettyJson(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson)
    return `${JSON.stringify(parsed, null, 2)}\n`
  } catch {
    return `${rawJson.trim()}\n`
  }
}

/* -------------------------------------------------------------------------- */
/*                              Helpers                                       */
/* -------------------------------------------------------------------------- */

/** Marker for grep-able review. */
export const AI_PATCH_ENGINE_MARKER = 'mdx-vault-ai-patch-engine:v1'
