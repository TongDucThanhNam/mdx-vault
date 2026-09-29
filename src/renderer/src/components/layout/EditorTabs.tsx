import { FileWarning, Waypoints, X } from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { displayFileName } from '@/explorer/file-label'
import { cn } from '@/lib/utils'
import { focusActiveDocument } from '@/workbench/document-focus'
import {
  deriveTabContextCloseTargets,
  runTabFileAction,
  type TabContextCloseTargets
} from '@/workbench/tab-context-actions'
import type { WorkbenchItem } from '@/workbench/types'

export interface EditorTabsProps {
  items: WorkbenchItem[]
  activeId: string | null
  showFileExtensions: boolean
  visiblePaths: readonly string[]
  onActivate: (id: string) => void
  onClose: (id: string) => Promise<boolean>
  onCloseItems: (ids: readonly string[]) => Promise<boolean>
  onCopyPath: (relativePath: string) => void
  onCopyRelativePath: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
  closeShortcut?: string
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
  showFileExtensions,
  visiblePaths,
  onActivate,
  onClose,
  onCloseItems,
  onCopyPath,
  onCopyRelativePath,
  onRevealInExplorer,
  closeShortcut
}: EditorTabsProps): React.JSX.Element | null {
  const tablistRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  const pendingFocusAfterCloseRef = useRef<PendingFocusAfterClose | null>(null)
  const previousActiveIdRef = useRef(activeId)
  const [focusableId, setFocusableId] = useState<string | null>(
    () => activeId ?? items[0]?.id ?? null
  )

  const presentations = useMemo(
    () => createTabPresentations(items, showFileExtensions, visiblePaths),
    [items, showFileExtensions, visiblePaths]
  )
  const closeTargets = useMemo(
    () =>
      new Map(
        items.map((item) => [item.id, deriveTabContextCloseTargets(items, item.id)] as const)
      ),
    [items]
  )
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

      void onClose(id).finally(() => {
        const pendingFocus = pendingFocusAfterCloseRef.current
        if (pendingFocus?.closingId === id && tabRefs.current.has(id)) {
          pendingFocusAfterCloseRef.current = null
        }
      })
    },
    [items, onClose]
  )

  const restoreContextMenuFocus = useCallback((preferredId: string) => {
    window.requestAnimationFrame(() => {
      if (
        document.querySelector(
          '[aria-modal="true"], [data-slot="dialog-content"], [data-slot="alert-dialog-content"]'
        )
      ) {
        return
      }

      const preferredTab = tabRefs.current.get(preferredId)
      const activeTab = tablistRef.current?.querySelector<HTMLButtonElement>(
        '[role="tab"][aria-selected="true"]'
      )
      const fallbackTab = tablistRef.current?.querySelector<HTMLButtonElement>('[role="tab"]')
      const destination = preferredTab?.isConnected ? preferredTab : (activeTab ?? fallbackTab)

      if (destination?.isConnected) {
        setFocusableId(destination.dataset.tabId ?? null)
        destination.focus({ preventScroll: true })
        return
      }

      focusActiveDocument()
    })
  }, [])

  const requestContextMenuClose = useCallback(
    async (ids: readonly string[], preferredFocusId: string): Promise<boolean> => {
      try {
        return await onCloseItems(ids)
      } finally {
        restoreContextMenuFocus(preferredFocusId)
      }
    },
    [onCloseItems, restoreContextMenuFocus]
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
      className="flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-border/60 bg-chrome [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
          presentation={
            presentations.get(item.id) ??
            createTabPresentation(item, false, showFileExtensions, visiblePaths)
          }
          closeTargets={closeTargets.get(item.id) ?? deriveTabContextCloseTargets(items, item.id)}
          isActive={item.id === activeId}
          isFocusable={item.id === rovingId}
          onActivate={onActivate}
          onClose={requestClose}
          onCloseItems={requestContextMenuClose}
          onCopyPath={onCopyPath}
          onCopyRelativePath={onCopyRelativePath}
          onRevealInExplorer={onRevealInExplorer}
          onRestoreContextMenuFocus={restoreContextMenuFocus}
          onFocus={setFocusableId}
          onMoveFocus={moveFocus}
          closeShortcut={closeShortcut}
        />
      ))}
    </div>
  )
}

interface EditorTabProps {
  ref: (element: HTMLButtonElement | null) => void
  item: WorkbenchItem
  presentation: TabPresentation
  closeTargets: TabContextCloseTargets
  isActive: boolean
  isFocusable: boolean
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onCloseItems: (ids: readonly string[], preferredFocusId: string) => Promise<boolean>
  onCopyPath: (relativePath: string) => void
  onCopyRelativePath: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
  onRestoreContextMenuFocus: (preferredId: string) => void
  onFocus: (id: string) => void
  onMoveFocus: (id: string, destination: 'previous' | 'next' | 'first' | 'last') => void
  closeShortcut?: string
}

function EditorTab({
  ref,
  item,
  presentation,
  closeTargets,
  isActive,
  isFocusable,
  onActivate,
  onClose,
  onCloseItems,
  onCopyPath,
  onCopyRelativePath,
  onRevealInExplorer,
  onRestoreContextMenuFocus,
  onFocus,
  onMoveFocus,
  closeShortcut
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
    <ContextMenuPrimitive.Root>
      <div
        role="presentation"
        className={cn(
          'group relative flex max-w-56 min-w-0 shrink-0 items-stretch border-r border-[var(--line)] transition-colors motion-reduce:transition-none',
          isActive
            ? 'bg-card text-foreground'
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
          <span className="absolute inset-x-0 top-0 h-0.5 bg-instrument-blue" aria-hidden="true" />
        ) : null}

        <ContextMenuPrimitive.Trigger asChild>
          <button
            ref={ref}
            type="button"
            role="tab"
            data-tab-id={item.id}
            aria-selected={isActive}
            aria-label={accessibleLabel}
            tabIndex={isFocusable ? 0 : -1}
            title={item.kind === 'graph' ? 'Global Graph' : item.relativePath}
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
            {item.kind === 'graph' ? (
              <Waypoints className="size-3 shrink-0" aria-hidden="true" />
            ) : item.missing ? (
              <FileWarning
                className="size-3 shrink-0 text-[var(--editorial-red)]"
                aria-hidden="true"
              />
            ) : null}
            <span className={cn('truncate font-sans text-[13px]', isActive && 'font-semibold')}>
              {label}
            </span>
            {showDirectory ? (
              <span
                className="max-w-24 truncate font-sans text-xs text-muted-foreground"
                aria-hidden="true"
              >
                /{directory}
              </span>
            ) : null}
            {item.dirty ? (
              <span
                className="size-1.5 shrink-0 rounded-full bg-signal"
                title="Unsaved changes"
                aria-hidden="true"
              />
            ) : null}
          </button>
        </ContextMenuPrimitive.Trigger>

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

      <EditorTabContextMenu
        item={item}
        label={label}
        closeTargets={closeTargets}
        closeShortcut={closeShortcut}
        onCloseItems={onCloseItems}
        onCopyPath={onCopyPath}
        onCopyRelativePath={onCopyRelativePath}
        onRevealInExplorer={onRevealInExplorer}
        onRestoreFocus={onRestoreContextMenuFocus}
      />
    </ContextMenuPrimitive.Root>
  )
}

interface EditorTabContextMenuProps {
  item: WorkbenchItem
  label: string
  closeTargets: TabContextCloseTargets
  closeShortcut?: string
  onCloseItems: (ids: readonly string[], preferredFocusId: string) => Promise<boolean>
  onCopyPath: (relativePath: string) => void
  onCopyRelativePath: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
  onRestoreFocus: (preferredId: string) => void
}

function EditorTabContextMenu({
  item,
  label,
  closeTargets,
  closeShortcut,
  onCloseItems,
  onCopyPath,
  onCopyRelativePath,
  onRevealInExplorer,
  onRestoreFocus
}: EditorTabContextMenuProps): React.JSX.Element {
  const restoreFocusAfterCloseRef = useRef(false)

  const close = (ids: readonly string[]): void => {
    restoreFocusAfterCloseRef.current = true
    void onCloseItems(ids, item.id)
  }

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        aria-label={`Tab actions for ${label}`}
        data-slot="tab-context-menu-content"
        collisionPadding={8}
        loop
        className="z-[100] min-w-56 border-2 border-foreground bg-popover p-1 font-mono text-xs text-popover-foreground shadow-[var(--shadow-hard)]"
        onKeyDown={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (restoreFocusAfterCloseRef.current) {
            restoreFocusAfterCloseRef.current = false
            return
          }
          onRestoreFocus(item.id)
        }}
      >
        <TabContextMenuItem
          label="Close"
          shortcut={closeShortcut}
          onSelect={() => close(closeTargets.current)}
        />
        <TabContextMenuItem
          label="Close Others"
          disabled={closeTargets.others.length === 0}
          onSelect={() => close(closeTargets.others)}
        />
        <TabContextMenuItem
          label="Close to the Left"
          disabled={closeTargets.left.length === 0}
          onSelect={() => close(closeTargets.left)}
        />
        <TabContextMenuItem
          label="Close to the Right"
          disabled={closeTargets.right.length === 0}
          onSelect={() => close(closeTargets.right)}
        />
        <TabContextMenuItem
          label="Close Saved"
          disabled={closeTargets.saved.length === 0}
          onSelect={() => close(closeTargets.saved)}
        />
        <TabContextMenuItem label="Close All" onSelect={() => close(closeTargets.all)} />

        {item.kind !== 'graph' ? (
          <>
            <ContextMenuPrimitive.Separator className="my-1 h-px bg-foreground" />

            <TabContextMenuItem
              label="Copy Path"
              onSelect={() => runTabFileAction(item, onCopyPath)}
            />
            <TabContextMenuItem
              label="Copy Relative Path"
              onSelect={() => runTabFileAction(item, onCopyRelativePath)}
            />

            <ContextMenuPrimitive.Separator className="my-1 h-px bg-foreground" />

            <TabContextMenuItem
              label="Reveal in File Explorer"
              disabled={item.missing}
              onSelect={() => runTabFileAction(item, onRevealInExplorer)}
            />
          </>
        ) : null}
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  )
}

function TabContextMenuItem({
  label,
  shortcut,
  disabled,
  onSelect
}: {
  label: string
  shortcut?: string
  disabled?: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <ContextMenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className="group relative flex h-7 cursor-default select-none items-center px-2 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-35 data-[highlighted]:bg-foreground data-[highlighted]:text-background"
    >
      <span>{label}</span>
      {shortcut ? (
        <span className="ml-auto pl-8 text-xs tracking-wide text-muted-foreground group-data-[highlighted]:text-background/70">
          {shortcut}
        </span>
      ) : null}
    </ContextMenuPrimitive.Item>
  )
}

function createTabPresentations(
  items: WorkbenchItem[],
  showFileExtensions: boolean,
  visiblePaths: readonly string[]
): Map<string, TabPresentation> {
  const labelCounts = new Map<string, number>()
  for (const item of items) {
    const labelKey = getTabLabel(item, showFileExtensions, visiblePaths).toLocaleLowerCase()
    labelCounts.set(labelKey, (labelCounts.get(labelKey) ?? 0) + 1)
  }

  return new Map(
    items.map((item) => {
      const labelKey = getTabLabel(item, showFileExtensions, visiblePaths).toLocaleLowerCase()
      return [
        item.id,
        createTabPresentation(
          item,
          (labelCounts.get(labelKey) ?? 0) > 1,
          showFileExtensions,
          visiblePaths
        )
      ]
    })
  )
}

function createTabPresentation(
  item: WorkbenchItem,
  showDirectory: boolean,
  showFileExtensions: boolean,
  visiblePaths: readonly string[]
): TabPresentation {
  if (item.kind === 'graph') {
    return {
      label: 'Graph',
      directory: 'Global',
      showDirectory: false
    }
  }

  const normalizedPath = item.relativePath.replaceAll('\\', '/')
  const pathSegments = normalizedPath.split('/')
  const directory = pathSegments.slice(0, -1).join('/') || 'vault root'

  return {
    label: displayFileName(normalizedPath, showFileExtensions, visiblePaths),
    directory,
    showDirectory
  }
}

function getTabLabel(
  item: WorkbenchItem,
  showFileExtensions: boolean,
  visiblePaths: readonly string[]
): string {
  return item.kind === 'graph'
    ? 'Graph'
    : displayFileName(item.relativePath, showFileExtensions, visiblePaths)
}
