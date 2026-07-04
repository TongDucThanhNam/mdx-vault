/**
 * `AssistantRuntime` is the renderer-side contract for the AI assistant.
 *
 * Nothing else in the renderer should import `@tanstack/*` directly — the
 * actual SDK is hidden behind `window.aiApi` (preload) which forwards to
 * `src/main/services/ai-tanstack-adapter.ts`. That keeps the security
 * invariant "TanStack AI import duy nhất trong adapter module" intact.
 */

import type {
  AiPublicSettings,
  AiSaveSettingsInput,
  AssistantApplyPatchInput,
  AssistantApplyPatchOutput,
  AssistantChatStartInput,
  AssistantChatStartOutput,
  AssistantContext,
  AssistantEvent,
  PatchOperation
} from '../../../shared/ai'

export interface AssistantRuntime {
  /** Read the public settings (no API key is ever returned). */
  getSettings(): Promise<AiPublicSettings>

  /** Persist settings. Pass `apiKey` to set, `clearApiKey: true` to wipe. */
  saveSettings(input: AiSaveSettingsInput): Promise<AiPublicSettings>

  /** Forget the stored API key; settings otherwise preserved. */
  clearApiKey(): Promise<AiPublicSettings>

  /** Start a streaming chat. Returns immediately with a session id;
   *  subsequent events arrive via `onSessionEvent`. */
  startChat(input: AssistantChatStartInput): Promise<AssistantChatStartOutput>

  /** Abort an in-flight chat session. */
  cancelChat(sessionId: string): Promise<{ ok: boolean; reason?: string }>

  /** Validate-and-apply a patch locally (no AI call). Used after the user
   *  approves a proposal so the renderer can both show a diff and write
   *  the file via the standard `vaultApi.writeFile`. */
  applyPatch(input: AssistantApplyPatchInput): Promise<AssistantApplyPatchOutput>

  /** List of operation kinds the runtime is willing to perform. Mirrors
   *  `ALLOWED_PATCH_OPERATIONS` from the adapter so the UI can grey-out
   *  actions that aren't supported. */
  allowedPatchKinds(): Promise<ReadonlyArray<PatchOperation['kind']>>

  /** Subscribe to streaming events for any session. Returns an unsubscribe. */
  onSessionEvent(listener: (sessionId: string, event: AssistantEvent) => void): () => void

  /** Build an `AssistantContext` from the current note + selection. This is
   *  pure: it does not perform IPC. */
  buildContext(input: BuildContextInput): AssistantContext
}

export interface BuildContextInput {
  noteRelativePath: string | null
  noteTitle: string
  noteContent: string
  selection: import('../../../shared/ai').SelectionRange | null
  backlinks: ReadonlyArray<{ relativePath: string; display: string }>
  registryTemplateHints: ReadonlyArray<{
    name: string
    description: string
    category: string
    snippet?: string
    propsSchemaDescription: string
  }>
}

/** Marker so reviewers can grep for any direct TanStack AI import in the
 *  renderer. If a new file imports `@tanstack/*` it should trip the search. */
export const ASSISTANT_RUNTIME_MARKER = 'mdx-vault-ai-runtime:v1'
