import { Hash, Link2, ListTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import { BacklinksPanel } from '@/panels/BacklinksPanel'
import { OutlinePanel } from '@/panels/OutlinePanel'
import { TagsPanel } from '@/panels/TagsPanel'

export type NavigationPanel = 'outline' | 'tags' | 'backlinks'

interface RightPanelProps {
  navigationPanel: NavigationPanel
  editor: NoteEditorController
  noteIndex: NoteIndexController
  noteActions: NoteActionsController
  editorInteractions: EditorInteractionsController
  setNavigationPanel: React.Dispatch<React.SetStateAction<NavigationPanel>>
}

export function RightPanel({
  navigationPanel,
  editor,
  noteIndex,
  noteActions,
  editorInteractions,
  setNavigationPanel
}: RightPanelProps): React.JSX.Element {
  return (
    <aside aria-label="Note navigation" className="min-h-0 min-w-0 bg-background">
      <div className="flex h-10 items-center justify-between border-b-2 border-foreground bg-[var(--paper-dark)] px-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Note
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant={navigationPanel === 'outline' ? 'outline' : 'ghost'}
            title="Outline"
            aria-label="Outline"
            aria-pressed={navigationPanel === 'outline'}
            onClick={() => setNavigationPanel('outline')}
          >
            <ListTree className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={navigationPanel === 'tags' ? 'outline' : 'ghost'}
            title="Tags"
            aria-label="Tags"
            aria-pressed={navigationPanel === 'tags'}
            onClick={() => setNavigationPanel('tags')}
          >
            <Hash className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={navigationPanel === 'backlinks' ? 'outline' : 'ghost'}
            title="Backlinks"
            aria-label="Backlinks"
            aria-pressed={navigationPanel === 'backlinks'}
            onClick={() => setNavigationPanel('backlinks')}
          >
            <Link2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="h-[calc(100%-2.5rem)] min-h-0 overflow-hidden bg-[var(--paper-dark)]">
        {navigationPanel === 'outline' ? (
          <OutlinePanel
            headings={noteIndex.outlineHeadings}
            selectedPath={editor.selectedPath}
            onSelectHeading={editorInteractions.revealHeading}
          />
        ) : navigationPanel === 'tags' ? (
          <TagsPanel
            tags={noteIndex.tags}
            selectedTag={noteIndex.selectedTag}
            taggedNotes={noteIndex.taggedNotes}
            isLoading={noteIndex.isLoadingTaggedNotes}
            onSelectTag={noteIndex.setSelectedTag}
            onSelectNote={noteActions.navigateToNote}
          />
        ) : (
          <BacklinksPanel
            backlinks={noteIndex.backlinks}
            selectedPath={editor.selectedPath}
            onSelectNote={noteActions.navigateToNote}
          />
        )}
      </div>
    </aside>
  )
}
