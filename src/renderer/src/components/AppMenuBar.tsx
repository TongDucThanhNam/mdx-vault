import { redo, undo } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import { Check } from 'lucide-react'
import { Menubar as MenubarPrimitive } from 'radix-ui'
import type { CommandActionRegistry } from '@/commands/actions'
import type { ViewMode } from '@/components/ViewModeToggle'
import { cn } from '@/lib/utils'

interface AppMenuBarProps {
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
  'app-no-drag flex h-7 cursor-default select-none items-center px-2 font-mono text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60 data-[state=open]:bg-foreground data-[state=open]:text-background motion-reduce:transition-none'
const itemClassName =
  'group relative flex h-7 cursor-default select-none items-center gap-2 px-2 font-mono text-[11px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-35 data-[highlighted]:bg-foreground data-[highlighted]:text-background'
const selectionItemClassName = cn(itemClassName, 'pl-7')

export function AppMenuBar({
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
    <MenubarPrimitive.Root className="app-no-drag flex h-full items-center">
      <MenubarPrimitive.Menu value="file">
        <MenubarPrimitive.Trigger className={triggerClassName}>File</MenubarPrimitive.Trigger>
        <MenuContent>
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
        </MenuContent>
      </MenubarPrimitive.Menu>

      <MenubarPrimitive.Menu value="edit">
        <MenubarPrimitive.Trigger className={triggerClassName}>Edit</MenubarPrimitive.Trigger>
        <MenuContent>
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
            onSelect={() => runEditorCommand(openSearchPanel)}
          />
        </MenuContent>
      </MenubarPrimitive.Menu>

      <MenubarPrimitive.Menu value="view">
        <MenubarPrimitive.Trigger className={triggerClassName}>View</MenubarPrimitive.Trigger>
        <MenuContent>
          <MenubarPrimitive.RadioGroup
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
          </MenubarPrimitive.RadioGroup>
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
        </MenuContent>
      </MenubarPrimitive.Menu>

      <MenubarPrimitive.Menu value="go">
        <MenubarPrimitive.Trigger className={triggerClassName}>Go</MenubarPrimitive.Trigger>
        <MenuContent>
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
          <MenuSeparator />
          <MenuItem
            label="Command Palette…"
            shortcut={shortcut('command-palette.toggle')}
            onSelect={() => runAction('command-palette.toggle')}
          />
        </MenuContent>
      </MenubarPrimitive.Menu>

      <MenubarPrimitive.Menu value="window">
        <MenubarPrimitive.Trigger className={triggerClassName}>Window</MenubarPrimitive.Trigger>
        <MenuContent>
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
        </MenuContent>
      </MenubarPrimitive.Menu>
    </MenubarPrimitive.Root>
  )
}

function MenuContent({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <MenubarPrimitive.Portal>
      <MenubarPrimitive.Content
        align="start"
        sideOffset={3}
        className="app-no-drag z-[100] min-w-60 border-2 border-foreground bg-popover p-1 text-popover-foreground shadow-[4px_4px_0_0_var(--foreground)]"
      >
        {children}
      </MenubarPrimitive.Content>
    </MenubarPrimitive.Portal>
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
    <MenubarPrimitive.Item disabled={disabled} onSelect={onSelect} className={itemClassName}>
      <span>{label}</span>
      {shortcut ? <MenuShortcut>{shortcut}</MenuShortcut> : null}
    </MenubarPrimitive.Item>
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
    <MenubarPrimitive.CheckboxItem
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className={selectionItemClassName}
    >
      <MenubarPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
        <Check className="size-3" aria-hidden="true" />
      </MenubarPrimitive.ItemIndicator>
      <span>{label}</span>
      {shortcut ? <MenuShortcut>{shortcut}</MenuShortcut> : null}
    </MenubarPrimitive.CheckboxItem>
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
    <MenubarPrimitive.RadioItem
      value={value}
      disabled={disabled}
      className={selectionItemClassName}
    >
      <MenubarPrimitive.ItemIndicator className="absolute left-2 inline-flex size-3 items-center justify-center">
        <span className="size-1.5 bg-[var(--editorial-red)]" aria-hidden="true" />
      </MenubarPrimitive.ItemIndicator>
      <span>{label}</span>
      {shortcut ? <MenuShortcut>{shortcut}</MenuShortcut> : null}
    </MenubarPrimitive.RadioItem>
  )
}

function MenuShortcut({ children }: { children: string }): React.JSX.Element {
  return (
    <span className="ml-auto pl-8 text-[9px] tracking-wide text-muted-foreground group-data-[highlighted]:text-background/70">
      {children}
    </span>
  )
}

function MenuSeparator(): React.JSX.Element {
  return <MenubarPrimitive.Separator className="my-1 h-px bg-foreground" />
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
