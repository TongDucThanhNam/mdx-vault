import type {
  ContextMenuItem,
  ContextMenuOpenContext,
  FileTree as FileTreeModel,
  FileTreeSortComparator,
  FileTreeSortEntry
} from '@pierre/trees'
import { FileTree as PierreFileTree, useFileTree, useFileTreeSelector } from '@pierre/trees/react'
import { BookmarkPlus, Copy, ExternalLink, Files, Pencil, Trash2 } from 'lucide-react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { isNotePath } from '@/vault/file-kind'
import type { VaultTreeFile } from '@/vault/types'
import type { BookmarkTarget } from '../../../shared/bookmarks'

export type FileTreeSortMode = 'name' | 'modified-desc' | 'created-desc'

export interface FileTreeRevealRequest {
  path: string
  requestId: number
}

interface FileTreeProps {
  files: VaultTreeFile[]
  /** Notes (with mtimeMs) used to drive Modified/Created sort. */
  notes?: Array<{ relativePath: string; mtimeMs: number }>
  selectedPath: string | null
  revealRequest: FileTreeRevealRequest | null
  sortMode: FileTreeSortMode
  onSelectFile: (relativePath: string) => void
  onDeleteFile: (relativePath: string) => void
  onRenameFile: (fromRelativePath: string, toRelativePath: string) => void
  onDuplicateFile: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
  onCopyPath: (relativePath: string) => void
  onBookmark: (target: BookmarkTarget, title?: string | null) => void
}

interface TreeCallbacks {
  onSelectFile: FileTreeProps['onSelectFile']
  onDeleteFile: FileTreeProps['onDeleteFile']
  onRenameFile: FileTreeProps['onRenameFile']
  onDuplicateFile: FileTreeProps['onDuplicateFile']
  onRevealInExplorer: FileTreeProps['onRevealInExplorer']
  onCopyPath: FileTreeProps['onCopyPath']
  onBookmark: FileTreeProps['onBookmark']
}

interface SortContext {
  mode: FileTreeSortMode
  mtimeByPath: Map<string, number>
}

const TREE_STYLE = {
  height: '100%',
  width: '100%',
  '--trees-accent-override': 'var(--editorial-red)',
  '--trees-bg-override': 'var(--sidebar)',
  '--trees-bg-muted-override': 'var(--paper-dark)',
  '--trees-border-color-override': 'var(--foreground)',
  '--trees-border-radius-override': '0px',
  '--trees-fg-override': 'var(--sidebar-foreground)',
  '--trees-fg-muted-override': 'var(--muted-foreground)',
  '--trees-file-icon-color': 'var(--muted-foreground)',
  '--trees-focus-ring-color-override': 'var(--editorial-red)',
  '--trees-focus-ring-offset-override': '-2px',
  '--trees-focus-ring-width-override': '2px',
  '--trees-font-family-override': 'var(--font-sans)',
  '--trees-font-size-override': '13px',
  '--trees-font-weight-regular-override': '400',
  '--trees-font-weight-semibold-override': '700',
  '--trees-item-margin-x-override': '0px',
  '--trees-item-padding-x-override': '8px',
  '--trees-item-row-gap-override': '8px',
  '--trees-level-gap-override': '14px',
  '--trees-padding-inline-override': '8px',
  '--trees-scrollbar-thumb-override': 'color-mix(in srgb, var(--foreground) 30%, transparent)',
  '--trees-selected-bg-override': 'var(--background)',
  '--trees-selected-fg-override': 'var(--foreground)',
  '--trees-selected-focused-border-color-override': 'var(--editorial-red)'
} as CSSProperties

const TREE_UNSAFE_CSS = `
  [data-type='item'] {
    transition: background-color 120ms ease, color 120ms ease;
  }

  [data-type='item'][data-item-selected='true'] {
    box-shadow: inset 2px 0 0 var(--trees-accent);
    font-weight: var(--trees-font-weight-semibold);
  }

  @media (prefers-reduced-motion: reduce) {
    [data-type='item'] {
      transition: none;
    }
  }
`

export function FileTree({
  files,
  notes,
  selectedPath,
  revealRequest,
  sortMode,
  onSelectFile,
  onDeleteFile,
  onRenameFile,
  onDuplicateFile,
  onRevealInExplorer,
  onCopyPath,
  onBookmark
}: FileTreeProps): React.JSX.Element {
  const paths = useMemo(() => files.map((file) => file.relativePath), [files])
  const filesByPath = useMemo(
    () => new Map(files.map((file) => [file.relativePath, file])),
    [files]
  )
  const filePaths = useMemo(() => new Set(paths), [paths])
  const mtimeByPath = useMemo(
    () => new Map(notes?.map((note) => [note.relativePath, note.mtimeMs]) ?? []),
    [notes]
  )

  const callbacksRef = useRef<TreeCallbacks>({
    onSelectFile,
    onDeleteFile,
    onRenameFile,
    onDuplicateFile,
    onRevealInExplorer,
    onCopyPath,
    onBookmark
  })
  callbacksRef.current = {
    onSelectFile,
    onDeleteFile,
    onRenameFile,
    onDuplicateFile,
    onRevealInExplorer,
    onCopyPath,
    onBookmark
  }

  const filesByPathRef = useRef(filesByPath)
  filesByPathRef.current = filesByPath
  const filePathsRef = useRef(filePaths)
  filePathsRef.current = filePaths
  const pathsRef = useRef(paths)
  pathsRef.current = paths
  const selectedPathRef = useRef(selectedPath)
  selectedPathRef.current = selectedPath
  const sortContextRef = useRef<SortContext>({ mode: sortMode, mtimeByPath })
  sortContextRef.current = { mode: sortMode, mtimeByPath }
  const modelRef = useRef<FileTreeModel | null>(null)
  const syncingSelectionRef = useRef(false)

  const sort = useCallback<FileTreeSortComparator>((left, right) => {
    return compareTreeEntries(left, right, sortContextRef.current)
  }, [])

  const { model } = useFileTree({
    paths,
    initialExpansion: 'open',
    initialSelectedPaths: selectedPath ? [selectedPath] : [],
    sort,
    density: 'default',
    itemHeight: 32,
    icons: { set: 'complete', colored: false },
    renaming: {
      canRename: (item) => !item.isFolder && isNotePath(item.path),
      onRename: ({ sourcePath, destinationPath }) => {
        const file = filesByPathRef.current.get(sourcePath)
        if (!file) {
          return
        }

        callbacksRef.current.onRenameFile(
          sourcePath,
          normalizeRenameDestination(destinationPath, file.extension)
        )

        queueMicrotask(() => {
          modelRef.current?.resetPaths(pathsRef.current)
        })
      }
    },
    composition: {
      contextMenu: {
        enabled: true,
        triggerMode: 'right-click'
      }
    },
    unsafeCSS: TREE_UNSAFE_CSS,
    onSelectionChange: (selectedPaths) => {
      if (syncingSelectionRef.current) {
        return
      }

      const selectedFile = selectedPaths.findLast((path) => filePathsRef.current.has(path))
      const nextSelectedPath = selectedFile ?? selectedPathRef.current

      queueMicrotask(() => {
        const currentModel = modelRef.current
        if (currentModel) {
          synchronizeSelection(currentModel, nextSelectedPath, syncingSelectionRef)
        }
      })

      if (selectedFile && selectedFile !== selectedPathRef.current) {
        callbacksRef.current.onSelectFile(selectedFile)
      }
    }
  })
  modelRef.current = model

  const selectedPaths = useFileTreeSelector(
    model,
    (tree) => tree.getSelectedPaths(),
    arePathArraysEqual
  )
  const previousSelectedPathRef = useRef(selectedPath)
  const hasMountedRef = useRef(false)

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }

    model.resetPaths(paths)
  }, [model, mtimeByPath, paths, sortMode])

  useEffect(() => {
    if (previousSelectedPathRef.current === selectedPath) {
      return
    }

    previousSelectedPathRef.current = selectedPath
    if (arePathArraysEqual(selectedPaths, selectedPath ? [selectedPath] : [])) {
      return
    }

    synchronizeSelection(model, selectedPath, syncingSelectionRef)
  }, [model, selectedPath, selectedPaths])

  useEffect(() => {
    if (!revealRequest) return

    let ancestorPath = ''
    for (const segment of revealRequest.path.split('/').filter(Boolean)) {
      ancestorPath += `${segment}/`
      const item = model.getItem(ancestorPath)
      if (item && 'expand' in item) item.expand()
    }

    queueMicrotask(() => {
      model.focusPath(revealRequest.path)
      model.scrollToPath(revealRequest.path, { focus: true, offset: 'center' })
      window.requestAnimationFrame(() => {
        const selector = `[data-item-path="${CSS.escape(revealRequest.path)}"]`
        const row = model.getFileTreeContainer()?.shadowRoot?.querySelector(selector)
        if (row instanceof HTMLElement) row.focus()
      })
    })
  }, [model, revealRequest])

  if (files.length === 0) {
    return (
      <div className="px-4 py-10 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        No files found.
      </div>
    )
  }

  return (
    <PierreFileTree
      model={model}
      className="block min-h-0 bg-sidebar"
      style={TREE_STYLE}
      aria-label="Vault files"
      renderContextMenu={(item, context) => (
        <TreeContextMenu item={item} context={context} model={model} callbacks={callbacksRef} />
      )}
    />
  )
}

function TreeContextMenu({
  item,
  context,
  model,
  callbacks
}: {
  item: ContextMenuItem
  context: ContextMenuOpenContext
  model: FileTreeModel
  callbacks: React.RefObject<TreeCallbacks>
}): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [])

  const runAction = (action: () => void): void => {
    context.close()
    action()
  }

  const startRenaming = (): void => {
    context.close({ restoreFocus: false })
    queueMicrotask(() => {
      model.startRenaming(item.path)
    })
  }
  const isNote = isNotePath(item.path)

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${item.name}`}
      data-file-tree-context-menu-root="true"
      className="absolute left-0 top-0 z-50 min-w-[190px] border-2 border-foreground bg-popover p-1 text-popover-foreground shadow-[4px_4px_0_0_var(--foreground)]"
      onKeyDown={handleMenuKeyDown(context)}
    >
      {isNote ? (
        <>
          <TreeContextMenuItem
            icon={<Files className="size-3.5" aria-hidden="true" />}
            label="Duplicate"
            onSelect={() => runAction(() => callbacks.current.onDuplicateFile(item.path))}
          />
          <TreeContextMenuItem
            icon={<Pencil className="size-3.5" aria-hidden="true" />}
            label="Rename"
            onSelect={startRenaming}
          />
        </>
      ) : null}
      <TreeContextMenuItem
        icon={<BookmarkPlus className="size-3.5" aria-hidden="true" />}
        label={item.kind === 'directory' ? 'Bookmark folder' : 'Bookmark file'}
        onSelect={() =>
          runAction(() =>
            callbacks.current.onBookmark(
              item.kind === 'directory'
                ? { kind: 'folder', relativePath: item.path }
                : { kind: 'file', relativePath: item.path },
              item.name
            )
          )
        }
      />
      <TreeContextMenuItem
        icon={<Copy className="size-3.5" aria-hidden="true" />}
        label="Copy path"
        onSelect={() => runAction(() => callbacks.current.onCopyPath(item.path))}
      />
      <TreeContextMenuItem
        icon={<ExternalLink className="size-3.5" aria-hidden="true" />}
        label="Reveal in explorer"
        onSelect={() => runAction(() => callbacks.current.onRevealInExplorer(item.path))}
      />
      {isNote ? (
        <>
          <hr className="my-1 border-0 border-t border-foreground" />
          <TreeContextMenuItem
            destructive
            icon={<Trash2 className="size-3.5" aria-hidden="true" />}
            label="Delete"
            onSelect={() => runAction(() => callbacks.current.onDeleteFile(item.path))}
          />
        </>
      ) : null}
    </div>
  )
}

function TreeContextMenuItem({
  icon,
  label,
  onSelect,
  destructive = false
}: {
  icon: React.ReactNode
  label: string
  onSelect: () => void
  destructive?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full cursor-default select-none items-center gap-2 px-2 py-1.5 text-left text-[13px] outline-none transition-colors focus-visible:bg-foreground focus-visible:text-background motion-reduce:transition-none',
        destructive &&
          'text-destructive focus-visible:bg-destructive focus-visible:text-destructive-foreground'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function handleMenuKeyDown(context: ContextMenuOpenContext) {
  return (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      context.close()
      return
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return
    }

    event.preventDefault()
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    )
    if (items.length === 0) {
      return
    }

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }
}

function synchronizeSelection(
  model: FileTreeModel,
  selectedPath: string | null,
  syncingSelectionRef: React.RefObject<boolean>
): void {
  const currentPaths = model.getSelectedPaths()
  const desiredPaths = selectedPath ? [selectedPath] : []
  if (arePathArraysEqual(currentPaths, desiredPaths)) {
    return
  }

  syncingSelectionRef.current = true
  for (const currentPath of currentPaths) {
    model.getItem(currentPath)?.deselect()
  }
  if (selectedPath) {
    model.getItem(selectedPath)?.select()
  }
  syncingSelectionRef.current = false
}

function arePathArraysEqual(previous: readonly string[], next: readonly string[]): boolean {
  return previous.length === next.length && previous.every((path, index) => path === next[index])
}

function compareTreeEntries(
  left: FileTreeSortEntry,
  right: FileTreeSortEntry,
  context: SortContext
): number {
  if (left.isDirectory !== right.isDirectory) {
    return left.isDirectory ? -1 : 1
  }

  if (!left.isDirectory && !right.isDirectory && context.mode === 'modified-desc') {
    const leftMtime = context.mtimeByPath.get(left.path) ?? 0
    const rightMtime = context.mtimeByPath.get(right.path) ?? 0
    if (leftMtime !== rightMtime) {
      return rightMtime - leftMtime
    }
  }

  return left.basename.localeCompare(right.basename)
}

function normalizeRenameDestination(destinationPath: string, extension: string): string {
  return destinationPath.endsWith(extension) ? destinationPath : `${destinationPath}${extension}`
}
