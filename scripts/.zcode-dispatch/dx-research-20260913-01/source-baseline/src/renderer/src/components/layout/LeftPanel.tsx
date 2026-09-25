import { FilePlus, FolderOpen, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import type { CommandActionRegistry } from '@/commands/actions'
import { EmptyState } from '@/components/EmptyState'
import { SortMenu } from '@/components/SortMenu'
import { Button } from '@/components/ui/button'
import { FileTree, type FileTreeRevealRequest } from '@/explorer/FileTree'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import type { VaultSessionController } from '@/hooks/useVaultSession'
import type { VaultInfo } from '@/vault/types'
import type { BookmarkTarget } from '../../../../shared/bookmarks'
import { isVisibleVaultPath } from '../../../../shared/vault-path-visibility'

interface LeftPanelProps {
  vault: VaultInfo | null
  selectedPath: string | null
  noteIndex: NoteIndexController
  vaultSession: VaultSessionController
  commandActions: CommandActionRegistry
  revealRequest: FileTreeRevealRequest | null
  onCreateNoteInFolder: (directoryPath: string) => void
  onRequestDelete: (relativePath: string) => void
  onAddBookmark: (target: BookmarkTarget, title?: string | null) => void | Promise<void>
}

export function LeftPanel({
  vault,
  selectedPath,
  noteIndex,
  vaultSession,
  commandActions,
  revealRequest,
  onCreateNoteInFolder,
  onRequestDelete,
  onAddBookmark
}: LeftPanelProps): React.JSX.Element {
  const visibleTreeFiles = useMemo(
    () => vault?.treeFiles.filter((file) => isVisibleVaultPath(file.relativePath)) ?? [],
    [vault?.treeFiles]
  )

  return (
    <aside aria-label="Vault explorer" tabIndex={-1} className="h-full min-h-0 min-w-0 bg-sidebar">
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <div className="font-sans text-xs font-semibold text-muted-foreground">Vault</div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="New note"
            aria-label="New note"
            disabled={!vault}
            onClick={() => void commandActions.dispatch('note.new')}
          >
            <FilePlus className="size-3.5" aria-hidden="true" />
          </Button>
          <SortMenu
            sortMode={vaultSession.sortMode}
            onChange={vaultSession.handleSortModeChange}
            disabled={!vault}
          />
          <Button
            type="button"
            size="icon-sm"
            variant={vaultSession.trashCount > 0 ? 'outline' : 'ghost'}
            title={
              vaultSession.trashCount > 0
                ? `Trash (${vaultSession.trashCount} item${vaultSession.trashCount === 1 ? '' : 's'})`
                : 'Trash is empty'
            }
            aria-label="Trash"
            disabled={!vault || vaultSession.trashCount === 0}
            onClick={() => void commandActions.dispatch('vault.empty-trash')}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {vaultSession.trashCount > 0 ? (
              <span className="ml-1 text-xs tabular-nums">{vaultSession.trashCount}</span>
            ) : null}
          </Button>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">
            {visibleTreeFiles.length}
            <span className="sr-only"> files</span>
          </div>
        </div>
      </div>
      <div className="h-[calc(100%-2.5rem)] overflow-hidden">
        {vault ? (
          <FileTree
            files={visibleTreeFiles}
            notes={noteIndex.indexNotes}
            selectedPath={selectedPath}
            revealRequest={revealRequest}
            sortMode={vaultSession.sortMode}
            onSelectFile={vaultSession.selectTreeFile}
            onCreateNoteInFolder={onCreateNoteInFolder}
            onDeleteFile={onRequestDelete}
            onRenameFile={(fromRelativePath, toRelativePath) =>
              void vaultSession.handleRename(fromRelativePath, toRelativePath)
            }
            onDuplicateFile={(relativePath) => void vaultSession.handleDuplicate(relativePath)}
            onRevealInExplorer={(relativePath) =>
              void vaultSession.handleRevealInExplorer(relativePath)
            }
            onCopyPath={(relativePath) => void vaultSession.handleCopyPath(relativePath)}
            onBookmark={(target, title) => void onAddBookmark(target, title)}
          />
        ) : (
          <EmptyState
            icon={<FolderOpen className="size-5" aria-hidden="true" />}
            title="No vault open"
            description="Open a local folder to begin writing."
            action={
              <Button type="button" size="sm" onClick={() => void vaultSession.openVault()}>
                <FolderOpen className="size-4" aria-hidden="true" />
                Open vault
              </Button>
            }
          />
        )}
      </div>
    </aside>
  )
}
