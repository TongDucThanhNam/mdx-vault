import { useCallback, useRef, useState } from 'react'
import { focusActiveDocument, focusElementOrDocument } from '@/workbench/document-focus'

export type GlobalSurfaceId =
  | 'file-finder'
  | 'command-palette'
  | 'project-search'
  | 'create-note'
  | 'export'
  | 'settings'

export interface GlobalSurfaceController {
  activeSurface: GlobalSurfaceId | null
  openSurface: (surface: GlobalSurfaceId) => void
  cancelSurface: (surface: GlobalSurfaceId) => void
  completeSurface: (surface: GlobalSurfaceId) => void
  setSurfaceOpen: (surface: GlobalSurfaceId, open: boolean) => void
  isSurfaceOpen: (surface: GlobalSurfaceId) => boolean
}

export function useGlobalSurface(): GlobalSurfaceController {
  const [activeSurface, setActiveSurface] = useState<GlobalSurfaceId | null>(null)
  const activeSurfaceRef = useRef<GlobalSurfaceId | null>(null)
  const invokingElementRef = useRef<HTMLElement | null>(null)
  const focusTimerRef = useRef<number | null>(null)

  const openSurface = useCallback((surface: GlobalSurfaceId): void => {
    if (activeSurfaceRef.current === surface) {
      return
    }

    if (activeSurfaceRef.current === null) {
      invokingElementRef.current = getFocusedElement()
    }

    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current)
      focusTimerRef.current = null
    }

    activeSurfaceRef.current = surface
    setActiveSurface(surface)
  }, [])

  const closeSurface = useCallback(
    (surface: GlobalSurfaceId, focusTarget: 'invoker' | 'document'): void => {
      if (activeSurfaceRef.current !== surface) {
        return
      }

      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current)
      }

      const invokingElement = invokingElementRef.current
      activeSurfaceRef.current = null
      invokingElementRef.current = null
      setActiveSurface(null)

      focusTimerRef.current = window.setTimeout(() => {
        focusTimerRef.current = null
        if (activeSurfaceRef.current !== null) {
          return
        }
        if (focusTarget === 'invoker') {
          focusElementOrDocument(invokingElement)
        } else {
          focusActiveDocument()
        }
      }, 0)
    },
    []
  )

  const cancelSurface = useCallback(
    (surface: GlobalSurfaceId): void => {
      closeSurface(surface, 'invoker')
    },
    [closeSurface]
  )

  const completeSurface = useCallback(
    (surface: GlobalSurfaceId): void => {
      closeSurface(surface, 'document')
    },
    [closeSurface]
  )

  const setSurfaceOpen = useCallback(
    (surface: GlobalSurfaceId, open: boolean): void => {
      if (open) {
        openSurface(surface)
        return
      }

      if (activeSurfaceRef.current === surface) {
        cancelSurface(surface)
      }
    },
    [cancelSurface, openSurface]
  )

  const isSurfaceOpen = useCallback(
    (surface: GlobalSurfaceId): boolean => activeSurface === surface,
    [activeSurface]
  )

  return {
    activeSurface,
    openSurface,
    cancelSurface,
    completeSurface,
    setSurfaceOpen,
    isSurfaceOpen
  }
}

function getFocusedElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null
}
