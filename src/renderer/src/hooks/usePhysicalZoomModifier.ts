import { useCallback, useEffect, useRef } from 'react'
import { PhysicalZoomModifierTracker } from '@/input/physical-modifier'

export function usePhysicalZoomModifier() {
  const isDarwin = window.windowApi.platform === 'darwin'
  const trackerRef = useRef<PhysicalZoomModifierTracker | null>(null)

  if (trackerRef.current === null) {
    trackerRef.current = new PhysicalZoomModifierTracker(isDarwin)
  }

  useEffect(() => {
    const tracker = trackerRef.current
    if (!tracker) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => tracker.keyDown(event.key)
    const handleKeyUp = (event: KeyboardEvent): void => tracker.keyUp(event.key)
    const reset = (): void => tracker.reset()

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', reset)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', reset)
      tracker.reset()
    }
  }, [])

  const isPhysicalModifierDown = useCallback(
    (): boolean => trackerRef.current?.isDown() ?? false,
    []
  )

  return {
    isDarwin,
    isPhysicalModifierDown
  }
}
