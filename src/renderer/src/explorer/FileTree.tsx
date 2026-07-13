import {
  ChevronRight,
  Copy,
  ExternalLink,
  Files,
  FileText,
  FolderOpen,
  Pencil,
  Trash2
} from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import type { VaultFile } from '@/vault/types'

export type FileTreeSortMode = 'name' | 'modified-desc' | 'created-desc'

interface FileTreeProps {
  files: VaultFile[]
  /** Notes (with mtimeMs) used to drive Modified/Created sort. */
  notes?: Array<{ relativePath: string; mtimeMs: number }>
  selectedPath: string | null
  sortMode: FileTreeSortMode
  onSelectFile: (relativePath: string) => void
  onDeleteFile: (relativePath: string) => void
  onRenameFile: (fromRelativePath: string, toRelativePath: string) => void
  onDuplicateFile: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
  onCopyPath: (relativePath: string) => void
}

type TreeNode = DirectoryNode | FileNode

interface DirectoryNode {
  type: 'directory'
  name: string
  path: string
  children: TreeNode[]
}

interface FileNode {
  type: 'file'
  name: string
  path: string
  file: VaultFile
}

export function FileTree({
  files,
  notes,
  selectedPath,
  sortMode,
  onSelectFile,
  onDeleteFile,
  onRenameFile,
  onDuplicateFile,
  onRevealInExplorer,
  onCopyPath
}: FileTreeProps): React.JSX.Element {
  const tree = buildTree(files, notes, sortMode)

  if (files.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
        No Markdown files found.
      </div>
    )
  }

  return (
    <div className="space-y-0.5 px-2 py-2">
      {tree.map((node) => (
        <TreeNodeItem
          key={node.path}
          level={0}
          node={node}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          onDeleteFile={onDeleteFile}
          onRenameFile={onRenameFile}
          onDuplicateFile={onDuplicateFile}
          onRevealInExplorer={onRevealInExplorer}
          onCopyPath={onCopyPath}
        />
      ))}
    </div>
  )
}

function TreeNodeItem({
  node,
  level,
  selectedPath,
  onSelectFile,
  onDeleteFile,
  onRenameFile,
  onDuplicateFile,
  onRevealInExplorer,
  onCopyPath
}: {
  node: TreeNode
  level: number
  selectedPath: string | null
  onSelectFile: (relativePath: string) => void
  onDeleteFile: (relativePath: string) => void
  onRenameFile: (fromRelativePath: string, toRelativePath: string) => void
  onDuplicateFile: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
  onCopyPath: (relativePath: string) => void
}): React.JSX.Element {
  if (node.type === 'directory') {
    return (
      <div>
        <div
          className="flex h-7 items-center gap-1.5 px-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
          style={{ paddingLeft: `${level * 14 + 8}px` }}
          title={node.path}
        >
          <ChevronRight className="size-3 rotate-90" aria-hidden="true" />
          <FolderOpen className="size-3.5" aria-hidden="true" />
          <span className="truncate">{node.name}</span>
        </div>
        {node.children.map((child) => (
          <TreeNodeItem
            key={child.path}
            level={level + 1}
            node={child}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            onDeleteFile={onDeleteFile}
            onRenameFile={onRenameFile}
            onDuplicateFile={onDuplicateFile}
            onRevealInExplorer={onRevealInExplorer}
            onCopyPath={onCopyPath}
          />
        ))}
      </div>
    )
  }

  return (
    <FileNodeButton
      node={node}
      level={level}
      isSelected={selectedPath === node.file.relativePath}
      onSelectFile={onSelectFile}
      onDeleteFile={onDeleteFile}
      onRenameFile={onRenameFile}
      onDuplicateFile={onDuplicateFile}
      onRevealInExplorer={onRevealInExplorer}
      onCopyPath={onCopyPath}
    />
  )
}

function FileNodeButton({
  node,
  level,
  isSelected,
  onSelectFile,
  onDeleteFile,
  onRenameFile,
  onDuplicateFile,
  onRevealInExplorer,
  onCopyPath
}: {
  node: FileNode
  level: number
  isSelected: boolean
  onSelectFile: (relativePath: string) => void
  onDeleteFile: (relativePath: string) => void
  onRenameFile: (fromRelativePath: string, toRelativePath: string) => void
  onDuplicateFile: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
  onCopyPath: (relativePath: string) => void
}): React.JSX.Element {
  const [isRenaming, setIsRenaming] = useState(false)

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {isRenaming ? (
          <RenameInput
            node={node}
            level={level}
            onDone={(newPath) => {
              setIsRenaming(false)
              if (newPath && newPath !== node.file.relativePath) {
                onRenameFile(node.file.relativePath, newPath)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className={cn(
              'flex h-8 w-full items-center gap-2 border-l-2 px-2 text-left text-[13px] transition-colors',
              isSelected
                ? 'border-l-[var(--editorial-red)] bg-[var(--paper-dark)] text-foreground font-medium'
                : 'border-l-transparent text-foreground/80 hover:bg-foreground hover:text-background'
            )}
            style={{ paddingLeft: `${level * 14 + 8}px` }}
            title={node.file.relativePath}
            aria-current={isSelected ? 'page' : undefined}
            onClick={() => onSelectFile(node.file.relativePath)}
          >
            <FileText className="size-[15px] shrink-0 opacity-60" aria-hidden="true" />
            <span className="truncate">{node.name}</span>
          </button>
        )}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          className="z-50 min-w-[180px] border-2 border-foreground bg-popover p-1 text-popover-foreground shadow-[4px_4px_0_0_var(--foreground)]"
          data-slot="context-menu-content"
        >
          <ContextMenuItem
            onSelect={() => onDuplicateFile(node.file.relativePath)}
            icon={<Files className="size-3.5" aria-hidden="true" />}
            label="Duplicate"
          />
          <ContextMenuItem
            onSelect={() => setIsRenaming(true)}
            icon={<Pencil className="size-3.5" aria-hidden="true" />}
            label="Rename"
          />
          <ContextMenuItem
            onSelect={() => onCopyPath(node.file.relativePath)}
            icon={<Copy className="size-3.5" aria-hidden="true" />}
            label="Copy path"
          />
          <ContextMenuItem
            onSelect={() => onRevealInExplorer(node.file.relativePath)}
            icon={<ExternalLink className="size-3.5" aria-hidden="true" />}
            label="Reveal in explorer"
          />
          <ContextMenuPrimitive.Separator className="my-1 h-0 border-t border-foreground" />
          <ContextMenuItem
            onSelect={() => onDeleteFile(node.file.relativePath)}
            icon={<Trash2 className="size-3.5" aria-hidden="true" />}
            label="Delete"
            destructive
          />
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}

function ContextMenuItem({
  onSelect,
  icon,
  label,
  destructive
}: {
  onSelect: () => void
  icon: React.ReactNode
  label: string
  destructive?: boolean
}): React.JSX.Element {
  return (
    <ContextMenuPrimitive.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-default select-none items-center gap-2 px-2 py-1.5 text-[13px] outline-none focus:bg-foreground focus:text-background data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        destructive && 'text-destructive focus:bg-destructive focus:text-white'
      )}
    >
      {icon}
      <span>{label}</span>
    </ContextMenuPrimitive.Item>
  )
}

/**
 * Inline rename input — replaces the file label in the tree. Enter confirms
 * (with extension re-attached if the user omitted it), Escape cancels.
 */
function RenameInput({
  node,
  level,
  onDone
}: {
  node: FileNode
  level: number
  onDone: (newRelativePath: string | null) => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState(stripExtension(node.name))

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const commit = (): void => {
    const trimmed = value.trim()

    if (!trimmed) {
      onDone(null)
      return
    }

    // Re-attach the original extension if the user stripped it. We don't
    // allow changing the extension through rename — only the stem.
    const newName = trimmed.endsWith(node.file.extension)
      ? trimmed
      : `${trimmed}${node.file.extension}`
    const newPath = node.file.directory ? `${node.file.directory}/${newName}` : newName
    onDone(newPath)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onDone(null)
        }
      }}
      onClick={(event) => event.stopPropagation()}
      className="h-8 w-full border-2 border-[var(--editorial-red)] bg-background px-2 text-[13px] outline-none ring-2 ring-[color-mix(in_srgb,var(--editorial-red)_25%,transparent)]"
      style={{ marginLeft: `${level * 14 + 8}px` }}
    />
  )
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function buildTree(
  files: VaultFile[],
  notes: Array<{ relativePath: string; mtimeMs: number }> | undefined,
  sortMode: FileTreeSortMode
): TreeNode[] {
  const root: DirectoryNode = {
    type: 'directory',
    name: '',
    path: '',
    children: []
  }
  const directories = new Map<string, DirectoryNode>([['', root]])

  for (const file of files) {
    const parts = file.relativePath.split('/')
    const fileName = parts.at(-1) ?? file.name
    let current = root
    const pathParts: string[] = []

    for (const directoryName of parts.slice(0, -1)) {
      pathParts.push(directoryName)
      const directoryPath = pathParts.join('/')
      let directory = directories.get(directoryPath)

      if (!directory) {
        directory = {
          type: 'directory',
          name: directoryName,
          path: directoryPath,
          children: []
        }
        directories.set(directoryPath, directory)
        current.children.push(directory)
      }

      current = directory
    }

    current.children.push({
      type: 'file',
      name: fileName,
      path: file.relativePath,
      file
    })
  }

  const mtimeByPath = new Map<string, number>()
  if (notes) {
    for (const note of notes) {
      mtimeByPath.set(note.relativePath, note.mtimeMs)
    }
  }

  sortNodes(root.children, sortMode, mtimeByPath)
  return root.children
}

function sortNodes(
  nodes: TreeNode[],
  sortMode: FileTreeSortMode,
  mtimeByPath: Map<string, number>
): void {
  nodes.sort((left, right) => {
    // Directories always sort before files regardless of sort mode.
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1
    }

    if (left.type === 'directory' && right.type === 'directory') {
      return left.name.localeCompare(right.name)
    }

    if (left.type === 'file' && right.type === 'file') {
      if (sortMode === 'modified-desc') {
        const leftMtime = mtimeByPath.get(left.file.relativePath) ?? 0
        const rightMtime = mtimeByPath.get(right.file.relativePath) ?? 0
        if (leftMtime !== rightMtime) {
          return rightMtime - leftMtime
        }
      }
      // name and created-desc both fall back to alphabetical — we don't yet
      // track creation time in the index, so Created degrades to Name with
      // a hint that this is the fallback (mtimeMs is the closest proxy we
      // have on disk for cross-filesystem portability).
      return left.name.localeCompare(right.name)
    }

    return 0
  })

  for (const node of nodes) {
    if (node.type === 'directory') {
      sortNodes(node.children, sortMode, mtimeByPath)
    }
  }
}
