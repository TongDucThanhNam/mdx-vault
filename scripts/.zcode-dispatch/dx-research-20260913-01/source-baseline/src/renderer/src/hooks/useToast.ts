import { useCallback, useEffect, useState } from 'react'
import type { ToastVariant } from '@/components/ToastView'

export interface ToastState {
  message: string
  variant: ToastVariant
  key: number
}

export function useToast(): {
  toast: ToastState | null
  showToast: (message: string, variant?: ToastVariant) => void
} {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, variant: ToastVariant = 'default'): void => {
    setToast({ message, variant, key: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => {
      window.clearTimeout(timer)
    }
  }, [toast])

  return { toast, showToast }
}
