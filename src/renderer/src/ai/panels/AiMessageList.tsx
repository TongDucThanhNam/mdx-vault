/**
 * `AiMessageList` — renders the assistant's reasoning transcript.
 *
 * We surface tool calls and tool results as small grey chips so the user can
 * see what the model looked at; we never render the API key, never display
 * raw model outputs as instructions, and the approval step lives in
 * `AiDiffReview` (separate component).
 */

import { AlertTriangle, Bot, ChevronRight, Sparkles, User, Wrench } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'
import type { PatchOperation, PatchProposal } from '../../../../shared/ai'

import type { ChatMessage, ToolCallTrace } from '../state/apply-event'

// biome-ignore lint/style/useComponentExportOnlyModules: Type-only re-exports do not affect Fast Refresh.
export type { ChatMessage, ToolCallTrace }

interface AiMessageListProps {
  messages: ChatMessage[]
  toolCalls: ToolCallTrace[]
  proposal: PatchProposal | null
  error: { message: string; code?: string } | null
  streaming: boolean
  emptyState?: React.ReactNode
}

export function AiMessageList({
  messages,
  toolCalls,
  proposal,
  error,
  streaming,
  emptyState
}: AiMessageListProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, toolCalls, proposal, error])

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-auto px-3 py-2 text-sm">
      {messages.length === 0 && toolCalls.length === 0 && !proposal && !error
        ? (emptyState ?? <EmptyHint />)
        : null}

      <div className="flex flex-col gap-2">
        {messages.map((message) => (
          <MessageBubble key={message.id} role={message.role} text={message.text} />
        ))}

        {toolCalls.map((trace) => (
          <ToolCallChip key={trace.id} trace={trace} />
        ))}

        {proposal ? <ProposalCard proposal={proposal} /> : null}

        {error ? <ErrorBanner message={error.message} code={error.code} /> : null}

        {streaming && messages.length === 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3 animate-pulse" aria-hidden="true" />
            Thinking…
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EmptyHint(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Bot className="size-5" aria-hidden="true" />
      <p className="text-sm">No messages yet.</p>
      <p className="text-xs">
        Select some prose in the editor, then choose an action to ask for help.
      </p>
    </div>
  )
}

function MessageBubble({
  role,
  text
}: {
  role: 'user' | 'assistant'
  text: string
}): React.JSX.Element {
  const isUser = role === 'user'

  return (
    <div className={cn('flex items-start gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex size-6 shrink-0 items-center justify-center border-2 border-foreground',
          isUser ? 'bg-[var(--editorial-red)] text-white' : 'bg-background text-foreground'
        )}
      >
        {isUser ? (
          <User className="size-3.5" aria-hidden="true" />
        ) : (
          <Bot className="size-3.5" aria-hidden="true" />
        )}
      </div>
      <div
        className={cn(
          'min-w-0 max-w-[80%] whitespace-pre-wrap border-2 border-foreground px-2.5 py-1.5',
          isUser ? 'bg-foreground text-background' : 'bg-muted/30 text-foreground'
        )}
      >
        {text || <span className="text-muted-foreground">…</span>}
      </div>
    </div>
  )
}

function ToolCallChip({ trace }: { trace: ToolCallTrace }): React.JSX.Element {
  const summary = trace.ok
    ? `${trace.toolName}(${summariseArgs(trace.args)})`
    : trace.error
      ? `${trace.toolName} failed: ${trace.error}`
      : `${trace.toolName}(${summariseArgs(trace.args)})`

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <span className="flex size-5 items-center justify-center border-2 border-foreground bg-background">
        <Wrench className="size-3" aria-hidden="true" />
      </span>
      <span className="truncate">{summary}</span>
    </div>
  )
}

function summariseArgs(args: Record<string, unknown>): string {
  const keys = Object.keys(args)
  if (keys.length === 0) return ''
  return keys
    .slice(0, 3)
    .map((key) => {
      const value = args[key]
      if (typeof value === 'string') {
        return `${key}=${value.length > 24 ? value.slice(0, 24) + '…' : value}`
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        return `${key}=${String(value)}`
      }
      return `${key}=…`
    })
    .join(', ')
}

function ProposalCard({ proposal }: { proposal: PatchProposal }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 border-2 border-foreground bg-muted/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-foreground">
        <ChevronRight className="size-3 text-[var(--editorial-red)]" aria-hidden="true" />
        Proposed changes ({proposal.patches.length})
      </div>
      {proposal.rationale ? (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{proposal.rationale}</p>
      ) : null}
      <ul className="space-y-1 text-xs">
        {proposal.patches.map((op, index) => (
          <li key={index} className="font-mono text-muted-foreground">
            <span className="text-foreground">[{index + 1}]</span> {describeOperation(op)}
          </li>
        ))}
      </ul>
      <div className="text-xs text-muted-foreground">
        Review the diff below and approve to write.
      </div>
    </div>
  )
}

function describeOperation(op: PatchOperation): string {
  switch (op.kind) {
    case 'textPatch': {
      const len = op.end - op.start
      return `textPatch — replace ${len} char${len === 1 ? '' : 's'} at offset ${op.start}`
    }
    case 'interactiveInsert':
      return `interactiveInsert — <${op.src} /> at offset ${op.atOffset}`
    case 'componentDraft':
      return `componentDraft — ${op.folderRelativePath}`
  }
}

function ErrorBanner({ message, code }: { message: string; code?: string }): React.JSX.Element {
  return (
    <div className="flex items-start gap-2 border-2 border-destructive bg-destructive/10 px-2.5 py-2 font-mono text-xs uppercase tracking-wider text-destructive">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <div className="font-bold">{code ?? 'error'}</div>
        <div className="whitespace-pre-wrap normal-case">{message}</div>
      </div>
    </div>
  )
}
