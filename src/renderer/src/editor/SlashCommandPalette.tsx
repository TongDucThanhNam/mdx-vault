import { Blocks, Command, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { CommandAction } from '@/commands/actions'
import { cn } from '@/lib/utils'
import type { RegistryInsertTemplate } from '@/preview/registry'

interface SlashCommandPaletteProps {
  commandActions: CommandAction[]
  componentTemplates: RegistryInsertTemplate[]
  onClose: () => void
  onInsertComponent: (template: RegistryInsertTemplate) => void
  onRunAction: (action: CommandAction) => void
}

type SlashItem =
  | {
      kind: 'component'
      id: string
      title: string
      description: string
      category: string
      disabled?: boolean
      template: RegistryInsertTemplate
    }
  | {
      kind: 'command'
      id: string
      title: string
      description: string
      category: string
      disabled?: boolean
      action: CommandAction
    }

export function SlashCommandPalette({
  commandActions,
  componentTemplates,
  onClose,
  onInsertComponent,
  onRunAction
}: SlashCommandPaletteProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const items = useMemo(
    () => buildSlashItems(commandActions, componentTemplates),
    [commandActions, componentTemplates]
  )
  const filteredItems = useMemo(() => filterSlashItems(items, query), [items, query])
  const activeIndex = Math.min(selectedIndex, Math.max(0, filteredItems.length - 1))

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [])

  const selectItem = (item: SlashItem): void => {
    if (item.disabled) {
      return
    }

    if (item.kind === 'component') {
      onInsertComponent(item.template)
      return
    }

    onRunAction(item.action)
  }

  return (
    <div className="absolute top-3 right-3 left-3 z-30 max-w-2xl border-2 border-foreground bg-popover p-2 text-popover-foreground shadow-[4px_4px_0_0_var(--foreground)]">
      <div className="flex items-center gap-2 border-b-2 border-foreground px-2 pb-2">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          className="h-8 min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Slash command"
          onChange={(event) => {
            setQuery(event.currentTarget.value)
            setSelectedIndex(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
              return
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSelectedIndex((current) => Math.min(current + 1, filteredItems.length - 1))
              return
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSelectedIndex((current) => Math.max(0, current - 1))
              return
            }

            if (event.key === 'Enter') {
              event.preventDefault()
              const selectedItem = filteredItems[activeIndex]

              if (selectedItem) {
                selectItem(selectedItem)
              }
            }
          }}
        />
      </div>

      <div className="mt-2 max-h-80 overflow-auto">
        {filteredItems.length > 0 ? (
          filteredItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              className={cn(
                'flex w-full items-start gap-3 px-2 py-2 text-left text-sm outline-none transition-colors',
                item.disabled
                  ? 'cursor-not-allowed opacity-45'
                  : index === activeIndex
                    ? 'bg-foreground text-background'
                    : 'hover:bg-foreground hover:text-background'
              )}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectItem(item)}
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center border-2 border-foreground bg-background text-foreground">
                {item.kind === 'component' ? (
                  <Blocks className="size-4" aria-hidden="true" />
                ) : (
                  <Command className="size-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-mono text-[12px] font-bold uppercase tracking-wider">
                    {item.title}
                  </span>
                  <span className="shrink-0 font-mono text-xs font-bold uppercase tracking-wider opacity-70">
                    {item.category}
                  </span>
                </span>
                <span className="mt-0.5 block truncate font-mono text-xs uppercase tracking-wider opacity-70">
                  {item.description}
                </span>
              </span>
            </button>
          ))
        ) : (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No matching command.
          </div>
        )}
      </div>
    </div>
  )
}

function buildSlashItems(
  commandActions: CommandAction[],
  componentTemplates: RegistryInsertTemplate[]
): SlashItem[] {
  const componentItems: SlashItem[] = componentTemplates.map((template) => ({
    kind: 'component',
    id: `component:${template.name}`,
    title: template.name,
    description: template.description,
    category: template.category,
    template
  }))

  const commandItems: SlashItem[] = commandActions.map((action) => ({
    kind: 'command',
    id: `command:${action.id}`,
    title: action.title,
    description: action.description,
    category: action.category,
    disabled: action.disabled,
    action
  }))

  return [...componentItems, ...commandItems]
}

function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  if (!normalizedQuery) {
    return items.slice(0, 40)
  }

  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreSlashItem(item, normalizedQuery)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        Number(left.item.disabled) - Number(right.item.disabled) ||
        right.score - left.score ||
        left.index - right.index
    )
    .map((candidate) => candidate.item)
    .slice(0, 40)
}

function scoreSlashItem(item: SlashItem, query: string): number {
  const text = `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase()

  if (text.startsWith(query)) {
    return 80
  }

  if (text.includes(query)) {
    return 55
  }

  return 0
}
