import { ArrowDownUp } from 'lucide-react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { FileTreeSortMode } from '@/explorer/FileTree'
import { useExitPresence } from '@/hooks/useExitPresence'
import { cn } from '@/lib/utils'

const SORT_OPTIONS: Array<{ mode: FileTreeSortMode; label: string }> = [
  { mode: 'name', label: 'Name (A→Z)' },
  { mode: 'modified-desc', label: 'Modified (newest)' },
  { mode: 'created-desc', label: 'Created (newest)*' }
]

interface SortMenuProps {
  sortMode: FileTreeSortMode
  onChange: (mode: FileTreeSortMode) => void
  disabled?: boolean
}

export function SortMenu({ sortMode, onChange, disabled }: SortMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const present = useExitPresence(open ? true : null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    menuRef.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus({ preventScroll: true })
  }, [open])

  const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false)
    }
  }

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return
    }

    event.preventDefault()
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
    )
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length
    items[nextIndex]?.focus()
  }

  return (
    <div className="relative" onBlur={closeWhenFocusLeaves}>
      <Button
        ref={triggerRef}
        type="button"
        size="icon-sm"
        variant={open ? 'outline' : 'ghost'}
        title={`Sort: ${SORT_OPTIONS.find((option) => option.mode === sortMode)?.label ?? 'Name'}`}
        aria-label="Sort files"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <ArrowDownUp className="size-3.5" aria-hidden="true" />
      </Button>
      {present ? (
        <div
          ref={menuRef}
          role="menu"
          data-state={open ? 'open' : 'closed'}
          inert={!open}
          aria-label="Sort files"
          className="absolute top-full right-0 z-40 mt-1 min-w-[190px] rounded-md border border-input bg-popover p-1 text-[13px] text-popover-foreground chrome-overlay shadow-chrome-overlay"
          onKeyDown={handleMenuKeyDown}
        >
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              role="menuitemradio"
              aria-checked={sortMode === option.mode}
              onClick={() => {
                onChange(option.mode)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between px-2 py-1.5 text-left outline-none transition-colors hover:bg-instrument-blue/10 hover:text-foreground focus-visible:bg-instrument-blue/10 focus-visible:text-foreground motion-reduce:transition-none',
                sortMode === option.mode && 'bg-instrument-blue/10 text-foreground font-semibold'
              )}
            >
              <span>{option.label}</span>
              {sortMode === option.mode ? (
                <span className="text-[var(--editorial-red)]">✓</span>
              ) : null}
            </button>
          ))}
          <p className="px-2 pt-1 font-sans text-xs text-muted-foreground">
            *Created time is not yet tracked; falls back to Name.
          </p>
        </div>
      ) : null}
    </div>
  )
}
