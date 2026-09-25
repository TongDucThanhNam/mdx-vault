import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Braces,
  FileText,
  Footprints,
  Link2,
  ListPlus,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { KnowledgeUtilitiesController } from '@/hooks/useKnowledgeUtilities'
import { deriveNoteTitle } from '@/lib/note-title'
import { cn } from '@/lib/utils'
import type { IndexedNoteSummary } from '@/vault/types'
import {
  addBookmarkGroup,
  addBookmarkItem,
  type BookmarkManifest,
  type BookmarkNode,
  moveBookmarkNode,
  removeBookmarkNode,
  updateBookmarkNode
} from '../../../shared/bookmarks'
import type {
  FileProperty,
  FootnoteEntry,
  OutgoingLinkResult,
  PropertyMutationInput,
  PropertyRenamePlan,
  PropertyValue,
  SourceRange,
  UnlinkedMention
} from '../../../shared/knowledge'
import { parseWikilinkParts, resolveWikilinkTarget } from '../../../shared/wikilinks'

interface ActiveKnowledgePanelProps {
  selectedPath: string | null
  controller: KnowledgeUtilitiesController
  source: string
  isDirty: boolean
  propertyAddRequest: number
  onSelectNote: (relativePath: string) => void
  onRevealRange: (range: SourceRange) => void
  onOpenSearch: (query: string) => void
}

export function OutgoingLinksPanel({
  selectedPath,
  controller,
  isDirty,
  onSelectNote
}: Pick<
  ActiveKnowledgePanelProps,
  'selectedPath' | 'controller' | 'isDirty' | 'onSelectNote'
>): React.JSX.Element {
  const snapshot = controller.snapshot
  return (
    <PanelFrame
      icon={Link2}
      title="Outgoing links"
      count={(snapshot?.outgoingLinks.length ?? 0) + (snapshot?.mentions.length ?? 0)}
    >
      <FreshnessNotice
        selectedPath={selectedPath}
        isDirty={isDirty}
        loading={controller.isLoading}
      />
      {snapshot ? (
        <div className="space-y-4">
          <PanelSection title="Linked destinations" count={snapshot.outgoingLinks.length}>
            {snapshot.outgoingLinks.length === 0 ? (
              <EmptyLine>No outgoing links.</EmptyLine>
            ) : (
              snapshot.outgoingLinks.map((link) => (
                <OutgoingLinkRow
                  key={`${link.sourceFrom}-${link.sourceTo}`}
                  link={link}
                  onSelectNote={onSelectNote}
                />
              ))
            )}
          </PanelSection>
          <PanelSection title="Unlinked mentions" count={snapshot.mentions.length}>
            {snapshot.mentions.length === 0 ? (
              <EmptyLine>No unlinked mentions.</EmptyLine>
            ) : (
              snapshot.mentions.map((mention) => (
                <MentionRow
                  key={`${mention.range.from}-${mention.range.to}`}
                  mention={mention}
                  busy={controller.isMutating}
                  onLink={controller.linkMention}
                />
              ))
            )}
          </PanelSection>
        </div>
      ) : null}
    </PanelFrame>
  )
}

function OutgoingLinkRow({
  link,
  onSelectNote
}: {
  link: OutgoingLinkResult
  onSelectNote: (relativePath: string) => void
}): React.JSX.Element {
  return (
    <div className="border-l-2 border-foreground/20 px-2 py-2">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-xs font-bold">{link.display}</span>
        <span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground">
          {link.kind}
        </span>
      </div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
        {link.target}
        {link.subpath}
      </div>
      {link.resolved.length === 0 ? (
        <div className="mt-1 text-xs text-destructive">Unresolved destination</div>
      ) : (
        <div className="mt-1 space-y-1">
          {link.resolved.map((note) => (
            <button
              key={note.relativePath}
              type="button"
              data-page-preview-path={note.relativePath}
              className="flex w-full items-center gap-2 px-1 py-1 text-left text-xs hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              title={note.relativePath}
              onClick={() => onSelectNote(note.relativePath)}
            >
              <FileText className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{note.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MentionRow({
  mention,
  busy,
  onLink
}: {
  mention: UnlinkedMention
  busy: boolean
  onLink: (mention: UnlinkedMention, targetRelativePath: string) => Promise<boolean>
}): React.JSX.Element {
  const [target, setTarget] = useState(mention.candidates[0]?.relativePath ?? '')
  return (
    <div className="border-l-2 border-editorial-red px-2 py-2">
      <div className="font-serif text-sm">“{mention.text}”</div>
      <div className="mt-2 flex gap-1">
        <select
          aria-label={`Destination for ${mention.text}`}
          value={target}
          className="h-8 min-w-0 flex-1 border-2 border-foreground bg-background px-1 font-mono text-[10px]"
          onChange={(event) => setTarget(event.currentTarget.value)}
        >
          {mention.candidates.map((candidate) => (
            <option key={candidate.relativePath} value={candidate.relativePath}>
              {candidate.title} · {candidate.relativePath}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          disabled={busy || !target}
          onClick={() => void onLink(mention, target)}
        >
          Link
        </Button>
      </div>
    </div>
  )
}

export function PropertiesPanel({
  selectedPath,
  controller,
  isDirty,
  propertyAddRequest,
  onRevealRange,
  notes,
  onSelectNote
}: Pick<
  ActiveKnowledgePanelProps,
  | 'selectedPath'
  | 'controller'
  | 'isDirty'
  | 'propertyAddRequest'
  | 'onRevealRange'
  | 'onSelectNote'
> & {
  notes: IndexedNoteSummary[]
}): React.JSX.Element {
  const [scope, setScope] = useState<'file' | 'all'>('file')
  const [adding, setAdding] = useState(false)
  const [renamePlan, setRenamePlan] = useState<PropertyRenamePlan | null>(null)
  const addNameRef = useRef<HTMLInputElement>(null)
  const snapshot = controller.snapshot

  useEffect(() => {
    if (propertyAddRequest > 0) {
      setScope('file')
      setAdding(true)
      window.setTimeout(() => addNameRef.current?.focus(), 0)
    }
  }, [propertyAddRequest])

  return (
    <PanelFrame
      icon={Braces}
      title="Properties"
      count={
        scope === 'file' ? (snapshot?.properties.length ?? 0) : controller.propertyInventory.length
      }
      action={
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          title="Add property"
          aria-label="Add property"
          disabled={!selectedPath || isDirty}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      }
    >
      <div className="mb-3 grid grid-cols-2 border-2 border-foreground" role="tablist">
        {(['file', 'all'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={scope === id}
            className={cn(
              'h-8 font-mono text-[10px] font-bold uppercase tracking-wider',
              scope === id ? 'bg-foreground text-background' : 'bg-background'
            )}
            onClick={() => setScope(id)}
          >
            {id === 'file' ? 'File properties' : 'All properties'}
          </button>
        ))}
      </div>
      <FreshnessNotice
        selectedPath={selectedPath}
        isDirty={isDirty}
        loading={controller.isLoading}
      />
      {adding ? (
        <AddPropertyForm
          inputRef={addNameRef}
          busy={controller.isMutating}
          onCancel={() => setAdding(false)}
          onAdd={async (mutation) => {
            if (await controller.mutateProperty(mutation)) setAdding(false)
          }}
        />
      ) : null}
      {scope === 'file' ? (
        snapshot?.propertyParseError ? (
          <div role="alert" className="border-2 border-destructive p-3 text-xs text-destructive">
            {snapshot.propertyParseError}
          </div>
        ) : snapshot?.properties.length ? (
          <div className="space-y-2">
            {snapshot.properties.map((property) => (
              <PropertyRow
                key={property.normalizedName}
                property={property}
                busy={controller.isMutating || isDirty}
                onMutate={controller.mutateProperty}
                onReveal={() => onRevealRange(property.valueRange ?? property.keyRange)}
                notes={notes}
                onSelectNote={onSelectNote}
              />
            ))}
          </div>
        ) : (
          <EmptyLine>No properties in this file.</EmptyLine>
        )
      ) : (
        <div className="space-y-1">
          {controller.propertyInventory.map((property) => (
            <button
              key={property.normalizedName}
              type="button"
              className="flex w-full items-center justify-between gap-2 border-l-2 border-transparent px-2 py-2 text-left hover:border-editorial-red hover:bg-foreground hover:text-background"
              onClick={() => {
                const nextName = window.prompt(`Rename “${property.name}” to:`)
                if (!nextName?.trim()) return
                void controller
                  .planPropertyRename(property.name, nextName)
                  .then((plan) => setRenamePlan(plan))
              }}
            >
              <span className="truncate text-sm font-medium">{property.name}</span>
              <span className="font-mono text-[10px] opacity-70">
                {property.type} · {property.useCount}
              </span>
            </button>
          ))}
        </div>
      )}
      {renamePlan ? (
        <RenamePlanCard
          plan={renamePlan}
          busy={controller.isMutating}
          onCancel={() => setRenamePlan(null)}
          onApply={async () => {
            if (await controller.applyPropertyRename(renamePlan)) setRenamePlan(null)
          }}
        />
      ) : null}
    </PanelFrame>
  )
}

function PropertyRow({
  property,
  busy,
  onMutate,
  onReveal,
  notes,
  onSelectNote
}: {
  property: FileProperty
  busy: boolean
  onMutate: (mutation: PropertyMutationInput) => Promise<boolean>
  onReveal: () => void
  notes: IndexedNoteSummary[]
  onSelectNote: (relativePath: string) => void
}): React.JSX.Element {
  const initial =
    property.type === 'list' || property.type === 'tags'
      ? property.values.join(', ')
      : (property.values[0] ?? '')
  const [value, setValue] = useState(initial)
  const linkedNotes = resolvePropertyNoteLinks(property.values, notes)

  useEffect(() => setValue(initial), [initial])

  if (!property.editable) {
    return (
      <div className="border-2 border-foreground/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-bold">{property.name}</span>
          <Button type="button" size="sm" variant="outline" onClick={onReveal}>
            Source
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{property.unsupportedReason}</p>
      </div>
    )
  }

  const commit = (): void => {
    const nextValue = parsePropertyInput(property, value)
    void onMutate({ kind: 'set', name: property.name, value: nextValue })
  }

  return (
    <div className="border-2 border-foreground bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label
          htmlFor={`property-${property.normalizedName}`}
          className="font-mono text-[11px] font-bold"
        >
          {property.name}
        </label>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[9px] uppercase text-muted-foreground">
            {property.type}
          </span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            title={`Delete ${property.name}`}
            aria-label={`Delete ${property.name}`}
            disabled={busy}
            onClick={() => void onMutate({ kind: 'delete', name: property.name })}
          >
            <Trash2 className="size-3" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {property.type === 'checkbox' ? (
        <input
          id={`property-${property.normalizedName}`}
          type="checkbox"
          checked={value === 'true'}
          disabled={busy}
          className="size-5 accent-editorial-red"
          onChange={(event) => {
            const checked = event.currentTarget.checked
            setValue(String(checked))
            void onMutate({ kind: 'set', name: property.name, value: checked })
          }}
        />
      ) : (
        <input
          id={`property-${property.normalizedName}`}
          type={
            property.type === 'date'
              ? 'date'
              : property.type === 'date-time'
                ? 'datetime-local'
                : property.type === 'number'
                  ? 'number'
                  : 'text'
          }
          value={value}
          disabled={busy}
          className="h-9 w-full border-2 border-foreground bg-background px-2 font-mono text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onChange={(event) => setValue(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
          }}
        />
      )}
      {linkedNotes.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {linkedNotes.map((note) => (
            <button
              key={note.relativePath}
              type="button"
              data-page-preview-path={note.relativePath}
              className="border border-foreground px-1.5 py-1 font-mono text-[9px] hover:bg-foreground hover:text-background focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={() => onSelectNote(note.relativePath)}
            >
              ↗ {note.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AddPropertyForm({
  inputRef,
  busy,
  onCancel,
  onAdd
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  busy: boolean
  onCancel: () => void
  onAdd: (mutation: PropertyMutationInput) => Promise<void>
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  return (
    <form
      className="mb-3 border-2 border-editorial-red bg-background p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (name.trim()) void onAdd({ kind: 'add', name, value })
      }}
    >
      <div className="font-mono text-[10px] font-bold uppercase tracking-wider">New property</div>
      <input
        ref={inputRef}
        value={name}
        placeholder="Property name"
        aria-label="Property name"
        className="mt-2 h-9 w-full border-2 border-foreground px-2 font-mono text-xs"
        onChange={(event) => setName(event.currentTarget.value)}
      />
      <input
        value={value}
        placeholder="Value"
        aria-label="Property value"
        className="mt-2 h-9 w-full border-2 border-foreground px-2 font-mono text-xs"
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy || !name.trim()}>
          Add
        </Button>
      </div>
    </form>
  )
}

function RenamePlanCard({
  plan,
  busy,
  onCancel,
  onApply
}: {
  plan: PropertyRenamePlan
  busy: boolean
  onCancel: () => void
  onApply: () => void
}): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-label="Property rename preview"
      className="sticky bottom-2 mt-3 border-2 border-foreground bg-popover p-3 shadow-[3px_3px_0_var(--foreground)]"
    >
      <div className="font-display text-base font-bold">Rename preview</div>
      <p className="mt-1 text-xs">
        {plan.oldName} → {plan.newName} in {plan.affectedFiles.length} file
        {plan.affectedFiles.length === 1 ? '' : 's'}.
      </p>
      {!plan.canApply ? (
        <div className="mt-2 text-xs text-destructive">
          Resolve{' '}
          {plan.affectedFiles.filter((file) => file.collision || file.unsupportedReason).length}{' '}
          collision or unsupported file before applying.
        </div>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={busy || !plan.canApply} onClick={onApply}>
          Rename
        </Button>
      </div>
    </div>
  )
}

export function BookmarksPanel({
  selectedPath,
  controller,
  onSelectNote,
  onSelectHeading,
  onSelectFolder,
  onOpenSearch
}: Pick<
  ActiveKnowledgePanelProps,
  'selectedPath' | 'controller' | 'onSelectNote' | 'onOpenSearch'
> & {
  onSelectHeading: (relativePath: string, heading: string) => void
  onSelectFolder: (relativePath: string) => void
}): React.JSX.Element {
  const manifest = controller.bookmarks
  const save = (next: BookmarkManifest): void => void controller.saveBookmarks(next)
  return (
    <PanelFrame
      icon={Bookmark}
      title="Bookmarks"
      count={manifest ? countBookmarkNodes(manifest.children) : 0}
      action={
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Add active note"
            aria-label="Add active note"
            disabled={!manifest || !selectedPath || controller.isMutating}
            onClick={() => {
              if (!manifest || !selectedPath) return
              save(
                addBookmarkItem(manifest, {
                  id: crypto.randomUUID(),
                  title: deriveNoteTitle(selectedPath),
                  target: { kind: 'file', relativePath: selectedPath }
                })
              )
            }}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Add bookmark group"
            aria-label="Add bookmark group"
            disabled={!manifest || controller.isMutating}
            onClick={() => {
              const title = window.prompt('Bookmark group name')
              if (!manifest || !title?.trim()) return
              save(addBookmarkGroup(manifest, { id: crypto.randomUUID(), title }))
            }}
          >
            <ListPlus className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      }
    >
      {!manifest ? (
        <EmptyLine>
          {controller.isLoading ? 'Loading bookmarks…' : 'Bookmarks unavailable.'}
        </EmptyLine>
      ) : manifest.children.length === 0 ? (
        <EmptyLine>No bookmarks yet.</EmptyLine>
      ) : (
        <BookmarkTree
          manifest={manifest}
          nodes={manifest.children}
          parentId={null}
          busy={controller.isMutating}
          onSave={save}
          onSelectNote={onSelectNote}
          onSelectHeading={onSelectHeading}
          onSelectFolder={onSelectFolder}
          onOpenSearch={onOpenSearch}
        />
      )}
    </PanelFrame>
  )
}

function BookmarkTree({
  manifest,
  nodes,
  parentId,
  busy,
  onSave,
  onSelectNote,
  onSelectHeading,
  onSelectFolder,
  onOpenSearch
}: {
  manifest: BookmarkManifest
  nodes: BookmarkNode[]
  parentId: string | null
  busy: boolean
  onSave: (manifest: BookmarkManifest) => void
  onSelectNote: (relativePath: string) => void
  onSelectHeading: (relativePath: string, heading: string) => void
  onSelectFolder: (relativePath: string) => void
  onOpenSearch: (query: string) => void
}): React.JSX.Element {
  return (
    <div className={cn('space-y-1', parentId && 'ml-3 border-l border-foreground/30 pl-2')}>
      {nodes.map((node, index) => (
        <div
          key={node.id}
          draggable={!busy}
          onDragStart={(event) => event.dataTransfer.setData('text/bookmark-id', node.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const movingId = event.dataTransfer.getData('text/bookmark-id')
            if (movingId && movingId !== node.id) {
              onSave(
                moveBookmarkNode(
                  manifest,
                  movingId,
                  node.kind === 'group' ? node.id : parentId,
                  node.kind === 'group' ? node.children.length : index
                )
              )
            }
          }}
        >
          <div className="group flex min-h-9 items-center gap-1 border-l-2 border-transparent px-1 hover:border-editorial-red hover:bg-background">
            <button
              type="button"
              data-page-preview-path={
                node.kind === 'item' &&
                node.target.kind !== 'search' &&
                node.target.kind !== 'folder'
                  ? node.target.relativePath
                  : undefined
              }
              className="min-w-0 flex-1 truncate text-left text-xs"
              onClick={() => {
                if (node.kind === 'group') {
                  onSave(updateBookmarkNode(manifest, node.id, { expanded: !node.expanded }))
                } else if (node.target.kind === 'search') {
                  onOpenSearch(node.target.query)
                } else if (node.target.kind === 'heading') {
                  onSelectHeading(node.target.relativePath, node.target.heading)
                } else if (node.target.kind === 'folder') {
                  onSelectFolder(node.target.relativePath)
                } else {
                  onSelectNote(node.target.relativePath)
                }
              }}
            >
              {node.kind === 'group' ? (node.expanded ? '▾ ' : '▸ ') : ''}
              {bookmarkNodeTitle(node)}
            </button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              title="Move up"
              aria-label={`Move ${bookmarkNodeTitle(node)} up`}
              disabled={busy || index === 0}
              onClick={() => onSave(moveBookmarkNode(manifest, node.id, parentId, index - 1))}
            >
              <ArrowUp className="size-3" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              title="Move down"
              aria-label={`Move ${bookmarkNodeTitle(node)} down`}
              disabled={busy || index === nodes.length - 1}
              onClick={() => onSave(moveBookmarkNode(manifest, node.id, parentId, index + 1))}
            >
              <ArrowDown className="size-3" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              title="Rename bookmark"
              aria-label={`Rename ${bookmarkNodeTitle(node)}`}
              disabled={busy}
              onClick={() => {
                const title = window.prompt('Bookmark title', bookmarkNodeTitle(node))
                if (!title?.trim()) return
                onSave(updateBookmarkNode(manifest, node.id, { title: title.trim() }))
              }}
            >
              <Pencil className="size-3" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              title="Remove bookmark"
              aria-label={`Remove ${bookmarkNodeTitle(node)}`}
              disabled={busy}
              onClick={() => onSave(removeBookmarkNode(manifest, node.id))}
            >
              <Trash2 className="size-3" aria-hidden="true" />
            </Button>
          </div>
          {node.kind === 'group' && node.expanded ? (
            <BookmarkTree
              manifest={manifest}
              nodes={node.children}
              parentId={node.id}
              busy={busy}
              onSave={onSave}
              onSelectNote={onSelectNote}
              onSelectHeading={onSelectHeading}
              onSelectFolder={onSelectFolder}
              onOpenSearch={onOpenSearch}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function FootnotesPanel({
  selectedPath,
  controller,
  source,
  isDirty,
  onRevealRange
}: Pick<
  ActiveKnowledgePanelProps,
  'selectedPath' | 'controller' | 'source' | 'isDirty' | 'onRevealRange'
>): React.JSX.Element {
  const entries = controller.snapshot?.footnotes.entries ?? []
  return (
    <PanelFrame icon={Footprints} title="Footnotes" count={entries.length}>
      <FreshnessNotice
        selectedPath={selectedPath}
        isDirty={isDirty}
        loading={controller.isLoading}
      />
      {entries.length === 0 ? (
        <EmptyLine>No footnotes.</EmptyLine>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <FootnoteRow
              key={entry.identifier}
              entry={entry}
              source={source}
              onRevealRange={onRevealRange}
            />
          ))}
        </div>
      )}
    </PanelFrame>
  )
}

function FootnoteRow({
  entry,
  source,
  onRevealRange
}: {
  entry: FootnoteEntry
  source: string
  onRevealRange: (range: SourceRange) => void
}): React.JSX.Element {
  const [referenceIndex, setReferenceIndex] = useState(0)
  const revealReference = (index: number): void => {
    if (entry.referenceRanges.length === 0) return
    const nextIndex = (index + entry.referenceRanges.length) % entry.referenceRanges.length
    setReferenceIndex(nextIndex)
    const range = entry.referenceRanges[nextIndex]
    if (range) onRevealRange(range)
  }

  return (
    <div className="border-2 border-foreground/30 bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="font-mono text-xs font-bold hover:text-editorial-red"
          disabled={!entry.definitionRange}
          onClick={() => entry.definitionRange && onRevealRange(entry.definitionRange)}
        >
          [^{entry.identifier}]
        </button>
        <span
          className={cn(
            'font-mono text-[9px] uppercase',
            entry.status === 'defined' ? 'text-muted-foreground' : 'text-destructive'
          )}
        >
          {entry.status.replace('-', ' ')}
        </span>
      </div>
      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
        {entry.preview || 'No definition text.'}
      </p>
      {entry.referenceRanges.length > 0 ? (
        <div className="mt-2 flex items-center gap-1">
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            title="Previous reference"
            aria-label={`Previous reference for ${entry.identifier}`}
            onClick={() => revealReference(referenceIndex - 1)}
          >
            <ArrowUp className="size-3" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-w-0 flex-1"
            onClick={() => revealReference(referenceIndex)}
          >
            Ref {referenceIndex + 1}/{entry.referenceRanges.length} · L
            {lineAtOffset(source, entry.referenceRanges[referenceIndex]?.from ?? 0)}
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            title="Next reference"
            aria-label={`Next reference for ${entry.identifier}`}
            onClick={() => revealReference(referenceIndex + 1)}
          >
            <ArrowDown className="size-3" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PanelFrame({
  icon: Icon,
  title,
  count,
  action,
  children
}: {
  icon: typeof Link2
  title: string
  count: number
  action?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b-2 border-foreground px-3">
        <div className="flex min-w-0 items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{count}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">{children}</div>
    </div>
  )
}

function PanelSection({
  title,
  count,
  children
}: {
  title: string
  count: number
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between border-b border-foreground/30 px-1 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>{title}</span>
        <span>{count}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function FreshnessNotice({
  selectedPath,
  isDirty,
  loading
}: {
  selectedPath: string | null
  isDirty: boolean
  loading: boolean
}): React.JSX.Element | null {
  if (!selectedPath) return <EmptyLine>Select a note.</EmptyLine>
  if (isDirty) {
    return (
      <div className="mb-2 border-l-2 border-editorial-red px-2 py-1 text-xs text-muted-foreground">
        Save the note to refresh knowledge utilities and enable source edits.
      </div>
    )
  }
  if (loading) return <EmptyLine>Refreshing…</EmptyLine>
  return null
}

function EmptyLine({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="px-2 py-6 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  )
}

function parsePropertyInput(property: FileProperty, value: string): PropertyValue {
  if (property.type === 'number') {
    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }
  if (property.type === 'list' || property.type === 'tags') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return value
}

function bookmarkNodeTitle(node: BookmarkNode): string {
  if (node.kind === 'group') return node.title
  if (node.title) return node.title
  if (node.target.kind === 'search') return node.target.query
  if (node.target.kind === 'heading')
    return `${deriveNoteTitle(node.target.relativePath)} · ${node.target.heading}`
  return deriveNoteTitle(node.target.relativePath)
}

function countBookmarkNodes(nodes: BookmarkNode[]): number {
  return nodes.reduce(
    (count, node) => count + 1 + (node.kind === 'group' ? countBookmarkNodes(node.children) : 0),
    0
  )
}

function lineAtOffset(source: string, offset: number): number {
  return source.slice(0, Math.max(0, offset)).split(/\r?\n/u).length
}

function resolvePropertyNoteLinks(
  values: string[],
  notes: IndexedNoteSummary[]
): IndexedNoteSummary[] {
  const resolved = new Map<string, IndexedNoteSummary>()
  for (const value of values) {
    for (const match of value.matchAll(/\[\[([^\]\n]+)\]\]/gu)) {
      const parts = match[1] ? parseWikilinkParts(match[1]) : null
      const note = parts ? resolveWikilinkTarget(notes, parts.target) : null
      if (note) resolved.set(note.relativePath, note)
    }
  }
  return [...resolved.values()]
}
