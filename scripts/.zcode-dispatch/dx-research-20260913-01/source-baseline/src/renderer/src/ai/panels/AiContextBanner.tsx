/**
 * `AiContextBanner` — what the model currently sees.
 *
 * Renders the note path, selection (if any), and any active proposal/tool
 * activity. Designed to be compact and informative; it never shows the API
 * key (the runtime never has it in plaintext anyway).
 */

import { FileText, Pin, Sparkles } from 'lucide-react'

import type { SelectionRange } from '../../../../shared/ai'

interface AiContextBannerProps {
  noteRelativePath: string | null
  noteTitle: string
  selection: SelectionRange | null
  hasApiKey: boolean
  safeStorageAvailable: boolean
}

export function AiContextBanner({
  noteRelativePath,
  noteTitle,
  selection,
  hasApiKey,
  safeStorageAvailable
}: AiContextBannerProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 border-b-2 border-foreground bg-muted/20 px-3 py-2 font-mono text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1.5 truncate">
        <FileText className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate font-bold text-foreground">
          {noteRelativePath ? noteTitle : 'No note open'}
        </span>
        {noteRelativePath ? (
          <span className="truncate text-muted-foreground">— {noteRelativePath}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {selection ? (
          <span className="inline-flex items-center gap-1">
            <Pin className="size-3" aria-hidden="true" />
            Selection {selection.startLine}:{selection.startColumn}–{selection.endLine}:
            {selection.endColumn}
          </span>
        ) : (
          <span>No selection</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <Sparkles className="size-3" aria-hidden="true" />
          {hasApiKey ? (
            safeStorageAvailable ? (
              'Ready'
            ) : (
              <span className="text-destructive">
                safeStorage unavailable — key cannot be stored
              </span>
            )
          ) : safeStorageAvailable ? (
            'Add an API key in settings to start'
          ) : (
            <span className="text-destructive">safeStorage unavailable</span>
          )}
        </span>
      </div>
    </div>
  )
}
