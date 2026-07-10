import type { ReactNode } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  secondaryLabel?: string
  cancelLabel?: string
  destructive?: boolean
  isPending?: boolean
  onConfirm: () => Promise<void> | void
  onSecondary?: () => Promise<void> | void
}

/**
 * Generic confirmation dialog for destructive or non-destructive actions.
 * Built on top of the radix AlertDialog primitive so Escape / outside-click
 * (when not modal-blocking) cancel cleanly. The action button shows a pending
 * state while {@link onConfirm} is in flight.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  secondaryLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  isPending = false,
  onConfirm,
  onSecondary
}: ConfirmDialogProps): React.JSX.Element {
  const handleAction = async (action: () => Promise<void> | void): Promise<void> => {
    try {
      await action()
    } finally {
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-[13px] leading-relaxed text-foreground/80">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          {secondaryLabel && onSecondary ? (
            <AlertDialogAction
              className={cn(buttonVariants({ variant: 'outline' }))}
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleAction(onSecondary)
              }}
            >
              {secondaryLabel}
            </AlertDialogAction>
          ) : null}
          <AlertDialogAction
            className={cn(buttonVariants({ variant: destructive ? 'destructive' : 'default' }))}
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              void handleAction(onConfirm)
            }}
          >
            {isPending ? 'Working…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
