import { Eye, PenLine, SquareCode } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'source' | 'live' | 'reading'

interface ViewModeToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  disabled?: boolean
}

const VIEW_MODES: Array<{ mode: ViewMode; label: string; icon: React.ReactNode }> = [
  {
    mode: 'source',
    label: 'Source',
    icon: <SquareCode className="size-3.5" aria-hidden="true" />
  },
  { mode: 'live', label: 'Live', icon: <PenLine className="size-3.5" aria-hidden="true" /> },
  { mode: 'reading', label: 'Reading', icon: <Eye className="size-3.5" aria-hidden="true" /> }
]

export function ViewModeToggle({
  value,
  onChange,
  disabled
}: ViewModeToggleProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex h-6 items-stretch border border-[var(--line)] bg-background [&>button+button]:border-l [&>button+button]:border-[var(--line)]"
    >
      {VIEW_MODES.map(({ mode, label, icon }) => {
        const isActive = value === mode
        return (
          <button
            key={mode}
            type="button"
            title={`${label} view`}
            aria-label={`${label} view`}
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={cn(
              'flex h-full items-center gap-1 px-1.5 font-mono text-[9px] font-bold uppercase tracking-wide transition-colors outline-none focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/60 motion-reduce:transition-none',
              isActive
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-[var(--paper-dark)] hover:text-foreground',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            )}
          >
            {icon}
            <span className="hidden lg:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
