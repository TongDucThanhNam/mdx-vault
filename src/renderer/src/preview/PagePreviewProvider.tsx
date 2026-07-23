import { type ReactNode, useEffect, useMemo } from 'react'

import type { IndexedNoteSummary } from '@/vault/types'
import type { AppSettingsSnapshot } from '../../../shared/app-settings'
import type { WikilinkSubpath } from '../../../shared/wikilinks'
import { PagePreviewContext } from './page-preview-context'
import { useWikilinkPreview, type WikilinkPreviewIntent } from './useWikilinkPreview'
import { WikilinkPreviewLayer } from './WikilinkPreview'

const PAGE_PREVIEW_TARGET_SELECTOR = '[data-page-preview-path], [data-path], [data-item-path]'

export function PagePreviewProvider({
  children,
  notes,
  settings,
  onNavigate
}: {
  children: ReactNode
  notes: IndexedNoteSummary[]
  settings: AppSettingsSnapshot['pagePreview']
  onNavigate: (relativePath: string, subpath?: WikilinkSubpath | null) => void
}): React.JSX.Element {
  const controller = useWikilinkPreview(settings)
  const notesByPath = useMemo(
    () => new Map(notes.map((note) => [normalizePath(note.relativePath), note])),
    [notes]
  )

  useEffect(() => {
    const readIntent = (
      target: EventTarget | Event | null,
      trigger: WikilinkPreviewIntent['trigger'],
      modifierKey: boolean
    ): WikilinkPreviewIntent | null => {
      const element = findPreviewTarget(target)
      const path =
        element?.dataset.pagePreviewPath ?? element?.dataset.path ?? element?.dataset.itemPath
      if (element?.dataset.pagePreviewOwned === 'true') return null
      const note = path ? notesByPath.get(normalizePath(path)) : undefined
      if (!element || !note) return null
      return { note, subpath: null, anchor: element, trigger, modifierKey }
    }
    const onPointerOver = (event: PointerEvent): void => {
      const intent = readIntent(event, 'pointer', event.ctrlKey || event.metaKey)
      if (intent) controller.requestPreview(intent)
    }
    const onPointerOut = (event: PointerEvent): void => {
      const element = findPreviewTarget(event)
      if (!element || element === findPreviewTarget(event.relatedTarget)) return
      controller.scheduleDismiss(event.relatedTarget)
    }
    const onFocusIn = (event: FocusEvent): void => {
      const intent = readIntent(event, 'focus', false)
      if (intent) controller.requestPreview(intent)
    }
    const onFocusOut = (event: FocusEvent): void => {
      const element = findPreviewTarget(event)
      if (!element || element === findPreviewTarget(event.relatedTarget)) return
      controller.scheduleDismiss(event.relatedTarget)
    }

    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [controller.requestPreview, controller.scheduleDismiss, notesByPath])

  return (
    <PagePreviewContext.Provider value={controller}>
      {children}
      <WikilinkPreviewLayer
        preview={controller.activePreview}
        onNavigate={onNavigate}
        onRetain={controller.retainPreview}
        onDismiss={controller.dismissPreview}
        onScheduleDismiss={controller.scheduleDismiss}
      />
    </PagePreviewContext.Provider>
  )
}

function findPreviewTarget(target: EventTarget | Event | null): HTMLElement | null {
  const candidates = target instanceof Event ? target.composedPath() : [target]
  for (const candidate of candidates) {
    if (candidate instanceof Element) {
      const element = candidate.closest<HTMLElement>(PAGE_PREVIEW_TARGET_SELECTOR)
      if (element) return element
    }
  }
  return null
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').toLocaleLowerCase()
}
