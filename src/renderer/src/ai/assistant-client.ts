/**
 * `assistant-client` — the concrete `AssistantRuntime` implementation.
 *
 * It is intentionally thin: it forwards calls to `window.aiApi` (preload →
 * main process → `ai-tanstack-adapter.ts`). The renderer never touches
 * `@tanstack/*` directly.
 */

import type {
  AiPublicSettings,
  AiSaveSettingsInput,
  AssistantApplyPatchInput,
  AssistantApplyPatchOutput,
  AssistantChatStartInput,
  AssistantChatStartOutput,
  AssistantEvent
} from '../../../shared/ai'

import type { AssistantRuntime, BuildContextInput } from './runtime'

export interface AssistantClientOptions {
  /** Override the streaming-event subscriber; useful in tests. */
  onSessionEvent?: (listener: (sessionId: string, event: AssistantEvent) => void) => () => void
}

export function createAssistantRuntime(options: AssistantClientOptions = {}): AssistantRuntime {
  const subscribe = options.onSessionEvent ?? ((listener) => window.aiApi.onEvent(listener))

  return {
    getSettings: () => window.aiApi.getSettings(),
    saveSettings: (input: AiSaveSettingsInput) => window.aiApi.saveSettings(input),
    clearApiKey: () => window.aiApi.clearApiKey(),
    startChat: (input: AssistantChatStartInput) => window.aiApi.chatStart(input),
    cancelChat: (sessionId: string) => window.aiApi.chatCancel({ sessionId }),
    applyPatch: (input: AssistantApplyPatchInput) => window.aiApi.applyPatch(input),
    allowedPatchKinds: () => window.aiApi.allowedPatchKinds(),
    onSessionEvent: subscribe,
    buildContext: (input: BuildContextInput) => buildAssistantContext(input)
  }
}

/**
 * Build an `AssistantContext` from the current note + selection + registry.
 *
 * Bounded: we never send the full note text — only a 4 KB excerpt around the
 * selection (or the head of the note when no selection is active). This keeps
 * even big notebooks within the model's context window.
 */
function buildAssistantContext(
  input: BuildContextInput
): import('../../../shared/ai').AssistantContext {
  const excerpt = buildExcerpt(input.noteContent, input.selection)
  const noteRelativePath = input.noteRelativePath ?? ''

  return {
    noteRelativePath,
    noteTitle: input.noteTitle,
    noteExcerpt: excerpt,
    selection: input.selection,
    backlinks: input.backlinks.map((entry) => ({
      relativePath: entry.relativePath,
      display: entry.display
    })),
    registryTemplateHints: input.registryTemplateHints.map((hint) => ({
      name: hint.name,
      description: hint.description,
      category: hint.category,
      ...(hint.snippet !== undefined ? { snippet: hint.snippet } : {}),
      propsSchemaDescription: hint.propsSchemaDescription
    }))
  }
}

const MAX_EXCERPT_BYTES = 4000

function buildExcerpt(
  content: string,
  selection: import('../../../shared/ai').SelectionRange | null
): string {
  if (content.length <= MAX_EXCERPT_BYTES) {
    return content
  }

  if (!selection) {
    return content.slice(0, MAX_EXCERPT_BYTES)
  }

  const lineOffsets = computeLineOffsets(content)
  const startOffset = offsetForPosition(lineOffsets, selection.startLine, selection.startColumn)
  const endOffset = offsetForPosition(lineOffsets, selection.endLine, selection.endColumn)
  const center = Math.max(0, Math.floor((startOffset + endOffset) / 2))
  const half = Math.floor(MAX_EXCERPT_BYTES / 2)
  const from = Math.max(0, center - half)
  const to = Math.min(content.length, from + MAX_EXCERPT_BYTES)
  const prefix = from > 0 ? '…' : ''
  const suffix = to < content.length ? '…' : ''
  return `${prefix}${content.slice(from, to)}${suffix}`
}

function computeLineOffsets(content: string): number[] {
  const offsets: number[] = [0]
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10 /* \n */) {
      offsets.push(index + 1)
    }
  }
  return offsets
}

function offsetForPosition(lineOffsets: number[], line: number, column: number): number {
  const lineIndex = Math.max(1, Math.min(lineOffsets.length, line)) - 1
  return (lineOffsets[lineIndex] ?? 0) + column
}

/** Convenience: the default shared runtime instance for app components. */
let sharedRuntime: AssistantRuntime | null = null

export function getAssistantRuntime(): AssistantRuntime {
  if (!sharedRuntime) {
    sharedRuntime = createAssistantRuntime()
  }
  return sharedRuntime
}

/** Test-only reset hook. */
export function __resetAssistantRuntimeForTests(): void {
  sharedRuntime = null
}

export type { AiPublicSettings, AssistantApplyPatchOutput, AssistantChatStartOutput }
