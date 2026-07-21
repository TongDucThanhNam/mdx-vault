import { Hash, Link2, ListTree, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import { BacklinksPanel } from '@/panels/BacklinksPanel'
import { OutlinePanel } from '@/panels/OutlinePanel'
import { TagsPanel } from '@/panels/TagsPanel'

type NavigationPanel = 'outline' | 'tags' | 'backlinks'

interface NavigationTab {
  id: NavigationPanel
  label: string
  icon: LucideIcon
}

const NAVIGATION_TABS: NavigationTab[] = [
  { id: 'outline', label: 'Outline', icon: ListTree },
  { id: 'tags', label: 'Tags', icon: Hash },
  { id: 'backlinks', label: 'Backlinks', icon: Link2 }
]

type RightPanelIndex = Pick<
  NoteIndexController,
  | 'outlineHeadings'
  | 'tags'
  | 'selectedTag'
  | 'taggedNotes'
  | 'isLoadingTaggedNotes'
  | 'backlinks'
  | 'setSelectedTag'
>

interface RightPanelProps {
  selectedPath: string | null
  noteIndex: RightPanelIndex
  onSelectHeading: EditorInteractionsController['revealHeading']
  onSelectNote: NoteActionsController['navigateToNote']
}

export function RightPanel({
  selectedPath,
  noteIndex,
  onSelectHeading,
  onSelectNote
}: RightPanelProps): React.JSX.Element {
  const [activePanel, setActivePanel] = useState<NavigationPanel>('outline')

  return (
    <aside aria-label="Note navigation" className="min-h-0 min-w-0 bg-chrome">
      <div className="flex h-10 items-center justify-between border-b-2 border-foreground px-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Note
        </span>
        <div className="flex items-center gap-1" role="tablist" aria-label="Note navigation">
          {NAVIGATION_TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activePanel === id

            return (
              <Button
                key={id}
                id={`note-navigation-tab-${id}`}
                type="button"
                role="tab"
                size="icon-sm"
                variant={isActive ? 'outline' : 'ghost'}
                title={label}
                aria-label={label}
                aria-selected={isActive}
                aria-controls={`note-navigation-panel-${id}`}
                onClick={() => setActivePanel(id)}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </Button>
            )
          })}
        </div>
      </div>

      <div
        id={`note-navigation-panel-${activePanel}`}
        role="tabpanel"
        aria-labelledby={`note-navigation-tab-${activePanel}`}
        className="h-[calc(100%-2.5rem)] min-h-0 overflow-hidden"
      >
        <ActiveNavigationPanel
          activePanel={activePanel}
          selectedPath={selectedPath}
          noteIndex={noteIndex}
          onSelectHeading={onSelectHeading}
          onSelectNote={onSelectNote}
        />
      </div>
    </aside>
  )
}

function ActiveNavigationPanel({
  activePanel,
  selectedPath,
  noteIndex,
  onSelectHeading,
  onSelectNote
}: RightPanelProps & { activePanel: NavigationPanel }): React.JSX.Element {
  switch (activePanel) {
    case 'outline':
      return (
        <OutlinePanel
          headings={noteIndex.outlineHeadings}
          selectedPath={selectedPath}
          onSelectHeading={onSelectHeading}
        />
      )
    case 'tags':
      return (
        <TagsPanel
          tags={noteIndex.tags}
          selectedTag={noteIndex.selectedTag}
          taggedNotes={noteIndex.taggedNotes}
          isLoading={noteIndex.isLoadingTaggedNotes}
          onSelectTag={noteIndex.setSelectedTag}
          onSelectNote={onSelectNote}
        />
      )
    case 'backlinks':
      return (
        <BacklinksPanel
          backlinks={noteIndex.backlinks}
          selectedPath={selectedPath}
          onSelectNote={onSelectNote}
        />
      )
  }
}
