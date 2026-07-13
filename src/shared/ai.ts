/**
 * AI assistant contracts shared between the main process (TanStack AI adapter,
 * tools, patch engine) and the renderer (`AssistantRuntime` UI + diff review).
 *
 * Invariants (see docs/security.md + goals/GOAL-06):
 *
 *  1. The raw API key is never carried by any of these types. Only `hasApiKey`
 *     and provider/model metadata flow over IPC. Encryption is performed in
 *     the main process via Electron `safeStorage`.
 *  2. AI never writes to the vault. The only path that mutates files is
 *     `vault:write-file` (and its `interactive` twin), invoked by the renderer
 *     after the user explicitly approves a `PatchOperation` shown in the diff
 *     review.
 *  3. Everything here is zod-validated so untrusted AI output cannot cross the
 *     boundary without a schema check.
 */

import { z } from 'zod'

/* -------------------------------------------------------------------------- */
/*                                Versions                                    */
/* -------------------------------------------------------------------------- */

export const AI_PROTOCOL_VERSION = 1 as const

/* -------------------------------------------------------------------------- */
/*                                Settings                                    */
/* -------------------------------------------------------------------------- */

export const aiProviderSchema = z.enum(['openai', 'none'])
export type AiProvider = z.infer<typeof aiProviderSchema>

/** Allowed OpenAI model identifiers. Keep in sync with what `@tanstack/ai-openai`
 *  can type via `openaiText(...)`. */
export const aiOpenAiModelSchema = z.enum([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'o4-mini'
])
export type AiOpenAiModel = z.infer<typeof aiOpenAiModelSchema>

export const DEFAULT_AI_MODEL: AiOpenAiModel = 'gpt-4o-mini'

export const aiPublicSettingsSchema = z
  .object({
    version: z.literal(AI_PROTOCOL_VERSION),
    provider: aiProviderSchema,
    model: z.string().min(1),
    hasApiKey: z.boolean(),
    safeStorageAvailable: z.boolean(),
    baseUrl: z.string().min(1).optional(),
    updatedAt: z.string().optional()
  })
  .strict()

export type AiPublicSettings = z.infer<typeof aiPublicSettingsSchema>

/** Input the renderer sends when persisting settings. The plain API key is
 *  accepted only over IPC, only stored encrypted, never returned. */
export const aiSaveSettingsInputSchema = z
  .object({
    provider: aiProviderSchema,
    model: z.string().min(1),
    apiKey: z.string().optional(),
    clearApiKey: z.boolean().optional(),
    baseUrl: z.string().min(1).optional()
  })
  .strict()

export type AiSaveSettingsInput = z.infer<typeof aiSaveSettingsInputSchema>

/* -------------------------------------------------------------------------- */
/*                                 Context                                    */
/* -------------------------------------------------------------------------- */

export const selectionRangeSchema = z
  .object({
    /** 0-based line number where the selection starts. */
    startLine: z.number().int().min(1),
    startColumn: z.number().int().min(0),
    endLine: z.number().int().min(1),
    endColumn: z.number().int().min(0),
    /** The exact text the user selected; used as `selectedSnippet`. */
    text: z.string()
  })
  .strict()
  .refine((value) => value.startLine < value.endLine || value.startColumn <= value.endColumn, {
    message: 'Invalid selection range'
  })

export type SelectionRange = z.infer<typeof selectionRangeSchema>

export const assistantContextSchema = z
  .object({
    noteRelativePath: z.string().min(1),
    noteTitle: z.string(),
    /** A bounded excerpt of the current note so we never blow the token budget. */
    noteExcerpt: z.string().max(4000),
    selection: selectionRangeSchema.nullable(),
    backlinks: z
      .array(
        z
          .object({
            relativePath: z.string().min(1),
            display: z.string()
          })
          .strict()
      )
      .default([]),
    /** Renderer-built registry hints (name, description, prop slot summary) */
    registryTemplateHints: z
      .array(
        z
          .object({
            name: z.string(),
            description: z.string(),
            category: z.string(),
            snippet: z.string().optional(),
            propsSchemaDescription: z.string()
          })
          .strict()
      )
      .default([])
  })
  .strict()

export type AssistantContext = z.infer<typeof assistantContextSchema>

/* -------------------------------------------------------------------------- */
/*                              Patch operations                              */
/* -------------------------------------------------------------------------- */

export const textPatchSchema = z
  .object({
    kind: z.literal('textPatch'),
    /** Free-text rationale the model provides (not shown to user as code). */
    rationale: z.string().optional(),
    /** Start byte offset in the current note (inclusive). */
    start: z.number().int().min(0),
    /** End byte offset in the current note (exclusive). */
    end: z.number().int().min(0),
    replacement: z.string()
  })
  .strict()
  .refine((value) => value.start <= value.end, { message: 'Patch range is inverted' })

export type TextPatch = z.infer<typeof textPatchSchema>

export const interactiveInsertSchema = z
  .object({
    kind: z.literal('interactiveInsert'),
    rationale: z.string().optional(),
    /** Byte offset to insert at; we insert a newline + the JSX + a newline. */
    atOffset: z.number().int().min(0),
    src: z.string().min(1),
    propsJson: z.string()
  })
  .strict()

export type InteractiveInsert = z.infer<typeof interactiveInsertSchema>

/** A draft vault component the AI wants to scaffold (template-first failed
 *  and the model wrote new code). Never registered into the trusted registry;
 *  always sandboxed once written. */
export const componentDraftSchema = z
  .object({
    kind: z.literal('componentDraft'),
    rationale: z.string().optional(),
    folderRelativePath: z.string().regex(/^interactives\/[A-Za-z0-9_-][A-Za-z0-9_\-/]*$/, {
      message: 'Component drafts must live under interactives/<name>'
    }),
    componentSource: z.string().min(1),
    manifestJson: z.string().min(1),
    readmeMarkdown: z.string().min(1),
    /** Provenance required by security.md / GOAL-06: prompt + context. */
    provenance: z
      .object({
        prompt: z.string(),
        noteRelativePath: z.string(),
        modelName: z.string(),
        generatedAt: z.string()
      })
      .strict()
  })
  .strict()

export type ComponentDraft = z.infer<typeof componentDraftSchema>

export const patchOperationSchema = z.discriminatedUnion('kind', [
  textPatchSchema,
  interactiveInsertSchema,
  componentDraftSchema
])

export type PatchOperation = z.infer<typeof patchOperationSchema>

export const patchProposalSchema = z
  .object({
    rationale: z.string().optional(),
    patches: z.array(patchOperationSchema).min(1)
  })
  .strict()

export type PatchProposal = z.infer<typeof patchProposalSchema>

/* -------------------------------------------------------------------------- */
/*                              Streaming events                              */
/* -------------------------------------------------------------------------- */

export const assistantEventTokenSchema = z
  .object({
    type: z.literal('token'),
    delta: z.string()
  })
  .strict()

export const assistantEventToolCallSchema = z
  .object({
    type: z.literal('tool-call'),
    callId: z.string().min(1),
    toolName: z.string().min(1),
    args: z.record(z.string(), z.unknown())
  })
  .strict()

export const assistantEventToolResultSchema = z
  .object({
    type: z.literal('tool-result'),
    callId: z.string().min(1),
    ok: z.boolean(),
    output: z.unknown().optional(),
    error: z.string().optional()
  })
  .strict()

export const assistantEventPatchSchema = z
  .object({
    type: z.literal('patch-proposal'),
    proposal: patchProposalSchema
  })
  .strict()

export const assistantEventErrorSchema = z
  .object({
    type: z.literal('error'),
    message: z.string(),
    code: z.string().optional()
  })
  .strict()

export const assistantEventDoneSchema = z
  .object({
    type: z.literal('done')
  })
  .strict()

export const assistantEventSchema = z.discriminatedUnion('type', [
  assistantEventTokenSchema,
  assistantEventToolCallSchema,
  assistantEventToolResultSchema,
  assistantEventPatchSchema,
  assistantEventErrorSchema,
  assistantEventDoneSchema
])

export type AssistantEvent = z.infer<typeof assistantEventSchema>

export const assistantEventEnvelopeSchema = z
  .object({
    sessionId: z.string().min(1),
    event: assistantEventSchema
  })
  .strict()

export type AssistantEventEnvelope = z.infer<typeof assistantEventEnvelopeSchema>

/* -------------------------------------------------------------------------- */
/*                                  Chat I/O                                  */
/* -------------------------------------------------------------------------- */

export const assistantChatStartInputSchema = z
  .object({
    context: assistantContextSchema,
    /** Action id from `SELECTED_ACTIONS` ("open-chat" when no template). */
    actionId: z.string().min(1),
    userMessage: z.string().min(1)
  })
  .strict()

export type AssistantChatStartInput = z.infer<typeof assistantChatStartInputSchema>

export const assistantChatStartOutputSchema = z
  .object({
    sessionId: z.string().min(1)
  })
  .strict()

export type AssistantChatStartOutput = z.infer<typeof assistantChatStartOutputSchema>

export const assistantChatCancelInputSchema = z
  .object({
    sessionId: z.string().min(1)
  })
  .strict()

export type AssistantChatCancelInput = z.infer<typeof assistantChatCancelInputSchema>

/** Validate-only: re-applies patches to the current note and returns the
 *  resulting text so the renderer can show an honest diff. Never writes. */
export const assistantApplyPatchInputSchema = z
  .object({
    noteRelativePath: z.string().min(1),
    operations: z.array(patchOperationSchema).min(1)
  })
  .strict()

export const assistantApplyPatchOutputSchema = z
  .object({
    /**
     * One entry per `PatchOperation` in the input, in order:
     *   - textPatch / interactiveInsert → the full resulting note text after applying
     *   - componentDraft                → `{ kind: 'componentDraft', files: [{relativePath, content}] }`
     */
    results: z.array(
      z.discriminatedUnion('kind', [
        z
          .object({
            kind: z.literal('textPatch'),
            resultText: z.string()
          })
          .strict(),
        z
          .object({
            kind: z.literal('interactiveInsert'),
            resultText: z.string()
          })
          .strict(),
        z
          .object({
            kind: z.literal('componentDraft'),
            files: z
              .array(
                z
                  .object({
                    relativePath: z.string().min(1),
                    content: z.string()
                  })
                  .strict()
              )
              .min(1)
          })
          .strict()
      ])
    )
  })
  .strict()

export type AssistantApplyPatchInput = z.infer<typeof assistantApplyPatchInputSchema>
export type AssistantApplyPatchOutput = z.infer<typeof assistantApplyPatchOutputSchema>

export const assistantApprovePatchInputSchema = assistantApplyPatchInputSchema
export type AssistantApprovePatchInput = z.infer<typeof assistantApprovePatchInputSchema>

export const assistantApprovePatchOutputSchema = z
  .object({ writtenPaths: z.array(z.string().min(1)).min(1) })
  .strict()
export type AssistantApprovePatchOutput = z.infer<typeof assistantApprovePatchOutputSchema>

/* -------------------------------------------------------------------------- */
/*                                 Errors                                     */
/* -------------------------------------------------------------------------- */

export const AI_ERROR_CODES = {
  INVALID_CONFIG: 'AI_INVALID_CONFIG',
  NO_PROVIDER: 'AI_NO_PROVIDER',
  PROVIDER_DISABLED: 'AI_PROVIDER_DISABLED',
  STREAM_FAILED: 'AI_STREAM_FAILED',
  REPAIR_EXHAUSTED: 'AI_REPAIR_EXHAUSTED',
  PATCH_PARSE: 'AI_PATCH_PARSE',
  PATCH_DRIFT: 'AI_PATCH_DRIFT',
  SESSION_NOT_FOUND: 'AI_SESSION_NOT_FOUND',
  UNAUTHORIZED_PATH: 'AI_UNAUTHORIZED_PATH',
  VALIDATION_FAILED: 'VALIDATION_FAILED'
} as const
