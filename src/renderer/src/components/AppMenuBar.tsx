import { redo, undo } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import { Check } from 'lucide-react'
import { Menubar as MenubarPrimitive } from 'radix-ui'
import { useMemo } from 'react'
import type { CommandAction } from '@/commands/actions'
import type { ViewMode } from '@/components/ViewModeToggle'
import { cn } from '@/lib/utils'

interface AppMenuBarProps {
  commandActions: CommandAction[]
  selectedPath: string | null
  viewMode: ViewMode
  editorAvailable: boolean
  isOpeningVault: boolean
  isSaving: boolean
  isDirty: boolean
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  aiPanelOpen: boolean
  onSave: () => void
  onRevealNote: () => void
  onOpenCommandPalette: () => void
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onToggleAiPanel: () => void
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
  onSave,
  onRevealNote,
  onOpenCommandPalette,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleAiPanel
}: AppMenuBarProps): React.JSX.Element {
  const actionsById = useMemo(
    () => new Map(commandActions.map((action) => [action.id, action])),
    [commandActions]
  )
  const getAction = (id: string): CommandAction | undefined => actionsById.get(id)
  const runAction = (id: string): void => {
    const action = getAction(id)
    if (action && !action.disabled) {
      void action.run()
    }
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
            shortcut="Ctrl+S"
            disabled={!selectedPath || isSaving || !isDirty}
            onSelect={onSave}
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
            onCheckedChange={onToggleLeftPanel}
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
            onCheckedChange={onToggleAiPanel}
          />
          <MenuSeparator />
          <MenuItem label="Toggle Theme" onSelect={() => runAction('theme.toggle')} />
        </MenuContent>
      </MenubarPrimitive.Menu>

      <MenubarPrimitive.Menu value="go">
        <MenubarPrimitive.Trigger className={triggerClassName}>Go</MenubarPrimitive.Trigger>
        <MenuContent>
          <MenuItem
            label="Quick Switcher…"
            shortcut={shortcut('note.open')}
            disabled={getAction('note.open')?.disabled}
            onSelect={() => runAction('note.open')}
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
            shortcut="Ctrl+Shift+P"
            onSelect={onOpenCommandPalette}
          />
        </MenuContent>
      </MenubarPrimitive.Menu>

      {window.windowApi.platform !== 'darwin' ? (
        <MenubarPrimitive.Menu value="window">
          <MenubarPrimitive.Trigger className={triggerClassName}>Window</MenubarPrimitive.Trigger>
          <MenuContent>
            <MenuItem label="Minimize" onSelect={() => void window.windowApi.minimize()} />
            <MenuItem
              label="Toggle Maximize"
              onSelect={() => void window.windowApi.toggleMaximize()}
            />
            <MenuSeparator />
            <MenuItem label="Close" onSelect={() => void window.windowApi.close()} />
          </MenuContent>
        </MenubarPrimitive.Menu>
      ) : null}
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
