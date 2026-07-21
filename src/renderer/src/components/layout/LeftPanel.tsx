import { FilePlus, FolderOpen, Trash2 } from 'lucide-react'
import type { CommandActionRegistry } from '@/commands/actions'
import { EmptyState } from '@/components/EmptyState'
import { SortMenu } from '@/components/SortMenu'
import { Button } from '@/components/ui/button'
import { FileTree } from '@/explorer/FileTree'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import type { VaultSessionController } from '@/hooks/useVaultSession'
import type { VaultInfo } from '@/vault/types'

interface LeftPanelProps {
  vault: VaultInfo | null
  selectedPath: string | null
  noteIndex: NoteIndexController
  vaultSession: VaultSessionController
  commandActions: CommandActionRegistry
  onRequestDelete: (relativePath: string) => void
}

export function LeftPanel({
  vault,
  selectedPath,
  noteIndex,
  vaultSession,
  commandActions,
  onRequestDelete
}: LeftPanelProps): React.JSX.Element {
  return (
    <aside
      aria-label="Vault explorer"
      tabIndex={-1}
      className="min-h-0 min-w-0 border-r-2 border-foreground bg-sidebar"
    >
      <div className="flex h-10 items-center justify-between border-b-2 border-foreground px-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Vault
        </div>
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
              <span className="ml-1 text-[11px] tabular-nums">{vaultSession.trashCount}</span>
            ) : null}
          </Button>
          <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {vault?.treeFiles.length ?? 0}
            <span className="sr-only"> files</span>
          </div>
        </div>
      </div>
      <div className="h-[calc(100%-2.5rem)] overflow-hidden">
        {vault ? (
          <FileTree
            files={vault.treeFiles}
            notes={noteIndex.indexNotes}
            selectedPath={selectedPath}
            sortMode={vaultSession.sortMode}
            onSelectFile={vaultSession.selectTreeFile}
            onDeleteFile={onRequestDelete}
            onRenameFile={(fromRelativePath, toRelativePath) =>
              void vaultSession.handleRename(fromRelativePath, toRelativePath)
            }
            onDuplicateFile={(relativePath) => void vaultSession.handleDuplicate(relativePath)}
            onRevealInExplorer={(relativePath) =>
              void vaultSession.handleRevealInExplorer(relativePath)
            }
            onCopyPath={(relativePath) => void vaultSession.handleCopyPath(relativePath)}
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
