import { useEffect, useState } from 'react'

/** Retain only closing chrome; opening and focus are always synchronous. */
export function useExitPresence<T>(value: T | null): T | null {
  const [retained, setRetained] = useState(value)
  useEffect(() => {
    if (value !== null) {
      setRetained(value)
      return
    }
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150
    const timer = window.setTimeout(() => setRetained(null), delay)
    return () => window.clearTimeout(timer)
  }, [value])
  return value ?? retained
}
