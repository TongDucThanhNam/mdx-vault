/**
 * `AiSidePanel` — the main composer + history + diff review surface.
 *
 * Flow:
 *   1. User selects prose in the editor, picks an action (via
 *      `AiSelectionActionPalette`), types a request, hits send.
 *   2. We build an `AssistantContext` and call `runtime.startChat`.
 *   3. Streaming events are surfaced into `AiMessageList`; tool calls appear
 *      as chips so the user can see what the model looked at.
 *   4. On `patch-proposal`, we run `runtime.applyPatch` to compute the
 *      resulting text + the synthesised component files (for drafts).
 *   5. `AiDiffReview` shows the diff; the user clicks Approve to write the
 *      file via `vaultApi.writeFile`. No AI-side write ever happens.
 */

import { Settings2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { createAssistantRuntime } from '../assistant-client'
import { buildRegistryTemplateHints } from '../registry-hints'
import type { AssistantContext } from '../../../../shared/ai'
import type { SelectionRange } from '../../../../shared/ai'

import { AiComposer } from './AiComposer'
import { AiContextBanner } from './AiContextBanner'
import { AiDiffReview, type DiffReviewModel } from './AiDiffReview'
import { AiMessageList, type ChatMessage } from './AiMessageList'
import { applyEvent } from '../state/apply-event'
import { AiSettingsPanel } from './AiSettingsPanel'

interface AiSidePanelProps {
  noteRelativePath: string | null
  noteTitle: string
  noteContent: string
  selection: SelectionRange | null
  backlinks: ReadonlyArray<{ relativePath: string; display: string }>
  onWriteFile: (relativePath: string, content: string) => Promise<void>
  onRequestActionPalette?: () => void
}

const runtime = createAssistantRuntime()

interface StreamingState {
  sessionId: string | null
  busy: boolean
  messages: ChatMessage[]
  toolCalls: ReturnType<typeof applyEvent> extends infer R
    ? R extends { toolCalls: infer T }
      ? T
      : never
    : never
  tokenBuffer: string
  proposal: import('../../../../shared/ai').PatchProposal | null
  error: { message: string; code?: string } | null
  diff: DiffReviewModel | null
  draftFiles: Array<{ relativePath: string; content: string }> | null
}

const INITIAL_STREAMING: StreamingState = {
  sessionId: null,
  busy: false,
  messages: [],
  toolCalls: [],
  tokenBuffer: '',
  proposal: null,
  error: null,
  diff: null,
  draftFiles: null
}

export function AiSidePanel({
  noteRelativePath,
  noteTitle,
  noteContent,
  selection,
  backlinks,
  onWriteFile,
  onRequestActionPalette
}: AiSidePanelProps): React.JSX.Element {
  const [settings, setSettings] = useState<import('../../../../shared/ai').AiPublicSettings | null>(
    null
  )
  const [streaming, setStreaming] = useState<StreamingState>(INITIAL_STREAMING)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const registryHints = useMemo(() => buildRegistryTemplateHints(), [])

  useEffect(() => {
    let cancelled = false
    void runtime
      .getSettings()
      .then((result) => {
        if (!cancelled) {
          setSettings(result)
          if (result.provider === 'none' || !result.hasApiKey) {
            setSettingsOpen(true)
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSettingsOpen(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleProposal = useCallback(
    async (proposal: import('../../../../shared/ai').PatchProposal) => {
      if (!noteRelativePath) {
        setStreaming((current) => ({
          ...current,
          busy: false,
          error: { message: 'No note open — cannot preview patch.', code: 'NO_NOTE' }
        }))
        return
      }

      try {
        const response = await runtime.applyPatch({
          noteRelativePath,
          operations: proposal.patches
        })

        const textResult = response.results.find(
          (result): result is Extract<typeof result, { kind: 'textPatch' | 'interactiveInsert' }> =>
            result.kind === 'textPatch' || result.kind === 'interactiveInsert'
        )
        const draftResult = response.results.find(
          (result): result is Extract<typeof result, { kind: 'componentDraft' }> =>
            result.kind === 'componentDraft'
        )

        if (textResult) {
          setStreaming((current) => ({
            ...current,
            busy: false,
            diff: {
              before: noteContent,
              after: textResult.resultText,
              fileLabel: noteRelativePath
            },
            draftFiles: null
          }))
          return
        }

        if (draftResult) {
          setStreaming((current) => ({
            ...current,
            busy: false,
            draftFiles: draftResult.files,
            diff: null
          }))
          return
        }

        setStreaming((current) => ({
          ...current,
          busy: false,
          error: { message: 'Patch proposal did not produce any previewable result.' }
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStreaming((current) => ({
          ...current,
          busy: false,
          error: { message, code: 'PATCH_APPLY_FAILED' }
        }))
      }
    },
    [noteContent, noteRelativePath]
  )

  useEffect(() => {
    unsubscribeRef.current?.()
    const unsubscribe = runtime.onSessionEvent((sessionId, event) => {
      setStreaming((current) => {
        if (current.sessionId !== sessionId) {
          return current
        }

        if (event.type === 'done') {
          return {
            ...current,
            busy: false
          }
        }

        if (event.type === 'patch-proposal') {
          void handleProposal(event.proposal).catch((error: unknown) => {
            setStreaming((prev) => ({
              ...prev,
              busy: false,
              error: {
                message: error instanceof Error ? error.message : String(error),
                code: 'AI_PATCH_PREVIEW'
              }
            }))
          })
          return {
            ...current,
            proposal: event.proposal
          }
        }

        if (event.type === 'error') {
          return {
            ...current,
            error: { message: event.message, ...(event.code ? { code: event.code } : {}) }
          }
        }

        const next = applyEvent(current, event, () => {})
        return { ...current, ...next }
      })
    })
    unsubscribeRef.current = unsubscribe
    return () => {
      unsubscribe()
    }
  }, [handleProposal])

  const send = useCallback(
    async (actionId: string, userMessage: string) => {
      if (!noteRelativePath) return

      const context: AssistantContext = runtime.buildContext({
        noteRelativePath,
        noteTitle,
        noteContent,
        selection,
        backlinks,
        registryTemplateHints: registryHints
      })

      const userMessageEntry: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: userMessage
      }

      setStreaming({
        sessionId: null,
        busy: true,
        messages: [userMessageEntry],
        toolCalls: [],
        tokenBuffer: '',
        proposal: null,
        error: null,
        diff: null,
        draftFiles: null
      })

      try {
        const { sessionId } = await runtime.startChat({
          context,
          actionId,
          userMessage
        })
        setStreaming((current) => ({ ...current, sessionId }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStreaming((current) => ({
          ...current,
          busy: false,
          error: { message, code: 'AI_CHAT_START' }
        }))
      }
    },
    [backlinks, noteContent, noteRelativePath, noteTitle, registryHints, selection]
  )

  const cancel = useCallback(async () => {
    const id = streaming.sessionId
    if (!id) return
    try {
      await runtime.cancelChat(id)
    } finally {
      setStreaming((current) => ({ ...current, busy: false, sessionId: null }))
    }
  }, [streaming.sessionId])

  const approve = useCallback(async () => {
    if (!noteRelativePath) return

    if (streaming.diff) {
      await onWriteFile(noteRelativePath, streaming.diff.after)
      setStreaming(INITIAL_STREAMING)
      return
    }

    if (streaming.draftFiles) {
      for (const file of streaming.draftFiles) {
        await onWriteFile(file.relativePath, file.content)
      }
      setStreaming(INITIAL_STREAMING)
    }
  }, [noteRelativePath, onWriteFile, streaming.diff, streaming.draftFiles])

  const reject = useCallback(() => {
    setStreaming(INITIAL_STREAMING)
  }, [])

  const sendPrompt = useCallback(
    (message: string) => {
      void send('open-chat', message)
    },
    [send]
  )

  const settingsState = settings ?? {
    version: 1 as const,
    provider: 'none' as const,
    model: 'gpt-4o-mini',
    hasApiKey: false,
    safeStorageAvailable: false
  }

  const canSend =
    !!noteRelativePath && settingsState.hasApiKey && settingsState.safeStorageAvailable

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b-2 border-foreground px-3 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-[var(--editorial-red)]" aria-hidden="true" />
          AI assistant
        </div>
        <div className="flex items-center gap-1">
          {selection ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onRequestActionPalette}
              aria-label="Ask about selection"
              title="Ask about the current selection"
              className="size-6"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            aria-label="Assistant settings"
            title="Assistant settings"
            className={cn(
              'size-6',
              (!settingsState.hasApiKey || !settingsState.safeStorageAvailable) &&
                'text-destructive'
            )}
          >
            <Settings2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <AiContextBanner
        noteRelativePath={noteRelativePath}
        noteTitle={noteTitle}
        selection={selection}
        hasApiKey={settingsState.hasApiKey}
        safeStorageAvailable={settingsState.safeStorageAvailable}
      />

      <AiMessageList
        messages={streaming.messages}
        toolCalls={streaming.toolCalls}
        proposal={streaming.proposal}
        error={streaming.error}
        streaming={streaming.busy}
      />

      <AiDiffReview
        model={streaming.diff}
        onApprove={() => void approve()}
        onReject={reject}
        busy={streaming.busy}
      />

      {streaming.draftFiles ? (
        <DraftFilesList
          files={streaming.draftFiles}
          onApprove={() => void approve()}
          onReject={reject}
          busy={streaming.busy}
        />
      ) : null}

      <AiComposer
        disabled={!canSend}
        busy={streaming.busy}
        onSend={sendPrompt}
        onCancel={() => void cancel()}
      />

      <AiSettingsPanel
        key={settingsOpen ? 'open' : 'closed'}
        open={settingsOpen}
        settings={settingsState}
        onClose={() => setSettingsOpen(false)}
        onSaved={(next) => setSettings(next)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Draft files list                              */
/* -------------------------------------------------------------------------- */

function DraftFilesList({
  files,
  onApprove,
  onReject,
  busy
}: {
  files: Array<{ relativePath: string; content: string }>
  onApprove: () => void
  onReject: () => void
  busy: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 border-t-2 border-foreground bg-muted/20 px-3 py-2">
      <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
        New interactive component ({files.length} files)
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {files.map((file) => (
          <li key={file.relativePath} className="truncate font-mono">
            {file.relativePath}
          </li>
        ))}
      </ul>
      <div className="text-xs text-muted-foreground">
        Component will live in your vault as a sandboxed interactive (Level 3/4). It is never
        injected into the trusted registry.
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onReject} disabled={busy}>
          Reject
        </Button>
        <Button type="button" size="sm" onClick={onApprove} disabled={busy}>
          Approve &amp; write
        </Button>
      </div>
    </div>
  )
}
