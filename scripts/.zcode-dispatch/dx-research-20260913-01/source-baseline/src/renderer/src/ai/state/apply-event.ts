/**
 * Pure reducer for streaming assistant events. Lives in its own file so the
 * `AiMessageList` component file stays React-only (helps React Refresh's
 * `react-refresh/only-export-components` lint rule).
 */

import type { AssistantEvent } from '../../../../shared/ai'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export interface ToolCallTrace {
  id: string
  toolName: string
  args: Record<string, unknown>
  ok?: boolean
  error?: string
}

export interface StreamingDraftState {
  messages: ChatMessage[]
  toolCalls: ToolCallTrace[]
  tokenBuffer: string
}

export function applyEvent(
  state: StreamingDraftState,
  event: AssistantEvent,
  push: (chunk: { assistantText: string }) => void
): StreamingDraftState {
  switch (event.type) {
    case 'token': {
      state.tokenBuffer += event.delta
      push({ assistantText: state.tokenBuffer })
      return state
    }
    case 'tool-call': {
      state.toolCalls.push({
        id: event.callId,
        toolName: event.toolName,
        args: event.args
      })
      return state
    }
    case 'tool-result': {
      const index = state.toolCalls.findIndex((trace) => trace.id === event.callId)
      if (index >= 0) {
        const trace = state.toolCalls[index]
        state.toolCalls[index] = {
          ...trace,
          ok: event.ok,
          ...(event.error ? { error: event.error } : {})
        }
      }
      return state
    }
    case 'patch-proposal':
    case 'error':
    case 'done':
      return state
  }
}
