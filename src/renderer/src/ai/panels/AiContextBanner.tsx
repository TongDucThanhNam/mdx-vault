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
    <div className="flex flex-col gap-1 border-b-2 border-foreground bg-muted/20 px-3 py-2 font-mono text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
        <FileText className="size-3.5 shrink-0" aria-hidden="true" />
        <span
          className="max-w-[55%] shrink-0 truncate font-bold text-foreground"
          title={noteRelativePath ? noteTitle : undefined}
        >
          {noteRelativePath ? noteTitle : 'No note open'}
        </span>
        {noteRelativePath ? (
          <span className="min-w-0 truncate text-muted-foreground" title={noteRelativePath}>
            — {noteRelativePath}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {selection ? (
          <span className="inline-flex max-w-full items-center gap-1 whitespace-nowrap">
            <Pin className="size-3" aria-hidden="true" />
            Selection {selection.startLine}:{selection.startColumn}–{selection.endLine}:
            {selection.endColumn}
          </span>
        ) : (
          <span className="whitespace-nowrap">No selection</span>
        )}
        <span className="ml-auto inline-flex max-w-full items-center gap-1 whitespace-nowrap">
          <Sparkles className="size-3" aria-hidden="true" />
          {hasApiKey ? (
            safeStorageAvailable ? (
              'Ready'
            ) : (
              <span className="text-destructive">Secure storage unavailable</span>
            )
          ) : safeStorageAvailable ? (
            'API key needed'
          ) : (
            <span className="text-destructive">Secure storage unavailable</span>
          )}
        </span>
      </div>
    </div>
  )
}
