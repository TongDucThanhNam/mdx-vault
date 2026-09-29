import { redo, undo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import { Check, ChevronRight, Menu } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import type { CommandActionRegistry } from '@/commands/actions'
import type { ViewMode } from '@/components/ViewModeToggle'
import { openFindOnly, openReplace } from '@/editor/find-replace-panel'
import { cn } from '@/lib/utils'

interface AppMenuBarProps {
  mainMenuLabel?: string
  commandActions: CommandActionRegistry
  selectedPath: string | null
  viewMode: ViewMode
  editorAvailable: boolean
  isOpeningVault: boolean
  isSaving: boolean
  isDirty: boolean
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  aiPanelOpen: boolean
  onRevealNote: () => void
  onToggleRightPanel: () => void
}

const triggerClassName =
  'app-no-drag grid size-7 shrink-0 place-items-center rounded-[2px] text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-instrument-blue data-[state=open]:bg-foreground data-[state=open]:text-background motion-reduce:transition-none'
const itemClassName =
  'group relative flex h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 font-sans text-xs outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-35 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground'
const selectionItemClassName = cn(itemClassName, 'pl-7')
const menuSurfaceClassName =
  'app-no-drag z-[100] min-w-60 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-hard)]'

export function AppMenuBar({
  mainMenuLabel = 'Main menu',
  commandActions,
  selectedPath,
  viewMode,
  editorAvailable,
  isOpeningVault,
  isSaving,
  isDirty,
  leftPanelOpen,
  rightPanelOpen,
  aiPanelOpen,
  onRevealNote,
  onToggleRightPanel
}: AppMenuBarProps): React.JSX.Element {
  const getAction = commandActions.getAction
  const runAction = (id: string): void => {
    void commandActions.dispatch(id)
  }
  const shortcut = (id: string): string | undefined => getAction(id)?.hotkeys?.[0]

  return (
    <DropdownMenuPrimitive.Root modal={false}>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          className={triggerClassName}
          aria-label={mainMenuLabel}
          title={mainMenuLabel}
        >
          <Menu className="size-4" aria-hidden="true" />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <MenuContent>
        <MenuSub label="File">
          <MenuItem
            label="New Note…"
            shortcut={shortcut('note.new')}
            disabled={getAction('note.new')?.disabled}
            onSelect={() => runAction('note.new')}
          />
          <MenuItem
            label="New Daily Note"
            disabled={getAction('note.daily')?.disabled}
            onSelect={() => runAction('note.daily')}
          />
          <MenuSeparator />
          <MenuItem
            label="Open Vault…"
            disabled={isOpeningVault}
            onSelect={() => runAction('vault.open')}
          />
          <MenuSeparator />
          <MenuItem
            label="Save"
            shortcut={shortcut('file.save')}
            disabled={!selectedPath || isSaving || !isDirty}
            onSelect={() => runAction('file.save')}
          />
          <MenuItem
            label="Export…"
            shortcut={shortcut('note.export')}
            disabled={getAction('note.export')?.disabled}
            onSelect={() => runAction('note.export')}
          />
          <MenuItem
            label="Reveal Note in Explorer"
            disabled={!selectedPath}
            onSelect={onRevealNote}
          />
          <MenuSeparator />
          <MenuItem
            label="Empty Trash…"
            disabled={getAction('vault.empty-trash')?.disabled}
            onSelect={() => runAction('vault.empty-trash')}
          />
          <MenuSeparator />
          <MenuItem
            label="Settings…"
            shortcut={shortcut('settings.open')}
            onSelect={() => runAction('settings.open')}
          />
        </MenuSub>

        <MenuSub label="Edit">
          <MenuItem
            label="Undo"
            shortcut="Ctrl+Z"
            disabled={!editorAvailable}
            onSelect={() => runEditorCommand(undo)}
          />
          <MenuItem
            label="Redo"
            shortcut="Ctrl+Y"
            disabled={!editorAvailable}
            onSelect={() => runEditorCommand(redo)}
          />
          <MenuSeparator />
          <MenuItem
            label="Find in Note"
            shortcut="Ctrl+F"
            disabled={!editorAvailable}
            onSelect={() => runEditorCommand(openFindOnly)}
          />
          <MenuItem
            label="Find and Replace in Note"
            shortcut="Ctrl+H"
            disabled={!editorAvailable}
            onSelect={() => runEditorCommand(openReplace)}
          />
        </MenuSub>

        <MenuSub label="View">
          <DropdownMenuPrimitive.RadioGroup
            value={viewMode}
            onValueChange={(nextValue) => runAction(`view.${nextValue}`)}
          >
            <MenuRadioItem
              value="source"
              label="Source"
              disabled={getAction('view.source')?.disabled}
            />
            <MenuRadioItem
              value="live"
              label="Live"
              shortcut={shortcut('view.live')}
              disabled={getAction('view.live')?.disabled}
            />
            <MenuRadioItem
              value="reading"
              label="Reading"
              disabled={getAction('view.reading')?.disabled}
            />
          </DropdownMenuPrimitive.RadioGroup>
          <MenuSeparator />
          <MenuItem
            label="Reading Full View"
            shortcut={shortcut('view.toggle-reading-full-view')}
            disabled={getAction('view.toggle-reading-full-view')?.disabled}
            onSelect={() => runAction('view.toggle-reading-full-view')}
          />
          <MenuSeparator />
          <MenuCheckboxItem
            label="Toggle Left Panel"
            checked={leftPanelOpen}
            onCheckedChange={() => runAction('view.toggle-left-panel')}
          />
          <MenuCheckboxItem
            label="Toggle Right Panel"
            checked={rightPanelOpen}
            onCheckedChange={onToggleRightPanel}
          />
          <MenuCheckboxItem
            label="Toggle AI Panel"
            shortcut={shortcut('ai.toggle')}
            checked={aiPanelOpen}
            disabled={getAction('ai.toggle')?.disabled}
            onCheckedChange={() => runAction('ai.toggle')}
          />
          <MenuSeparator />
          <MenuItem label="Toggle Theme" onSelect={() => runAction('theme.toggle')} />
        </MenuSub>

        <MenuSub label="Go">
          <MenuItem
            label="Open File…"
            shortcut={shortcut('file.open')}
            disabled={getAction('file.open')?.disabled}
            onSelect={() => runAction('file.open')}
          />
          <MenuItem
            label="Search in Vault…"
            shortcut={shortcut('note.search')}
            disabled={getAction('note.search')?.disabled}
            onSelect={() => runAction('note.search')}
          />
          <MenuItem
            label="Open Global Graph"
            disabled={getAction('graph.open-global')?.disabled}
            onSelect={() => runAction('graph.open-global')}
          />
          <MenuSeparator />
          <MenuItem
            label="Command Palette…"
            shortcut={shortcut('command-palette.toggle')}
            onSelect={() => runAction('command-palette.toggle')}
          />
        </MenuSub>

        <MenuSub label="Window">
          {window.windowApi.platform !== 'darwin' ? (
            <>
              <MenuItem label="Minimize" onSelect={() => void window.windowApi.minimize()} />
              <MenuItem
                label="Toggle Maximize"
                onSelect={() => void window.windowApi.toggleMaximize()}
              />
              <MenuSeparator />
            </>
          ) : null}
          <MenuItem
            label="Close Active Item"
            shortcut={shortcut('workbench.close-item')}
            onSelect={() => runAction('workbench.close-item')}
          />
        </MenuSub>
      </MenuContent>
    </DropdownMenuPrimitive.Root>
  )
}

function MenuContent({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align="start"
        sideOffset={4}
        collisionPadding={8}
        className={menuSurfaceClassName}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

function MenuSub({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.Sub>
      <DropdownMenuPrimitive.SubTrigger className={itemClassName}>
        <span className="font-medium">{label}</span>
        <ChevronRight className="ml-auto size-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuPrimitive.SubTrigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent
          sideOffset={4}
          alignOffset={-4}
          collisionPadding={8}
          className={menuSurfaceClassName}
        >
          {children}
        </DropdownMenuPrimitive.SubContent>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Sub>
  )
}

function MenuItem({
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
    <DropdownMenuPrimitive.Item disabled={disabled} onSelect={onSelect} className={itemClassName}>
      <span>{label}</span>
      {shortcut ? <MenuShortcut>{shortcut}</MenuShortcut> : null}
    </DropdownMenuPrimitive.Item>
  )
}

function MenuCheckboxItem({
  label,
  shortcut,
  checked,
  disabled,
  onCheckedChange
}: {
  label: string
  shortcut?: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: () => void
}): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className={selectionItemClassName}
    >
      <DropdownMenuPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
        <Check className="size-3" aria-hidden="true" />
      </DropdownMenuPrimitive.ItemIndicator>
      <span>{label}</span>
      {shortcut ? <MenuShortcut>{shortcut}</MenuShortcut> : null}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function MenuRadioItem({
  value,
  label,
  shortcut,
  disabled
}: {
  value: ViewMode
  label: string
  shortcut?: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <DropdownMenuPrimitive.RadioItem
      value={value}
      disabled={disabled}
      className={selectionItemClassName}
    >
      <DropdownMenuPrimitive.ItemIndicator className="absolute left-2 inline-flex size-3 items-center justify-center">
        <span className="size-1.5 rounded-full bg-instrument-blue" aria-hidden="true" />
      </DropdownMenuPrimitive.ItemIndicator>
      <span>{label}</span>
      {shortcut ? <MenuShortcut>{shortcut}</MenuShortcut> : null}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function MenuShortcut({ children }: { children: string }): React.JSX.Element {
  return (
    <span className="ml-auto pl-8 font-mono text-xs text-muted-foreground group-data-[highlighted]:text-accent-foreground/70">
      {children}
    </span>
  )
}

function MenuSeparator(): React.JSX.Element {
  return <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
}

function runEditorCommand(command: (view: EditorView) => boolean): void {
  const editorElement = document.querySelector<HTMLElement>('.cm-editor')
  const editorView = editorElement ? EditorView.findFromDOM(editorElement) : null

  if (!editorView) {
    return
  }

  command(editorView)
  queueMicrotask(() => editorView.focus())
}
