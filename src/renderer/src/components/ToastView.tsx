import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useExitPresence } from '@/hooks/useExitPresence'
import type { ToastState } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

export type ToastVariant = 'default' | 'destructive'

interface ToastViewProps {
  message: string
  variant: ToastVariant
  open?: boolean
}

export function ToastRegion({ toast }: { toast: ToastState | null }): React.JSX.Element | null {
  const retained = useExitPresence(toast)
  return retained ? (
    <ToastView
      key={retained.key}
      message={retained.message}
      variant={retained.variant}
      open={toast !== null}
    />
  ) : null
}

export function ToastView({ message, variant, open = true }: ToastViewProps): React.JSX.Element {
  const destructive = variant === 'destructive'

  return (
    <div
      role={destructive ? 'alert' : 'status'}
      aria-live={destructive ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'pointer-events-none fixed right-5 bottom-5 z-50 flex max-w-[min(28rem,calc(100vw-2.5rem))] items-start gap-3 rounded-lg border border-border bg-popover text-popover-foreground px-3 py-2.5 chrome-overlay shadow-chrome-overlay',
        destructive ? 'border-l-2 border-l-destructive' : 'border-l-2 border-l-success'
      )}
    >
      {destructive ? (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <div className="font-sans text-xs font-semibold text-muted-foreground">
          {destructive ? 'Action failed' : 'Vault updated'}
        </div>
        <div className="mt-0.5 break-words text-[13px] leading-snug font-medium">{message}</div>
      </div>
    </div>
  )
}
