import {
  Bookmark,
  Braces,
  ChevronDown,
  Footprints,
  Hash,
  Link2,
  ListTree,
  type LucideIcon,
  Network,
  Waypoints
} from 'lucide-react'
import { lazy, Suspense } from 'react'
import type { LocalGraphUnavailableReason } from '@/graph/local-graph-state'
import type { EditorInteractionsController } from '@/hooks/useEditorInteractions'
import type { KnowledgeUtilitiesController } from '@/hooks/useKnowledgeUtilities'
import type { NoteActionsController } from '@/hooks/useNoteActions'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import { BacklinksPanel } from '@/panels/BacklinksPanel'
import {
  BookmarksPanel,
  FootnotesPanel,
  OutgoingLinksPanel,
  PropertiesPanel
} from '@/panels/KnowledgePanels'
import { OutlinePanel } from '@/panels/OutlinePanel'
import { TagsPanel } from '@/panels/TagsPanel'
import type { NoteHeadingResult } from '@/vault/types'
import type { KnowledgePanelId, SourceRange } from '../../../../shared/knowledge'

const LazyGraphSurface = lazy(async () => {
  const module = await import('@/graph/GraphSurface')
  return { default: module.GraphSurface }
})

interface NavigationOption {
  id: KnowledgePanelId
  label: string
  icon: LucideIcon
}

const NAVIGATION_OPTIONS: readonly NavigationOption[] = [
  { id: 'outline', label: 'Outline', icon: ListTree },
  { id: 'tags', label: 'Tags', icon: Hash },
  { id: 'backlinks', label: 'Backlinks', icon: Link2 },
  { id: 'outgoing', label: 'Outgoing links', icon: Network },
  { id: 'properties', label: 'Properties', icon: Braces },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
  { id: 'footnotes', label: 'Footnotes', icon: Footprints },
  { id: 'local-graph', label: 'Local graph', icon: Waypoints }
]

type RightPanelIndex = Pick<
  NoteIndexController,
  | 'outlineHeadings'
  | 'tags'
  | 'selectedTag'
  | 'taggedNotes'
  | 'isLoadingTaggedNotes'
  | 'backlinks'
  | 'indexNotes'
  | 'setSelectedTag'
>

interface RightPanelProps {
  hasVault: boolean
  vaultSessionId: number
  activePanel: KnowledgePanelId
  selectedPath: string | null
  localGraphRoot: string | null
  localGraphUnavailableReason: LocalGraphUnavailableReason | null
  source: string
  isDirty: boolean
  propertyAddRequest: number
  noteIndex: RightPanelIndex
  outlineHeadings: readonly NoteHeadingResult[]
  activeHeadingId: string | null
  knowledge: KnowledgeUtilitiesController
  onActivePanelChange: (panel: KnowledgePanelId) => void
  onSelectHeading: EditorInteractionsController['revealHeading']
  onBookmarkHeading: (heading: NoteHeadingResult) => void
  onRevealRange: (range: SourceRange) => void
  onSelectNote: NoteActionsController['navigateToNote']
  onSelectBookmarkHeading: (relativePath: string, heading: string) => void
  onSelectBookmarkFolder: (relativePath: string) => void
  onOpenSearch: (query: string) => void
  onBookmarkNote: (relativePath: string, title: string) => void | Promise<void>
  onCopyRelativePath: (relativePath: string) => void
  onRevealInExplorer: (relativePath: string) => void
}

export function RightPanel(props: RightPanelProps): React.JSX.Element {
  const selectedOption =
    NAVIGATION_OPTIONS.find((option) => option.id === props.activePanel) ?? NAVIGATION_OPTIONS[0]
  const ActiveIcon = selectedOption.icon

  return (
    <aside aria-label="Context utilities" className="h-full min-h-0 min-w-0 bg-chrome">
      <div className="relative flex h-10 items-center border-b border-border px-2">
        <ActiveIcon
          className="pointer-events-none absolute left-4 size-3.5 text-instrument-blue"
          aria-hidden="true"
        />
        <label htmlFor="context-utility-selector" className="sr-only">
          Context utility
        </label>
        <select
          id="context-utility-selector"
          value={props.activePanel}
          className="h-8 w-full appearance-none rounded-sm border border-transparent bg-chrome pr-8 pl-8 font-sans text-xs font-semibold text-foreground outline-none hover:border-border focus-visible:border-instrument-blue focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) =>
            props.onActivePanelChange(event.currentTarget.value as KnowledgePanelId)
          }
        >
          {NAVIGATION_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-4 size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      <div
        id={`context-utility-panel-${props.activePanel}`}
        className="h-[calc(100%-2.5rem)] min-h-0 overflow-hidden"
      >
        <ActiveNavigationPanel {...props} />
      </div>
    </aside>
  )
}

function ActiveNavigationPanel({
  hasVault,
  vaultSessionId,
  activePanel,
  selectedPath,
  localGraphRoot,
  localGraphUnavailableReason,
  source,
  isDirty,
  propertyAddRequest,
  noteIndex,
  outlineHeadings,
  activeHeadingId,
  knowledge,
  onSelectHeading,
  onBookmarkHeading,
  onRevealRange,
  onSelectNote,
  onSelectBookmarkHeading,
  onSelectBookmarkFolder,
  onOpenSearch,
  onBookmarkNote,
  onCopyRelativePath,
  onRevealInExplorer
}: RightPanelProps): React.JSX.Element {
  switch (activePanel) {
    case 'outline':
      return (
        <OutlinePanel
          headings={outlineHeadings}
          activeHeadingId={activeHeadingId}
          selectedPath={selectedPath}
          onSelectHeading={onSelectHeading}
          onBookmarkHeading={onBookmarkHeading}
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
    case 'outgoing':
      return (
        <OutgoingLinksPanel
          selectedPath={selectedPath}
          controller={knowledge}
          isDirty={isDirty}
          onSelectNote={onSelectNote}
        />
      )
    case 'properties':
      return (
        <PropertiesPanel
          selectedPath={selectedPath}
          controller={knowledge}
          isDirty={isDirty}
          propertyAddRequest={propertyAddRequest}
          onRevealRange={onRevealRange}
          notes={noteIndex.indexNotes}
          onSelectNote={onSelectNote}
        />
      )
    case 'bookmarks':
      return (
        <BookmarksPanel
          selectedPath={selectedPath}
          controller={knowledge}
          onSelectNote={onSelectNote}
          onSelectHeading={onSelectBookmarkHeading}
          onSelectFolder={onSelectBookmarkFolder}
          onOpenSearch={onOpenSearch}
        />
      )
    case 'footnotes':
      return (
        <FootnotesPanel
          selectedPath={selectedPath}
          controller={knowledge}
          source={source}
          isDirty={isDirty}
          onRevealRange={onRevealRange}
        />
      )
    case 'local-graph':
      return (
        <Suspense
          fallback={
            <div className="grid h-full place-items-center p-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Loading local graph…
            </div>
          }
        >
          <LazyGraphSurface
            mode="local"
            compact
            hasVault={hasVault}
            vaultSessionId={vaultSessionId}
            rootRelativePath={localGraphRoot}
            localUnavailableReason={localGraphUnavailableReason}
            activeRelativePath={localGraphRoot}
            onOpenNote={onSelectNote}
            onBookmarkNote={onBookmarkNote}
            onCopyRelativePath={onCopyRelativePath}
            onRevealInExplorer={onRevealInExplorer}
          />
        </Suspense>
      )
  }
}
