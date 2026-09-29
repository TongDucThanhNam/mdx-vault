import { FileCode2, FileQuestion, FileText, Image as ImageIcon, Plus, Search } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import type { IndexedNoteSummary, VaultTreeFile } from '@/vault/types'
import { containDialogTabKey } from '@/workbench/dialog-focus'
import {
  canOfferCreateMdxNote,
  type FileFinderResult,
  getFileFinderModel,
  resolveFileFinderSelection
} from '@/workbench/file-finder'
import type { WorkbenchItemKind } from '@/workbench/types'

export interface QuickSwitcherProps {
  open: boolean
  /** Null represents the intentional no-vault state; an empty array is an open, empty vault. */
  files: readonly VaultTreeFile[] | null
  notes: readonly IndexedNoteSummary[]
  /** Open workbench items in MRU order. */
  openItemIds: readonly string[]
  /** Current-vault-session recents, most recent first. */
  recentItemIds: readonly string[]
  onOpenChange: (open: boolean) => void
  /** False keeps the finder open and leaves the current workbench item untouched. */
  onSelectFile: (relativePath: string) => Promise<boolean>
  /** Creation remains an explicit MDX-note operation, never an implicit file open. */
  onCreateNote: (query: string) => Promise<void>
}

type PendingAction = { kind: 'open'; relativePath: string } | { kind: 'create' } | null

export function QuickSwitcher({
  open,
  files,
  notes,
  openItemIds,
  recentItemIds,
  onOpenChange,
  onSelectFile,
  onCreateNote
}: QuickSwitcherProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const requestIdRef = useRef(0)
  const pendingRef = useRef(false)
  const instanceId = useId()
  const listboxId = `${instanceId}-file-listbox`
  const statusId = `${instanceId}-file-status`
  const errorId = `${instanceId}-file-error`
  const finder = useMemo(
    () =>
      getFileFinderModel({
        files,
        notes,
        query,
        openIds: openItemIds,
        recentIds: recentItemIds,
        limit: 50
      }),
    [files, notes, openItemIds, query, recentItemIds]
  )
  const trimmedQuery = query.trim()
  const canCreate = finder.status === 'ready' && canOfferCreateMdxNote(trimmedQuery, notes)
  const itemCount = finder.results.length + (canCreate ? 1 : 0)
  const activeIndex = Math.min(selectedIndex, Math.max(0, itemCount - 1))
  const activeOptionId = itemCount > 0 ? getOptionId(instanceId, activeIndex) : undefined
  const isPending = pendingAction !== null

  useEffect(() => {
    if (!open) {
      requestIdRef.current += 1
      pendingRef.current = false
      setQuery('')
      setSelectedIndex(0)
      setPendingAction(null)
      setError(null)
      return
    }

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)

    return () => window.clearTimeout(focusTimer)
  }, [open])

  useEffect(() => {
    if (!open || itemCount === 0) {
      return
    }

    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, itemCount, open, query])

  if (!open) {
    return null
  }

  const resetFinder = (): void => {
    requestIdRef.current += 1
    pendingRef.current = false
    setQuery('')
    setSelectedIndex(0)
    setPendingAction(null)
    setError(null)
  }

  const cancel = (): void => {
    resetFinder()
    onOpenChange(false)
  }

  const selectFile = async (relativePath: string): Promise<void> => {
    if (pendingRef.current) {
      return
    }

    const selection = resolveFileFinderSelection(relativePath, files)
    if (selection.status === 'no_vault') {
      setError('No vault is open. Open a vault before choosing a file.')
      return
    }

    if (selection.status === 'stale') {
      setError('That file is no longer in the vault. Refresh the finder and try again.')
      return
    }

    const requestId = ++requestIdRef.current
    pendingRef.current = true
    setPendingAction({ kind: 'open', relativePath })
    setError(null)

    try {
      const didOpen = await onSelectFile(relativePath)

      if (requestId !== requestIdRef.current) {
        return
      }

      if (!didOpen) {
        setError(`Could not open “${relativePath}”. Your current item is still active.`)
        return
      }

      resetFinder()
      onOpenChange(false)
    } catch (openError) {
      if (requestId === requestIdRef.current) {
        setError(formatError(openError, `Could not open “${relativePath}”.`))
      }
    } finally {
      if (requestId === requestIdRef.current) {
        pendingRef.current = false
        setPendingAction(null)
      }
    }
  }

  const createNote = async (): Promise<void> => {
    if (!canCreate || pendingRef.current) {
      return
    }

    const requestId = ++requestIdRef.current
    pendingRef.current = true
    setPendingAction({ kind: 'create' })
    setError(null)

    try {
      await onCreateNote(trimmedQuery)

      if (requestId !== requestIdRef.current) {
        return
      }

      resetFinder()
      onOpenChange(false)
    } catch (createError) {
      if (requestId === requestIdRef.current) {
        setError(formatError(createError, 'Could not create that MDX note.'))
      }
    } finally {
      if (requestId === requestIdRef.current) {
        pendingRef.current = false
        setPendingAction(null)
      }
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancel()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      inputRef.current?.focus()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex(Math.min(activeIndex + 1, Math.max(0, itemCount - 1)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex(Math.max(0, activeIndex - 1))
      return
    }

    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    if (isPending) {
      return
    }

    const result = finder.results[activeIndex]
    if (result) {
      void selectFile(result.relativePath)
      return
    }

    if (canCreate && activeIndex === finder.results.length) {
      void createNote()
    }
  }

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      cancel()
    }
  }

  const describedBy = [itemCount === 0 ? statusId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overscroll-contain bg-background/75 px-4 pt-[12vh]"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Open file"
        aria-busy={isPending}
        tabIndex={-1}
        className="w-full max-w-2xl overflow-hidden border-2 border-foreground bg-card shadow-[4px_4px_0_0_var(--foreground)]"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            event.stopPropagation()
            cancel()
          }
          containDialogTabKey(event, event.currentTarget)
        }}
      >
        <div className="flex h-12 items-center gap-2 border-b-2 border-foreground px-3 focus-within:ring-[3px] focus-within:ring-inset focus-within:ring-ring/50">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            name="file-finder-query"
            autoComplete="off"
            spellCheck={false}
            value={query}
            readOnly={isPending}
            role="combobox"
            aria-label="Search files by title, alias, path, or extension"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded="true"
            aria-activedescendant={activeOptionId}
            aria-describedby={describedBy || undefined}
            className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Open file by name, path, alias, or extension…"
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedIndex(0)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
          />
          <span className="shrink-0 border border-foreground/45 px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Esc
          </span>
        </div>

        <div className="max-h-[60vh] overflow-auto p-1.5">
          {finder.status === 'ready' && trimmedQuery && finder.results.length === 0 ? (
            <div className="px-3 py-2 font-mono text-xs text-muted-foreground" role="status">
              No matching files. Create a new MDX note below, or refine your search.
            </div>
          ) : null}
          <div id={listboxId} role="listbox" aria-label="Vault files">
            {finder.results.map((result, index) => (
              <FileFinderOption
                key={result.relativePath}
                ref={(element) => {
                  optionRefs.current[index] = element
                }}
                id={getOptionId(instanceId, index)}
                result={result}
                selected={index === activeIndex}
                pending={
                  pendingAction?.kind === 'open' &&
                  pendingAction.relativePath === result.relativePath
                }
                onMouseEnter={() => setSelectedIndex(index)}
                onSelect={() => void selectFile(result.relativePath)}
              />
            ))}

            {canCreate ? (
              <button
                ref={(element) => {
                  optionRefs.current[finder.results.length] = element
                }}
                id={getOptionId(instanceId, finder.results.length)}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={activeIndex === finder.results.length}
                aria-disabled={isPending}
                className={cn(
                  'group flex min-h-14 w-full items-center gap-3 border-t border-[var(--line)] px-3 py-2 text-left transition-colors hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
                  activeIndex === finder.results.length && 'bg-foreground text-background',
                  isPending && 'cursor-wait'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setSelectedIndex(finder.results.length)}
                onClick={() => void createNote()}
              >
                <Plus
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-current"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {pendingAction?.kind === 'create'
                      ? 'Creating MDX note…'
                      : `Create “${trimmedQuery}”`}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground group-hover:text-current">
                    Explicit note creation · Markdown with native MDX
                  </span>
                </span>
                <OptionLedger extension=".mdx" state="create" />
              </button>
            ) : null}
          </div>

          {itemCount === 0 ? (
            <div
              id={statusId}
              className="px-3 py-10 text-center font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground"
              role="status"
            >
              {getEmptyMessage(finder.status, trimmedQuery)}
            </div>
          ) : null}

          {error ? (
            <div
              id={errorId}
              className="mx-2 my-1 border-l-2 border-destructive px-3 py-2 font-mono text-xs text-destructive"
              role="alert"
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-2 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          <span>{finder.status === 'ready' ? `${finder.results.length} files` : 'No vault'}</span>
          <span>↑↓ Navigate · Enter Open · Esc Cancel</span>
        </div>
      </div>
    </div>
  )
}

interface FileFinderOptionProps {
  ref: (element: HTMLButtonElement | null) => void
  id: string
  result: FileFinderResult
  selected: boolean
  pending: boolean
  onMouseEnter: () => void
  onSelect: () => void
}

function FileFinderOption({
  ref,
  id,
  result,
  selected,
  pending,
  onMouseEnter,
  onSelect
}: FileFinderOptionProps): React.JSX.Element {
  const aliasLabel = result.matchedAlias ?? result.aliases[0]

  return (
    <button
      ref={ref}
      id={id}
      type="button"
      data-page-preview-path={result.kind === 'note' ? result.relativePath : undefined}
      role="option"
      tabIndex={-1}
      aria-selected={selected}
      className={cn(
        'group relative flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
        selected &&
          'bg-foreground text-background before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-primary'
      )}
      title={result.relativePath}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={onMouseEnter}
      onClick={onSelect}
    >
      <FileKindIcon kind={result.kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{result.title}</span>
        <span className="block truncate font-mono text-xs text-muted-foreground group-hover:text-current">
          {result.relativePath}
        </span>
        {aliasLabel ? (
          <span className="block truncate font-mono text-xs text-muted-foreground group-hover:text-current">
            Alias: {aliasLabel}
          </span>
        ) : null}
      </span>
      <OptionLedger
        extension={result.extension || 'file'}
        state={pending ? 'opening' : getResultState(result)}
      />
    </button>
  )
}

function FileKindIcon({ kind }: { kind: WorkbenchItemKind }): React.JSX.Element {
  const iconClassName = 'size-4 shrink-0 text-muted-foreground group-hover:text-current'

  if (kind === 'note') {
    return <FileText className={iconClassName} aria-hidden="true" />
  }

  if (kind === 'text') {
    return <FileCode2 className={iconClassName} aria-hidden="true" />
  }

  if (kind === 'image') {
    return <ImageIcon className={iconClassName} aria-hidden="true" />
  }

  return <FileQuestion className={iconClassName} aria-hidden="true" />
}

function OptionLedger({
  extension,
  state
}: {
  extension: string
  state: string
}): React.JSX.Element {
  const extensionLabel = extension.replace(/^\./u, '') || 'file'

  return (
    <span className="ml-2 flex shrink-0 flex-col items-end gap-1 font-mono uppercase">
      <span className="border border-current/45 px-1.5 py-0.5 text-xs tracking-[0.12em]">
        {extensionLabel}
      </span>
      <span className="max-w-20 truncate text-xs tracking-[0.1em] opacity-70">{state}</span>
    </span>
  )
}

function getResultState(result: FileFinderResult): string {
  if (result.isOpen) {
    return 'open'
  }

  if (result.isRecent) {
    return 'recent'
  }

  return result.matchKind === 'empty' ? result.kind : result.matchKind
}

function getOptionId(instanceId: string, index: number): string {
  return `${instanceId}-file-option-${index}`
}

function getEmptyMessage(status: 'no_vault' | 'ready', query: string): string {
  if (status === 'no_vault') {
    return 'Open a vault to search files.'
  }

  if (!query) {
    return 'No files in this vault. Type a note name to create an MDX note.'
  }

  return 'No files match this query.'
}

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
