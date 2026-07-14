import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  accumulateReadingZoom,
  calculateReadingZoomAnchoredScroll,
  clampReadingZoom,
  DEFAULT_READING_ZOOM,
  stepReadingZoom
} from '@/preview/reading-zoom'

const READING_ZOOM_STORAGE_KEY = 'mdx-vault.reading-zoom.v1'
const READING_ZOOM_GESTURE_IDLE_MS = 160
const FACTOR_EPSILON = 0.000_001

export interface ReadingZoomWheelInput {
  pixelDeltaY: number
  clientX: number
  clientY: number
  scrollRoot: HTMLDivElement
  liveLayer: HTMLDivElement
}

interface ReadingZoomGesture {
  scrollRoot: HTMLDivElement
  liveLayer: HTMLDivElement
  committedFactor: number
  pendingFactor: number
  rootLeft: number
  rootTop: number
  rootWidth: number
  rootHeight: number
  layerLeft: number
  layerTop: number
  layerWidth: number
  layerHeight: number
  anchorX: number
  anchorY: number
  originX: number
  originY: number
}

interface PendingReadingZoomCommit {
  factor: number
  scrollRoot: HTMLDivElement
  liveLayer: HTMLDivElement
  scrollLeft: number
  scrollTop: number
}

export function useReadingZoom() {
  const [factor, setFactor] = useState(readPersistedReadingZoom)
  const committedFactorRef = useRef(factor)
  const gestureRef = useRef<ReadingZoomGesture | null>(null)
  const pendingCommitRef = useRef<PendingReadingZoomCommit | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const idleTimerRef = useRef<number | null>(null)

  const clearScheduledGestureWork = useCallback((): void => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const cancelGesture = useCallback((): void => {
    clearScheduledGestureWork()

    const gesture = gestureRef.current
    if (gesture) {
      gesture.liveLayer.style.cssText = ''
      gestureRef.current = null
    }

    const pendingCommit = pendingCommitRef.current
    if (pendingCommit) {
      pendingCommit.liveLayer.style.cssText = ''
      pendingCommitRef.current = null
    }
  }, [clearScheduledGestureWork])

  const commitGesture = useCallback((): void => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    idleTimerRef.current = null
    const gesture = gestureRef.current
    gestureRef.current = null

    if (!gesture) {
      return
    }

    if (Math.abs(gesture.pendingFactor - gesture.committedFactor) < FACTOR_EPSILON) {
      gesture.liveLayer.style.cssText = ''
      return
    }

    const anchoredScroll = calculateReadingZoomAnchoredScroll({
      scrollLeft: gesture.scrollRoot.scrollLeft,
      scrollTop: gesture.scrollRoot.scrollTop,
      anchorX: gesture.anchorX,
      anchorY: gesture.anchorY,
      committedFactor: gesture.committedFactor,
      pendingFactor: gesture.pendingFactor
    })

    pendingCommitRef.current = {
      factor: gesture.pendingFactor,
      scrollRoot: gesture.scrollRoot,
      liveLayer: gesture.liveLayer,
      scrollLeft: anchoredScroll.left,
      scrollTop: anchoredScroll.top
    }
    setFactor(gesture.pendingFactor)
  }, [])

  useLayoutEffect(() => {
    committedFactorRef.current = factor
    const pendingCommit = pendingCommitRef.current

    if (!pendingCommit || Math.abs(pendingCommit.factor - factor) >= FACTOR_EPSILON) {
      return
    }

    pendingCommit.liveLayer.style.cssText = ''

    if (pendingCommit.scrollRoot.isConnected) {
      const maxScrollLeft = Math.max(
        0,
        pendingCommit.scrollRoot.scrollWidth - pendingCommit.scrollRoot.clientWidth
      )
      const maxScrollTop = Math.max(
        0,
        pendingCommit.scrollRoot.scrollHeight - pendingCommit.scrollRoot.clientHeight
      )

      pendingCommit.scrollRoot.scrollLeft = Math.min(pendingCommit.scrollLeft, maxScrollLeft)
      pendingCommit.scrollRoot.scrollTop = Math.min(pendingCommit.scrollTop, maxScrollTop)
    }

    pendingCommitRef.current = null
  }, [factor])

  useEffect(() => {
    try {
      window.localStorage.setItem(READING_ZOOM_STORAGE_KEY, String(factor))
    } catch {
      // Persistence is best-effort; zoom remains available for this session.
    }
  }, [factor])

  useEffect(() => cancelGesture, [cancelGesture])

  const adjustFromWheel = useCallback(
    ({ pixelDeltaY, clientX, clientY, scrollRoot, liveLayer }: ReadingZoomWheelInput): void => {
      let gesture = gestureRef.current

      if (!gesture || gesture.scrollRoot !== scrollRoot || gesture.liveLayer !== liveLayer) {
        cancelGesture()

        const rootRect = scrollRoot.getBoundingClientRect()
        const layerRect = liveLayer.getBoundingClientRect()
        const committedFactor = committedFactorRef.current

        gesture = {
          scrollRoot,
          liveLayer,
          committedFactor,
          pendingFactor: committedFactor,
          rootLeft: rootRect.left,
          rootTop: rootRect.top,
          rootWidth: rootRect.width,
          rootHeight: rootRect.height,
          layerLeft: layerRect.left,
          layerTop: layerRect.top,
          layerWidth: layerRect.width / committedFactor,
          layerHeight: layerRect.height / committedFactor,
          anchorX: 0,
          anchorY: 0,
          originX: 0,
          originY: 0
        }
        gestureRef.current = gesture
      }

      gesture.pendingFactor = accumulateReadingZoom(gesture.pendingFactor, pixelDeltaY)
      gesture.anchorX = clamp(clientX - gesture.rootLeft, 0, gesture.rootWidth)
      gesture.anchorY = clamp(clientY - gesture.rootTop, 0, gesture.rootHeight)
      gesture.originX = clamp(
        (clientX - gesture.layerLeft) / gesture.committedFactor,
        0,
        gesture.layerWidth
      )
      gesture.originY = clamp(
        (clientY - gesture.layerTop) / gesture.committedFactor,
        0,
        gesture.layerHeight
      )

      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = null
          const activeGesture = gestureRef.current

          if (!activeGesture) {
            return
          }

          const liveScale = activeGesture.pendingFactor / activeGesture.committedFactor
          activeGesture.liveLayer.style.cssText =
            `will-change:transform;transform-origin:${activeGesture.originX}px ` +
            `${activeGesture.originY}px;transform:scale(${liveScale})`
        })
      }

      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
      }
      idleTimerRef.current = window.setTimeout(commitGesture, READING_ZOOM_GESTURE_IDLE_MS)
    },
    [cancelGesture, commitGesture]
  )

  const zoomIn = useCallback((): void => {
    cancelGesture()
    setFactor((currentFactor) => stepReadingZoom(currentFactor, 1))
  }, [cancelGesture])

  const zoomOut = useCallback((): void => {
    cancelGesture()
    setFactor((currentFactor) => stepReadingZoom(currentFactor, -1))
  }, [cancelGesture])

  const reset = useCallback((): void => {
    cancelGesture()
    setFactor(DEFAULT_READING_ZOOM)
  }, [cancelGesture])

  return {
    factor,
    adjustFromWheel,
    zoomIn,
    zoomOut,
    reset
  }
}

export type ReadingZoomController = ReturnType<typeof useReadingZoom>

function readPersistedReadingZoom(): number {
  try {
    const storedValue = window.localStorage.getItem(READING_ZOOM_STORAGE_KEY)
    if (storedValue === null) {
      return DEFAULT_READING_ZOOM
    }

    return clampReadingZoom(Number(storedValue))
  } catch {
    return DEFAULT_READING_ZOOM
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
