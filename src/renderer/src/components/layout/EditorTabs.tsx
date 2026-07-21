import { FileWarning, X } from 'lucide-react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { deriveNoteTitle } from '@/lib/note-title'
import { cn } from '@/lib/utils'
import type { WorkbenchItem } from '@/workbench/types'

export interface EditorTabsProps {
  items: WorkbenchItem[]
  activeId: string | null
  onActivate: (id: string) => void
  onClose: (id: string) => unknown
}

interface TabPresentation {
  label: string
  directory: string
  showDirectory: boolean
}

interface PendingFocusAfterClose {
  closingId: string
  fallbackIds: string[]
}

/**
 * A manual-activation tablist. Moving through the strip never loads a file;
 * Enter or Space performs the activation. This keeps tab navigation distinct
 * from the workbench's visual-order and MRU actions.
 */
export function EditorTabs({
  items,
  activeId,
  onActivate,
  onClose
}: EditorTabsProps): React.JSX.Element | null {
  const tablistRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocusAfterCloseRef = useRef<PendingFocusAfterClose | null>(null)
  const previousActiveIdRef = useRef(activeId)
  const [focusableId, setFocusableId] = useState<string | null>(
    () => activeId ?? items[0]?.id ?? null
  )

  const presentations = useMemo(() => createTabPresentations(items), [items])
  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items])
  const rovingId = itemIds.has(focusableId ?? '')
    ? focusableId
    : activeId && itemIds.has(activeId)
      ? activeId
      : (items[0]?.id ?? null)

  useLayoutEffect(() => {
    const pendingFocus = pendingFocusAfterCloseRef.current
    const activeChanged = previousActiveIdRef.current !== activeId
    previousActiveIdRef.current = activeId

    if (pendingFocus && !itemIds.has(pendingFocus.closingId)) {
      pendingFocusAfterCloseRef.current = null
      const targetId = [activeId, ...pendingFocus.fallbackIds].find(
        (candidateId): candidateId is string => Boolean(candidateId && itemIds.has(candidateId))
      )

      setFocusableId(targetId ?? null)
      if (targetId) {
        tabRefs.current.get(targetId)?.focus({ preventScroll: true })
      }
      return
    }

    if (activeChanged && activeId && itemIds.has(activeId)) {
      if (focusableId !== activeId) {
        setFocusableId(activeId)
      }
      tabRefs.current.get(activeId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      return
    }

    if (!focusableId || !itemIds.has(focusableId)) {
      setFocusableId(rovingId)
    }
  }, [activeId, focusableId, itemIds, rovingId])

  const focusTab = useCallback((id: string) => {
    setFocusableId(id)
    tabRefs.current.get(id)?.focus({ preventScroll: true })
  }, [])

  const moveFocus = useCallback(
    (currentId: string, destination: 'previous' | 'next' | 'first' | 'last') => {
      const currentIndex = items.findIndex((item) => item.id === currentId)
      if (currentIndex < 0 || items.length === 0) {
        return
      }

      let targetIndex = currentIndex
      if (destination === 'first') {
        targetIndex = 0
      } else if (destination === 'last') {
        targetIndex = items.length - 1
      } else if (destination === 'previous') {
        targetIndex = (currentIndex - 1 + items.length) % items.length
      } else {
        targetIndex = (currentIndex + 1) % items.length
      }

      const targetId = items[targetIndex]?.id
      if (targetId) {
        focusTab(targetId)
      }
    },
    [focusTab, items]
  )

  const requestClose = useCallback(
    (id: string) => {
      if (tablistRef.current?.contains(document.activeElement)) {
        const closingIndex = items.findIndex((item) => item.id === id)
        const nextId = items[closingIndex + 1]?.id
        const previousId = items[closingIndex - 1]?.id
        pendingFocusAfterCloseRef.current = {
          closingId: id,
          fallbackIds: [nextId, previousId].filter((candidate): candidate is string =>
            Boolean(candidate)
          )
        }
      }

      const closeResult = onClose(id)
      if (isPromiseLike(closeResult)) {
        void Promise.resolve(closeResult).finally(() => {
          const pendingFocus = pendingFocusAfterCloseRef.current
          if (pendingFocus?.closingId === id && tabRefs.current.has(id)) {
            pendingFocusAfterCloseRef.current = null
          }
        })
      }
    },
    [items, onClose]
  )

  if (items.length === 0) {
    return null
  }

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label="Open files"
      aria-orientation="horizontal"
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-[var(--line)] bg-chrome [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => (
        <EditorTab
          key={item.id}
          ref={(element) => {
            if (element) {
              tabRefs.current.set(item.id, element)
            } else {
              tabRefs.current.delete(item.id)
            }
          }}
          item={item}
          presentation={presentations.get(item.id) ?? createTabPresentation(item, false)}
          isActive={item.id === activeId}
          isFocusable={item.id === rovingId}
          onActivate={onActivate}
          onClose={requestClose}
          onFocus={setFocusableId}
          onMoveFocus={moveFocus}
        />
      ))}
    </div>
  )
}

interface EditorTabProps {
  ref: (element: HTMLButtonElement | null) => void
  item: WorkbenchItem
  presentation: TabPresentation
  isActive: boolean
  isFocusable: boolean
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onFocus: (id: string) => void
  onMoveFocus: (id: string, destination: 'previous' | 'next' | 'first' | 'last') => void
}

function EditorTab({
  ref,
  item,
  presentation,
  isActive,
  isFocusable,
  onActivate,
  onClose,
  onFocus,
  onMoveFocus
}: EditorTabProps): React.JSX.Element {
  const { label, directory, showDirectory } = presentation
  const accessibleLabel = [
    label,
    showDirectory ? directory : null,
    item.dirty ? 'unsaved changes' : null,
    item.missing ? 'missing from vault' : null
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      role="presentation"
      className={cn(
        'group relative flex max-w-56 min-w-0 shrink-0 items-stretch border-r border-[var(--line)] transition-colors motion-reduce:transition-none',
        isActive
          ? 'bg-background text-foreground'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
        item.missing && 'text-muted-foreground'
      )}
      onAuxClick={(event) => {
        if (event.button === 1) {
          event.preventDefault()
          onClose(item.id)
        }
      }}
    >
      {isActive ? (
        <span
          className="absolute inset-x-0 top-0 h-0.5 bg-[var(--editorial-red)]"
          aria-hidden="true"
        />
      ) : null}

      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-label={accessibleLabel}
        tabIndex={isFocusable ? 0 : -1}
        title={item.relativePath}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-0.5 pl-2.5 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
        onClick={() => onActivate(item.id)}
        onFocus={() => onFocus(item.id)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) {
            return
          }

          switch (event.key) {
            case 'ArrowLeft':
              event.preventDefault()
              onMoveFocus(item.id, 'previous')
              break
            case 'ArrowRight':
              event.preventDefault()
              onMoveFocus(item.id, 'next')
              break
            case 'Home':
              event.preventDefault()
              onMoveFocus(item.id, 'first')
              break
            case 'End':
              event.preventDefault()
              onMoveFocus(item.id, 'last')
              break
            case 'Enter':
            case ' ':
              event.preventDefault()
              if (!event.repeat) {
                onActivate(item.id)
              }
              break
            case 'Delete':
              event.preventDefault()
              event.stopPropagation()
              onClose(item.id)
              break
            default:
              break
          }
        }}
      >
        {item.missing ? (
          <FileWarning className="size-3 shrink-0 text-[var(--editorial-red)]" aria-hidden="true" />
        ) : null}
        <span className={cn('truncate font-mono text-[11px]', isActive && 'font-bold')}>
          {label}
        </span>
        {showDirectory ? (
          <span
            className="max-w-24 truncate font-mono text-[9px] text-muted-foreground"
            aria-hidden="true"
          >
            /{directory}
          </span>
        ) : null}
        {item.dirty ? (
          <span
            className="size-1.5 shrink-0 bg-[var(--editorial-red)]"
            title="Unsaved changes"
            aria-hidden="true"
          />
        ) : null}
      </button>

      <button
        type="button"
        tabIndex={-1}
        aria-label={`Close ${accessibleLabel}`}
        title={`Close ${label}`}
        className={cn(
          'my-auto mr-1.5 ml-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center outline-none transition-opacity hover:bg-foreground hover:text-background focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none',
          !isActive && 'opacity-0 group-hover:opacity-100'
        )}
        onClick={(event) => {
          event.stopPropagation()
          onClose(item.id)
        }}
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </div>
  )
}

function createTabPresentations(items: WorkbenchItem[]): Map<string, TabPresentation> {
  const labelCounts = new Map<string, number>()
  for (const item of items) {
    const labelKey = deriveNoteTitle(item.relativePath).toLocaleLowerCase()
    labelCounts.set(labelKey, (labelCounts.get(labelKey) ?? 0) + 1)
  }

  return new Map(
    items.map((item) => {
      const labelKey = deriveNoteTitle(item.relativePath).toLocaleLowerCase()
      return [item.id, createTabPresentation(item, (labelCounts.get(labelKey) ?? 0) > 1)]
    })
  )
}

function createTabPresentation(item: WorkbenchItem, showDirectory: boolean): TabPresentation {
  const normalizedPath = item.relativePath.replaceAll('\\', '/')
  const pathSegments = normalizedPath.split('/')
  const directory = pathSegments.slice(0, -1).join('/') || 'vault root'

  return {
    label: deriveNoteTitle(normalizedPath),
    directory,
    showDirectory
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}
