import { useCallback, useEffect, useRef, useState } from 'react'

import type { IndexedNoteSummary } from '@/vault/types'
import type { WikilinkSubpath } from '../../../shared/wikilinks'
import type { AnchorRect } from './wikilink-preview-position'

const HOVER_OPEN_DELAY_MS = 350
const FOCUS_OPEN_DELAY_MS = 80
const CLOSE_DELAY_MS = 160

export interface WikilinkPreviewIntent {
  note: IndexedNoteSummary
  subpath: WikilinkSubpath | null
  anchor: HTMLElement
  trigger: 'pointer' | 'focus'
  modifierKey?: boolean
}

export interface ActiveWikilinkPreview {
  note: IndexedNoteSummary
  subpath: WikilinkSubpath | null
  anchorRect: AnchorRect
}

interface WikilinkPreviewController {
  activePreview: ActiveWikilinkPreview | null
  requestPreview: (intent: WikilinkPreviewIntent) => void
  scheduleDismiss: (relatedTarget?: EventTarget | null) => void
  retainPreview: () => void
  dismissPreview: () => void
}

export function shouldOpenPagePreview(
  settings: { enabled: boolean; requireModifier: boolean },
  modifierKey: boolean | undefined,
  trigger: WikilinkPreviewIntent['trigger'] = 'pointer'
): boolean {
  if (!settings.enabled) return false
  return trigger === 'focus' || !settings.requireModifier || modifierKey === true
}

export function useWikilinkPreview(
  settings: { enabled: boolean; requireModifier: boolean } = {
    enabled: true,
    requireModifier: false
  }
): WikilinkPreviewController {
  const previewEnabled = settings.enabled
  const previewRequiresModifier = settings.requireModifier
  const [activePreview, setActivePreview] = useState<ActiveWikilinkPreview | null>(null)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }, [])

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const dismissPreview = useCallback(() => {
    clearOpenTimer()
    clearCloseTimer()
    setActivePreview(null)
  }, [clearCloseTimer, clearOpenTimer])

  const retainPreview = useCallback(() => {
    clearCloseTimer()
  }, [clearCloseTimer])

  const requestPreview = useCallback(
    ({ note, subpath, anchor, trigger, modifierKey }: WikilinkPreviewIntent) => {
      clearOpenTimer()
      clearCloseTimer()
      if (
        !shouldOpenPagePreview(
          { enabled: previewEnabled, requireModifier: previewRequiresModifier },
          modifierKey,
          trigger
        )
      ) {
        return
      }

      const anchorRect = snapshotAnchorRect(anchor.getBoundingClientRect())
      const delay = trigger === 'pointer' ? HOVER_OPEN_DELAY_MS : FOCUS_OPEN_DELAY_MS
      openTimerRef.current = window.setTimeout(() => {
        setActivePreview({ note, subpath, anchorRect })
        openTimerRef.current = null
      }, delay)
    },
    [clearCloseTimer, clearOpenTimer, previewEnabled, previewRequiresModifier]
  )

  const scheduleDismiss = useCallback(
    (relatedTarget?: EventTarget | null) => {
      if (
        relatedTarget instanceof Element &&
        relatedTarget.closest('[data-wikilink-preview-layer="true"]')
      ) {
        clearCloseTimer()
        return
      }

      clearOpenTimer()
      clearCloseTimer()
      closeTimerRef.current = window.setTimeout(() => {
        setActivePreview(null)
        closeTimerRef.current = null
      }, CLOSE_DELAY_MS)
    },
    [clearCloseTimer, clearOpenTimer]
  )

  useEffect(
    () => () => {
      clearOpenTimer()
      clearCloseTimer()
    },
    [clearCloseTimer, clearOpenTimer]
  )

  useEffect(() => {
    if (!previewEnabled) dismissPreview()
  }, [dismissPreview, previewEnabled])

  useEffect(() => {
    if (!activePreview) {
      return
    }

    const dismissOnViewportResize = (): void => dismissPreview()
    const dismissOnExternalScroll = (event: Event): void => {
      if (!isWikilinkPreviewInternalScroll(event.target)) {
        dismissPreview()
      }
    }
    window.addEventListener('resize', dismissOnViewportResize)
    window.addEventListener('scroll', dismissOnExternalScroll, true)

    return () => {
      window.removeEventListener('resize', dismissOnViewportResize)
      window.removeEventListener('scroll', dismissOnExternalScroll, true)
    }
  }, [activePreview, dismissPreview])

  return {
    activePreview,
    requestPreview,
    scheduleDismiss,
    retainPreview,
    dismissPreview
  }
}

export function isWikilinkPreviewInternalScroll(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest('[data-wikilink-preview-layer="true"]') !== null
  )
}

function snapshotAnchorRect(rect: DOMRect): AnchorRect {
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height
  }
}
