import { useEffect } from 'react'
import { InputIdleGate } from '@/lib/input-idle-gate'
import { loadGraphSurface } from './load-graph-surface'

/** Warm the graph surface only after Welcome paints and input has gone quiet. */
export function useGraphPreload(): void {
  useEffect(() => {
    let disposed = false
    let frame = 0
    const gate = new InputIdleGate(
      {
        now: () => performance.now(),
        setTimeout: (callback, delay) => window.setTimeout(callback, delay),
        clearTimeout: (id) => window.clearTimeout(id),
        requestIdle: (callback) => window.requestIdleCallback(callback),
        cancelIdle: (id) => window.cancelIdleCallback(id)
      },
      () => {
        performance.mark('g39:feature-preload-start')
        void loadGraphSurface()
          .then(() => {
            if (disposed) return
            performance.mark('g39:graph-module-ready')
          })
          .catch(() => undefined)
      }
    )
    const onInput = (): void => gate.onInput()
    document.addEventListener('pointerdown', onInput, true)
    document.addEventListener('keydown', onInput, true)
    const kick = (): void => {
      if (!document.querySelector('[data-preview-layout-ready="true"]')) return
      observer.disconnect()
      frame = window.requestAnimationFrame(() => gate.setReady())
    }
    const observer = new MutationObserver(kick)
    observer.observe(document.body, { subtree: true, attributes: true, childList: true })
    kick()
    return () => {
      disposed = true
      document.removeEventListener('pointerdown', onInput, true)
      document.removeEventListener('keydown', onInput, true)
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      gate.dispose()
    }
  }, [])
}
