import { ChevronRight, FileText, FolderOpen } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { VaultFile } from '@/vault/types'

interface FileTreeProps {
  files: VaultFile[]
  selectedPath: string | null
  onSelectFile: (relativePath: string) => void
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

export function FileTree({ files, selectedPath, onSelectFile }: FileTreeProps): React.JSX.Element {
  const tree = buildTree(files)

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
        />
      ))}
    </div>
  )
}

function TreeNodeItem({
  node,
  level,
  selectedPath,
  onSelectFile
}: {
  node: TreeNode
  level: number
  selectedPath: string | null
  onSelectFile: (relativePath: string) => void
}): React.JSX.Element {
  if (node.type === 'directory') {
    return (
      <div>
        <div
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground"
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
          />
        ))}
      </div>
    )
  }

  const isSelected = selectedPath === node.file.relativePath

    return (
      <button
        type="button"
        className={cn(
          'flex h-8 w-full items-center gap-2 rounded-[4px] px-2 text-left text-[13px] transition-colors',
          isSelected
            ? 'bg-[var(--viridian-soft)] text-accent-foreground font-medium shadow-[inset_2px_0_0_0_var(--viridian)]'
            : 'text-foreground/80 hover:bg-accent hover:text-foreground'
        )}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        title={node.file.relativePath}
        aria-current={isSelected ? 'page' : undefined}
        onClick={() => onSelectFile(node.file.relativePath)}
      >
        <FileText className="size-[15px] shrink-0 opacity-60" aria-hidden="true" />
        <span className="truncate">{node.name}</span>
      </button>
    )
}

function buildTree(files: VaultFile[]): TreeNode[] {
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

  sortNodes(root.children)
  return root.children
}

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })

  for (const node of nodes) {
    if (node.type === 'directory') {
      sortNodes(node.children)
    }
  }
}
