import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import type { CommandAction } from '@/commands/actions'
import type { ViewMode } from '@/components/ViewModeToggle'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteTemplate, VaultInfo } from '@/vault/types'

interface UseCommandActionsOptions {
  vault: VaultInfo | null
  selectedPath: string | null
  indexNoteCount: number
  noteTemplates: NoteTemplate[]
  trashCount: number
  noteActions: NoteActionsController
  openVault: () => Promise<void>
  toggleTheme: () => Promise<void>
  setCreateNoteOpen: Dispatch<SetStateAction<boolean>>
  setQuickSwitcherOpen: Dispatch<SetStateAction<boolean>>
  setSearchOpen: Dispatch<SetStateAction<boolean>>
  setExportDialogOpen: Dispatch<SetStateAction<boolean>>
  setAiPanelOpen: Dispatch<SetStateAction<boolean>>
  setEmptyTrashOpen: Dispatch<SetStateAction<boolean>>
  setViewMode: Dispatch<SetStateAction<ViewMode>>
}

export function useCommandActions({
  vault,
  selectedPath,
  indexNoteCount,
  noteTemplates,
  trashCount,
  noteActions,
  openVault,
  toggleTheme,
  setCreateNoteOpen,
  setQuickSwitcherOpen,
  setSearchOpen,
  setExportDialogOpen,
  setAiPanelOpen,
  setEmptyTrashOpen,
  setViewMode
}: UseCommandActionsOptions): CommandAction[] {
  const {
    createUniqueNote,
    insertCurrentDate,
    insertCurrentTime,
    insertTemplateAtCursor,
    openDailyNote,
    openRandomNote
  } = noteActions

  return useMemo<CommandAction[]>(
    () => [
      {
        id: 'note.new',
        title: 'New note',
        description: 'Create a blank MDX note.',
        category: 'Notes',
        keywords: ['create', 'file'],
        hotkeys: ['Ctrl+N'],
        disabled: vault === null,
        run: () => setCreateNoteOpen(true)
      },
      {
        id: 'note.new-template',
        title: 'New note from template',
        description: 'Create a note and choose a vault template.',
        category: 'Notes',
        keywords: ['insert', 'template'],
        disabled: vault === null,
        run: () => setCreateNoteOpen(true)
      },
      {
        id: 'note.daily',
        title: "Open today's daily note",
        description: 'Open or create the journal note for today.',
        category: 'Notes',
        keywords: ['journal', 'today'],
        disabled: vault === null,
        run: openDailyNote
      },
      {
        id: 'note.random',
        title: 'Open random note',
        description: 'Open a random indexed note from this vault.',
        category: 'Notes',
        keywords: ['shuffle'],
        disabled: vault === null || indexNoteCount === 0,
        run: openRandomNote
      },
      {
        id: 'note.unique',
        title: 'Create unique note',
        description: 'Create a timestamp-prefixed MDX note.',
        category: 'Notes',
        keywords: ['zettelkasten', 'timestamp'],
        disabled: vault === null,
        run: createUniqueNote
      },
      {
        id: 'note.open',
        title: 'Open note',
        description: 'Jump to a note in the current vault.',
        category: 'Navigation',
        keywords: ['quick switcher'],
        hotkeys: ['Ctrl+P'],
        disabled: vault === null,
        run: () => setQuickSwitcherOpen(true)
      },
      {
        id: 'note.search',
        title: 'Search notes',
        description: 'Search indexed note content.',
        category: 'Navigation',
        keywords: ['find'],
        hotkeys: ['Ctrl+Shift+F'],
        disabled: vault === null,
        run: () => setSearchOpen(true)
      },
      {
        id: 'insert.date',
        title: 'Insert current date',
        description: 'Insert today at the editor cursor.',
        category: 'Insert',
        keywords: ['template', 'today'],
        disabled: selectedPath === null,
        run: insertCurrentDate
      },
      {
        id: 'insert.time',
        title: 'Insert current time',
        description: 'Insert the current local time at the editor cursor.',
        category: 'Insert',
        keywords: ['template', 'clock'],
        disabled: selectedPath === null,
        run: insertCurrentTime
      },
      ...noteTemplates.map(
        (template): CommandAction => ({
          id: `template.insert:${template.relativePath}`,
          title: `Insert template: ${template.name}`,
          description: `Insert ${template.relativePath} at the editor cursor.`,
          category: 'Templates',
          keywords: ['insert', 'template', template.name, template.relativePath],
          disabled: selectedPath === null,
          run: () => insertTemplateAtCursor(template)
        })
      ),
      {
        id: 'view.source',
        title: 'Source view',
        description: 'Show the MDX editor only.',
        category: 'View',
        keywords: ['editor'],
        disabled: selectedPath === null,
        run: () => setViewMode('source')
      },
      {
        id: 'view.split',
        title: 'Split view',
        description: 'Show editor and preview together.',
        category: 'View',
        keywords: ['editor', 'preview'],
        hotkeys: ['Ctrl+Shift+V'],
        disabled: selectedPath === null,
        run: () => setViewMode('split')
      },
      {
        id: 'view.preview',
        title: 'Preview view',
        description: 'Show the rendered MDX preview only.',
        category: 'View',
        keywords: ['rendered'],
        disabled: selectedPath === null,
        run: () => setViewMode('preview')
      },
      {
        id: 'note.export',
        title: 'Export current note',
        description: 'Open export options for the selected note.',
        category: 'Notes',
        keywords: ['static', 'html', 'snapshot'],
        hotkeys: ['Ctrl+Shift+E'],
        disabled: selectedPath === null,
        run: () => setExportDialogOpen(true)
      },
      {
        id: 'ai.toggle',
        title: 'Toggle AI assistant',
        description: 'Show or hide the assistant panel.',
        category: 'AI',
        keywords: ['assistant'],
        hotkeys: ['Ctrl+Shift+A'],
        disabled: vault === null,
        run: () => setAiPanelOpen((current) => !current)
      },
      {
        id: 'theme.toggle',
        title: 'Toggle theme',
        description: 'Switch between light and dark appearance.',
        category: 'App',
        keywords: ['dark', 'light'],
        run: toggleTheme
      },
      {
        id: 'vault.open',
        title: 'Open vault',
        description: 'Choose a vault folder from disk.',
        category: 'Vault',
        keywords: ['folder', 'workspace'],
        run: openVault
      },
      {
        id: 'vault.empty-trash',
        title: 'Empty trash',
        description: 'Permanently remove notes currently in trash.',
        category: 'Vault',
        keywords: ['delete', 'remove'],
        disabled: vault === null || trashCount === 0,
        run: () => setEmptyTrashOpen(true)
      }
    ],
    [
      createUniqueNote,
      indexNoteCount,
      insertCurrentDate,
      insertCurrentTime,
      insertTemplateAtCursor,
      noteTemplates,
      openDailyNote,
      openRandomNote,
      openVault,
      selectedPath,
      setAiPanelOpen,
      setCreateNoteOpen,
      setEmptyTrashOpen,
      setExportDialogOpen,
      setQuickSwitcherOpen,
      setSearchOpen,
      setViewMode,
      toggleTheme,
      trashCount,
      vault
    ]
  )
}
