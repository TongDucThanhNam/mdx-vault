import { CircleHelp, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import type { RegistryInsertTemplate } from '@/preview/registry'

interface ComponentInsertPaletteProps {
  templates: RegistryInsertTemplate[]
  onClose: () => void
  onSelect: (template: RegistryInsertTemplate) => void
}

export function ComponentInsertPalette({
  templates,
  onClose,
  onSelect
}: ComponentInsertPaletteProps): React.JSX.Element | null {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return templates
    }

    return templates.filter((template) => {
      const searchableText =
        `${template.name} ${template.description} ${template.category}`.toLowerCase()
      return searchableText.includes(normalizedQuery)
    })
  }, [query, templates])
  const activeIndex = Math.min(selectedIndex, Math.max(0, filteredTemplates.length - 1))

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="absolute top-3 right-3 left-3 z-20 max-w-xl rounded-md border bg-popover p-2 text-popover-foreground shadow-lg">
      <div className="flex items-center gap-2 border-b px-2 pb-2">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Insert interactive component"
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
              return
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setSelectedIndex((current) => Math.min(current + 1, filteredTemplates.length - 1))
              return
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setSelectedIndex((current) => Math.max(0, current - 1))
              return
            }

            if (event.key === 'Enter') {
              event.preventDefault()
              const selectedTemplate = filteredTemplates[activeIndex]

              if (selectedTemplate) {
                onSelect(selectedTemplate)
              }
            }
          }}
        />
      </div>

      <div className="mt-2 max-h-72 overflow-auto">
        {filteredTemplates.length > 0 ? (
          filteredTemplates.map((template, index) => (
            <button
              key={template.name}
              type="button"
              className={cn(
                'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left text-sm outline-none',
                index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
              )}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(template)}
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border bg-background">
                <CircleHelp className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{template.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {template.description}
                </span>
              </span>
            </button>
          ))
        ) : (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No matching component.
          </div>
        )}
      </div>
    </div>
  )
}
