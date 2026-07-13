import { Columns2, Eye, SquareCode } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'source' | 'split' | 'preview'

interface ViewModeToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  disabled?: boolean
  dark?: boolean
}

const VIEW_MODES: Array<{ mode: ViewMode; label: string; icon: React.ReactNode }> = [
  {
    mode: 'source',
    label: 'Source',
    icon: <SquareCode className="size-3.5" aria-hidden="true" />
  },
  { mode: 'split', label: 'Split', icon: <Columns2 className="size-3.5" aria-hidden="true" /> },
  { mode: 'preview', label: 'Preview', icon: <Eye className="size-3.5" aria-hidden="true" /> }
]

export function ViewModeToggle({
  value,
  onChange,
  disabled,
  dark = false
}: ViewModeToggleProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label="View mode"
      className={cn(
        'flex items-center gap-0.5 border-2 p-0.5',
        dark ? 'border-background' : 'border-foreground'
      )}
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
              'flex h-7 items-center gap-1 px-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 motion-reduce:transition-none',
              isActive
                ? dark
                  ? 'bg-background text-foreground'
                  : 'bg-foreground text-background'
                : dark
                  ? 'text-background/70 hover:bg-background hover:text-foreground'
                  : 'text-muted-foreground hover:bg-foreground hover:text-background',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
