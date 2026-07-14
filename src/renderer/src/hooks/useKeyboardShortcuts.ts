import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useEffect } from 'react'
import type { ViewMode } from '@/components/ViewModeToggle'

interface UseKeyboardShortcutsOptions {
  selectedPathRef: MutableRefObject<string | null>
  saveCurrentFile: () => Promise<boolean>
  setViewMode: Dispatch<SetStateAction<ViewMode>>
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>
  setQuickSwitcherOpen: Dispatch<SetStateAction<boolean>>
  setCreateNoteOpen: Dispatch<SetStateAction<boolean>>
  setSearchOpen: Dispatch<SetStateAction<boolean>>
  setAiPanelOpen: Dispatch<SetStateAction<boolean>>
  setExportDialogOpen: Dispatch<SetStateAction<boolean>>
}

interface UseReadingZoomShortcutsOptions {
  enabled: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
}

export function useKeyboardShortcuts({
  selectedPathRef,
  saveCurrentFile,
  setViewMode,
  setCommandPaletteOpen,
  setQuickSwitcherOpen,
  setCreateNoteOpen,
  setSearchOpen,
  setAiPanelOpen,
  setExportDialogOpen
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase()

      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault()
        if (selectedPathRef.current) {
          void saveCurrentFile()
        }
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'p') {
        event.preventDefault()
        setCommandPaletteOpen(true)
        return
      }

      if ((event.ctrlKey || event.metaKey) && key === 'p') {
        event.preventDefault()
        setQuickSwitcherOpen(true)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'v') {
        event.preventDefault()
        if (selectedPathRef.current) {
          setViewMode((current) =>
            current === 'source' ? 'live' : current === 'live' ? 'reading' : 'source'
          )
        }
      }

      if ((event.ctrlKey || event.metaKey) && key === 'n') {
        event.preventDefault()
        setCreateNoteOpen(true)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'f') {
        event.preventDefault()
        setSearchOpen(true)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'a') {
        event.preventDefault()
        setAiPanelOpen((current) => !current)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'e') {
        event.preventDefault()
        if (selectedPathRef.current) {
          setExportDialogOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    saveCurrentFile,
    selectedPathRef,
    setAiPanelOpen,
    setCommandPaletteOpen,
    setCreateNoteOpen,
    setExportDialogOpen,
    setQuickSwitcherOpen,
    setSearchOpen,
    setViewMode
  ])
}

export function useReadingZoomShortcuts({
  enabled,
  onZoomIn,
  onZoomOut,
  onResetZoom
}: UseReadingZoomShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey && !event.metaKey) {
        return
      }

      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        onZoomIn()
        return
      }

      if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        onZoomOut()
        return
      }

      if (event.key === '0') {
        event.preventDefault()
        onResetZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, onResetZoom, onZoomIn, onZoomOut])
}
