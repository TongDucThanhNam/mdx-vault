/**
 * `AiComposer` — the chat input bar.
 *
 * Disables the send button when there's no note or no API key, so the
 * user gets clear feedback rather than a session that just fails.
 */

import { Send, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AiComposerProps {
  disabled: boolean
  busy: boolean
  placeholder?: string
  onSend: (message: string) => void
  onCancel: () => void
}

export function AiComposer({
  disabled,
  busy,
  placeholder,
  onSend,
  onCancel
}: AiComposerProps): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const submit = useCallback(() => {
    const value = draft.trim()
    if (!value || disabled || busy) {
      return
    }
    onSend(value)
    setDraft('')
  }, [draft, disabled, busy, onSend])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        submit()
      }
    },
    [submit]
  )

  return (
    <div className="flex items-end gap-2 border-t bg-background px-3 py-2">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={2}
        placeholder={
          placeholder ??
          (disabled
            ? 'Select a note to chat about it…'
            : 'Ask the assistant. Enter sends, Shift+Enter inserts a newline.')
        }
        className={cn(
          'min-h-9 w-full resize-none rounded-md border bg-background px-2 py-1.5 text-sm outline-none',
          'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
          'disabled:cursor-not-allowed disabled:opacity-60'
        )}
      />
      {busy ? (
        <Button type="button" size="icon-sm" variant="outline" onClick={onCancel}>
          <Square className="size-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button
          type="button"
          size="icon-sm"
          onClick={submit}
          disabled={disabled || draft.trim().length === 0}
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
