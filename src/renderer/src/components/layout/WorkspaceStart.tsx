import { FilePlus } from 'lucide-react'
import type { CommandActionRegistry } from '@/commands/actions'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

export function WorkspaceStart({
  emptyVault,
  actions
}: {
  emptyVault: boolean
  actions: CommandActionRegistry
}): React.JSX.Element {
  const entries = emptyVault
    ? [
        { id: 'note.new', label: 'New note' },
        { id: 'vault.open', label: 'Open vault…' }
      ]
    : [
        { id: 'note.new', label: 'New note' },
        { id: 'file.open', label: 'Open file' },
        { id: 'command-palette.toggle', label: 'Command palette' }
      ]

  return (
    <EmptyState
      icon={<FilePlus className="size-5" aria-hidden="true" />}
      title={emptyVault ? 'Empty vault' : 'Ready to write'}
      description={
        emptyVault ? 'Create the first note in this vault.' : 'Choose a note or begin one.'
      }
      action={
        <div className="flex w-64 flex-col gap-1 border-t border-border pt-3">
          {entries.map(({ id, label }, index) => (
            <Button
              key={id}
              type="button"
              variant={index === 0 ? 'default' : 'ghost'}
              size="sm"
              className="w-full justify-between"
              onClick={() => void actions.dispatch(id)}
            >
              <span>{label}</span>
              <kbd className="ml-3 font-mono text-xs opacity-80">
                {actions.getAction(id)?.hotkeys?.[0] ?? ''}
              </kbd>
            </Button>
          ))}
        </div>
      }
    />
  )
}
