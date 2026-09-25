import { CircleCheck, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastVariant = 'default' | 'destructive'

interface ToastViewProps {
  message: string
  variant: ToastVariant
}

export function ToastView({ message, variant }: ToastViewProps): React.JSX.Element {
  const destructive = variant === 'destructive'

  return (
    <div
      role={destructive ? 'alert' : 'status'}
      aria-live={destructive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'pointer-events-none fixed right-5 bottom-5 z-50 flex max-w-[min(28rem,calc(100vw-2.5rem))] items-start gap-3 border-2 border-foreground px-3 py-2.5 shadow-[4px_4px_0_0_var(--foreground)]',
        destructive
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-success text-success-foreground'
      )}
    >
      {destructive ? (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] opacity-75">
          {destructive ? 'Action failed' : 'Vault updated'}
        </div>
        <div className="mt-0.5 break-words text-[13px] leading-snug font-medium">{message}</div>
      </div>
    </div>
  )
}
