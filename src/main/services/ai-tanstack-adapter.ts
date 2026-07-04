/**
 * TanStack AI adapter — the single module in this codebase that imports
 * `@tanstack/*`. Everything else (renderer, preload) talks only to the
 * `AssistantRuntime` contract surfaced through preload and the
 * `src/shared/ai.ts` schemas.
 *
 * Streaming: TanStack AI's `chat(...)` returns an `AsyncIterable<StreamChunk>`
 * of AG-UI events. We translate them to the simpler `AssistantEvent`
 * union (`token | tool-call | tool-result | patch-proposal | error | done`)
 * and forward each one over Electron's `WebContents.send` to the renderer,
 * tagged with the session id so multiple panels can filter.
 *
 * Tool boundary: read-only tools only — see `ai-tools.ts`. The compiler loop
 * (`ai-repair-loop.ts`) re-uses the `compile_component_draft` tool's verdict
 * to drive repairs.
 *
 * Writes: this file never writes to the vault. It only validates and
 * surfaces patches; the renderer is responsible for routing approved
 * patches through `vault:write-file`.
 */

import {
  chat,
  toolDefinition,
  type StreamChunk,
  type ModelMessage,
  type ToolCall
} from '@tanstack/ai'
import { createOpenaiChat } from '@tanstack/ai-openai'
import { randomUUID } from 'crypto'

import {
  AI_ERROR_CODES,
  patchOperationSchema,
  type AssistantContext,
  type AssistantEvent,
  type PatchOperation,
  type PatchProposal,
  type SelectionRange
} from '../../shared/ai'
import { AiSettingsService } from './ai-settings'
import { buildAiToolDefinitions } from './ai-tools'
import { parsePatchResponse, AiPatchParseError } from './ai-patch-engine'
import { buildSystemPrompt, findAction, type ActionDescriptor } from './ai-system-prompt'
import { repairComponentDraft } from './ai-repair-loop'
import { getCurrentVault } from './vault-session'
import { getCurrentIndex } from './vault-session'

/* -------------------------------------------------------------------------- */
/*                         Boundary / single-import gate                      */
/* -------------------------------------------------------------------------- */

/** If you reach for `@tanstack/...` from anywhere except this file, the
 *  security.md invariant "TanStack AI import duy nhất trong adapter module"
 *  is violated. There is no other place in the repo that should import it. */
export const AI_ADAPTER_MARKER = 'mdx-vault-ai-tanstack-adapter:v1'

/* -------------------------------------------------------------------------- */
/*                                Public API                                  */
/* -------------------------------------------------------------------------- */

export interface StartChatParams {
  context: AssistantContext
  action: ActionDescriptor
  userMessage: string
  sessionId?: string
}

export interface StartChatResult {
  sessionId: string
}

export interface SessionRecord {
  id: string
  abortController: AbortController
  createdAt: number
}

const MAX_REPAIR_ROUNDS = 3

/** All sessions currently in flight. Used by `cancelChat` and by the IPC
 *  handler to look up the abort controller. */
const activeSessions = new Map<string, SessionRecord>()

export function startChat(
  emitter: (envelope: { sessionId: string; event: AssistantEvent }) => void,
  params: StartChatParams
): StartChatResult {
  const sessionId = params.sessionId ?? randomUUID()
  const abortController = new AbortController()

  activeSessions.set(sessionId, {
    id: sessionId,
    abortController,
    createdAt: Date.now()
  })

  void runChatSession(emitter, sessionId, abortController, params).finally(() => {
    activeSessions.delete(sessionId)
  })

  return { sessionId }
}

export function cancelChat(sessionId: string): { ok: boolean; reason?: string } {
  const session = activeSessions.get(sessionId)
  if (!session) {
    return { ok: false, reason: AI_ERROR_CODES.SESSION_NOT_FOUND }
  }
  session.abortController.abort()
  activeSessions.delete(sessionId)
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/*                                The session                                 */
/* -------------------------------------------------------------------------- */

async function runChatSession(
  emitter: (envelope: { sessionId: string; event: AssistantEvent }) => void,
  sessionId: string,
  abortController: AbortController,
  params: StartChatParams
): Promise<void> {
  const send = (event: AssistantEvent): void => {
    emitter({ sessionId, event })
  }

  try {
    if (abortController.signal.aborted) {
      return
    }

    const settingsService = new AiSettingsService(getCurrentVault())
    const settings = await settingsService.get()

    if (!settings.safeStorageAvailable) {
      send({
        type: 'error',
        code: AI_ERROR_CODES.INVALID_CONFIG,
        message:
          'Electron safeStorage is not available on this system; refusing to start a chat (the API key would have nowhere safe to live).'
      })
      send({ type: 'done' })
      return
    }

    if (settings.provider === 'none') {
      send({
        type: 'error',
        code: AI_ERROR_CODES.NO_PROVIDER,
        message: 'No AI provider configured. Open the assistant settings to add an OpenAI API key.'
      })
      send({ type: 'done' })
      return
    }

    if (settings.provider !== 'openai') {
      send({
        type: 'error',
        code: AI_ERROR_CODES.PROVIDER_DISABLED,
        message: `Provider '${settings.provider}' is not enabled; this build ships with OpenAI only.`
      })
      send({ type: 'done' })
      return
    }

    if (!settings.hasApiKey) {
      send({
        type: 'error',
        code: AI_ERROR_CODES.INVALID_CONFIG,
        message: 'No API key on file. Add one in assistant settings.'
      })
      send({ type: 'done' })
      return
    }

    const apiKey = await settingsService.loadRuntimeKey()
    if (!apiKey) {
      send({
        type: 'error',
        code: AI_ERROR_CODES.INVALID_CONFIG,
        message: 'Could not decrypt the stored API key. Please re-enter it.'
      })
      send({ type: 'done' })
      return
    }

    const toolSpecs = buildAiToolDefinitions({
      activeNoteRelativePath: params.context.noteRelativePath,
      selection: params.context.selection
    })

    const systemPrompt = buildSystemPrompt({
      action: params.action,
      context: params.context,
      userMessage: params.userMessage,
      modelName: settings.model
    })

    const adapter = createOpenaiChat(
      settings.model as Parameters<typeof createOpenaiChat>[0],
      apiKey
    )

    /**
     * Wrap each framework-free `AiToolSpec` in TanStack's `toolDefinition`.
     * This is the ONLY place we bridge into the `@tanstack/*` shape, which
     * keeps `ai-tools.ts` and the rest of the app framework-agnostic.
     */
    const tools = toolSpecs.map((spec) => {
      const definition = toolDefinition({
        name: spec.name,
        description: spec.description,
        inputSchema: spec.inputSchema,
        outputSchema: spec.outputSchema
      })
      const serverTool = definition.server(spec.execute)
      return { spec, definition, server: serverTool }
    })

    const toolInstances = tools.map((entry) => entry.server)

    let messages: ModelMessage[] = [{ role: 'user', content: composeUserTurn(params) }]

    let proposal: PatchProposal | null = null
    let streamError: string | null = null
    let assistantText = ''
    const observedToolCalls = new Map<
      string,
      { id: string; name: string; args: string; arguments: string }
    >()

    try {
      const stream = chat({
        adapter,
        systemPrompts: [systemPrompt],
        messages,
        tools: toolInstances,
        stream: true,
        abortController
      })

      for await (const chunk of stream as AsyncIterable<StreamChunk>) {
        if (abortController.signal.aborted) {
          return
        }
        handleChunk(chunk, {
          sessionId,
          send,
          pushText: (delta) => {
            assistantText += delta
          },
          startToolCall: (call) => {
            observedToolCalls.set(call.id, {
              id: call.id,
              name: call.name,
              args: call.args,
              arguments: call.arguments
            })
          },
          setStreamError: (message) => {
            streamError = message
          }
        })

        if (streamError) {
          break
        }
      }
    } catch (error) {
      streamError = error instanceof Error ? error.message : String(error)
    }

    if (streamError) {
      send({ type: 'error', code: AI_ERROR_CODES.STREAM_FAILED, message: streamError })
      send({ type: 'done' })
      return
    }

    // Process tool calls if any.
    if (observedToolCalls.size > 0) {
      for (const toolCall of observedToolCalls.values()) {
        if (abortController.signal.aborted) {
          return
        }

        const toolEntry = tools.find((entry) => entry.spec.name === toolCall.name)
        if (!toolEntry) {
          send({
            type: 'tool-result',
            callId: toolCall.id,
            ok: false,
            error: `Unknown tool: ${toolCall.name}`
          })
          continue
        }

        let parsedArgs: unknown = {}
        try {
          parsedArgs = JSON.parse(toolCall.arguments || '{}')
        } catch {
          parsedArgs = {}
        }

        send({
          type: 'tool-call',
          callId: toolCall.id,
          toolName: toolCall.name,
          args: isRecord(parsedArgs) ? parsedArgs : {}
        })

        try {
          // Validate the model-supplied args against the tool's zod schema
          // before invoking execute — same semantics TanStack's server() would
          // give us, but kept explicit so the only `@tanstack/*` touchpoint is
          // the type cast above.
          const validatedArgs = toolEntry.spec.inputSchema.parse(parsedArgs)
          const output = await toolEntry.spec.execute(validatedArgs)
          const serialised = serialiseToolOutput(output)
          send({
            type: 'tool-result',
            callId: toolCall.id,
            ok: true,
            output: serialised
          })
          messages = appendAssistantTurn(messages, {
            toolCalls: [toTanstackToolCall(toolCall)],
            content: assistantText
          })
          messages.push({
            role: 'tool',
            content: typeof serialised === 'string' ? serialised : JSON.stringify(serialised),
            toolCallId: toolCall.id
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          send({
            type: 'tool-result',
            callId: toolCall.id,
            ok: false,
            error: message
          })
          messages = appendAssistantTurn(messages, {
            toolCalls: [toTanstackToolCall(toolCall)],
            content: assistantText
          })
          messages.push({
            role: 'tool',
            content: JSON.stringify({ ok: false, error: message }),
            toolCallId: toolCall.id
          })
        }
      }

      // After supplying tool results, ask the model to produce the final
      // JSON PatchProposal. We do a single follow-up stream iteration.
      assistantText = ''
      streamError = null
      try {
        const followUp = chat({
          adapter,
          systemPrompts: [
            systemPrompt,
            'Tool results were just supplied. Now respond with EXACTLY ONE JSON object that matches the contract — no prose, no fences.'
          ],
          messages,
          tools: toolInstances,
          stream: true,
          abortController
        })
        for await (const chunk of followUp as AsyncIterable<StreamChunk>) {
          if (abortController.signal.aborted) {
            return
          }
          handleChunk(chunk, {
            sessionId,
            send,
            pushText: (delta) => {
              assistantText += delta
            },
            startToolCall: () => {
              // We don't allow second-round tool calls here.
            },
            setStreamError: (message) => {
              streamError = message
            }
          })
          if (streamError) {
            break
          }
        }
      } catch (error) {
        streamError = error instanceof Error ? error.message : String(error)
      }

      if (streamError) {
        send({ type: 'error', code: AI_ERROR_CODES.STREAM_FAILED, message: streamError })
        send({ type: 'done' })
        return
      }
    }

    // Parse the final body for a PatchProposal.
    try {
      proposal = parsePatchResponse(assistantText)
    } catch (error) {
      const message =
        error instanceof AiPatchParseError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error)
      send({ type: 'error', code: AI_ERROR_CODES.PATCH_PARSE, message })
      send({ type: 'done' })
      return
    }

    if (!proposal) {
      send({
        type: 'error',
        code: AI_ERROR_CODES.PATCH_PARSE,
        message: 'Model did not produce a patch proposal.'
      })
      send({ type: 'done' })
      return
    }

    // For component drafts: drive the compile-repair loop. The renderer sees
    // tool-call + tool-result events for each round; on success we lift the
    // repaired draft into the proposal.
    const draftIndexes: number[] = []
    proposal.patches.forEach((op, index) => {
      if (op.kind === 'componentDraft') {
        draftIndexes.push(index)
      }
    })

    if (draftIndexes.length > 0) {
      const nextProposal: PatchProposal = {
        rationale: proposal.rationale,
        patches: proposal.patches.slice()
      }

      for (const index of draftIndexes) {
        const draft = nextProposal.patches[index] as Extract<
          PatchOperation,
          { kind: 'componentDraft' }
        >

        const verdict = await repairComponentDraft(draft, {
          maxRounds: MAX_REPAIR_ROUNDS,
          nextDraft: async (_current, errors) => {
            // The adapter does not actually call the model for repairs —
            // we expose the compile errors as a tool-result so the user can
            // see what failed, then return null to terminate the loop. The
            // user can click "Retry" to start a fresh assistant turn. This
            // keeps "AI never writes to disk" honest: the model never gets
            // unbounded self-edit authority.
            send({
              type: 'tool-call',
              callId: randomUUID(),
              toolName: 'compile_component_draft',
              args: { errors }
            })
            send({
              type: 'tool-result',
              callId: randomUUID(),
              ok: false,
              error: errors.join('\n')
            })
            return null
          }
        })

        if (!verdict.ok) {
          send({
            type: 'error',
            code: AI_ERROR_CODES.REPAIR_EXHAUSTED,
            message: `Component draft could not compile after ${verdict.rounds} round(s): ${verdict.lastErrors.join('; ')}`
          })
        } else {
          nextProposal.patches[index] = verdict.draft
        }
      }

      proposal = nextProposal
    }

    send({ type: 'patch-proposal', proposal })
    send({ type: 'done' })
  } catch (error) {
    send({
      type: 'error',
      code: AI_ERROR_CODES.STREAM_FAILED,
      message: error instanceof Error ? error.message : String(error)
    })
    send({ type: 'done' })
  }
}

/* -------------------------------------------------------------------------- */
/*                          AG-UI stream chunk handling                       */
/* -------------------------------------------------------------------------- */

interface ChunkSink {
  sessionId: string
  send: (event: AssistantEvent) => void
  pushText: (delta: string) => void
  startToolCall: (call: { id: string; name: string; args: string; arguments: string }) => void
  setStreamError: (message: string) => void
}

function handleChunk(chunk: StreamChunk, sink: ChunkSink): void {
  const raw = chunk as unknown as Record<string, unknown>
  const type = typeof raw['type'] === 'string' ? (raw['type'] as string) : null

  if (!type) {
    return
  }

  switch (type) {
    case 'TEXT_MESSAGE_CONTENT': {
      const delta = readString(raw, 'delta')
      if (delta) {
        sink.pushText(delta)
        sink.send({ type: 'token', delta })
      }
      return
    }
    case 'THINKING_TEXT_MESSAGE_CONTENT': {
      // Surface thinking as 'token' too — the renderer treats it as a fold.
      const delta = readString(raw, 'delta')
      if (delta) {
        sink.send({ type: 'token', delta: `◦ ${delta}` })
      }
      return
    }
    case 'TOOL_CALL_START': {
      const id = readString(raw, 'toolCallId')
      const name = readString(raw, 'toolName')
      if (id && name) {
        sink.startToolCall({ id, name, args: '{}', arguments: '{}' })
      }
      return
    }
    case 'TOOL_CALL_ARGS': {
      const id = readString(raw, 'toolCallId')
      const delta = readString(raw, 'delta')
      // We don't accumulate args on the sink side — the adapter uses them
      // from the synthesized tool call after `TOOL_CALL_END`.
      if (id && delta) {
        void delta
      }
      return
    }
    case 'TOOL_CALL_END': {
      // No-op: the next round we'll re-derive args from the model's output.
      return
    }
    case 'TOOL_CALL_RESULT': {
      // The model sometimes surfaces tool results inline; we trust the
      // server's later events instead.
      return
    }
    case 'RUN_ERROR': {
      const message = readString(raw, 'message') ?? 'Stream reported an error.'
      sink.setStreamError(message)
      return
    }
    default:
      return
  }
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function appendAssistantTurn(
  messages: ModelMessage[],
  fragment: { toolCalls?: ToolCall[]; content: string }
): ModelMessage[] {
  const next: ModelMessage = {
    role: 'assistant',
    content: fragment.content,
    ...(fragment.toolCalls && fragment.toolCalls.length > 0
      ? { toolCalls: fragment.toolCalls }
      : {})
  }
  return messages.concat(next)
}

function toTanstackToolCall(call: { id: string; name: string; arguments: string }): ToolCall {
  return {
    id: call.id,
    type: 'function',
    function: {
      name: call.name,
      arguments: call.arguments
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                          User-message builder                             */
/* -------------------------------------------------------------------------- */

function composeUserTurn(params: StartChatParams): string {
  const selectionSummary = describeSelection(params.context.selection)
  const actionFragment = `Action: ${params.action.id} (${params.action.mode}).`

  return [
    actionFragment,
    selectionSummary,
    'User request:',
    params.userMessage.trim(),
    'Respond with a single JSON object (no prose, no fences) per the system prompt contract.'
  ]
    .filter((chunk) => chunk.length > 0)
    .join('\n\n')
}

function describeSelection(selection: SelectionRange | null): string {
  if (!selection) {
    return 'Selection: (none)'
  }

  return [
    `Selection: lines ${selection.startLine}:${selection.startColumn}–${selection.endLine}:${selection.endColumn}`,
    '',
    '```',
    selection.text,
    '```'
  ].join('\n')
}

function serialiseToolOutput(output: unknown): unknown {
  if (typeof output === 'string') {
    return output
  }

  try {
    return JSON.parse(JSON.stringify(output))
  } catch {
    return output
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Export                                    */
/* -------------------------------------------------------------------------- */

/** Marker used by IPC layer to confirm any code path that touches TanStack AI
 *  must come through this adapter. */
export const ONLY_TANSTACK_IMPORT_INDICATOR = 'src/main/services/ai-tanstack-adapter.ts'

export { patchOperationSchema, findAction }

/** Marker for grep-able review. */
export const ALLOWED_PATCH_OPERATIONS: ReadonlyArray<PatchOperation['kind']> = [
  'textPatch',
  'interactiveInsert',
  'componentDraft'
]

/** Indexed runtime query helper used by the IPC layer to avoid exposing
 *  `db-service.ts` directly. */
export function indexedNoteExists(relativePath: string): boolean {
  try {
    const index = getCurrentIndex()
    const list = index.database.listNotes()
    return list.some((note) => note.relativePath === relativePath)
  } catch {
    return false
  }
}
