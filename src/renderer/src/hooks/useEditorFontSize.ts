import { useCallback, useEffect, useRef, useState } from 'react'
import { formatError } from '@/lib/format-error'

export const MIN_EDITOR_FONT_SIZE = 12
export const MAX_EDITOR_FONT_SIZE = 20
export const DEFAULT_EDITOR_FONT_SIZE = 13.5

const EDITOR_FONT_STYLE_ID = 'mdx-vault-editor-font-size'

interface UseEditorFontSizeOptions {
  onError: (message: string | null) => void
}

interface UseEditorFontSizeResult {
  editorFontSize: number
  setEditorFontSize: (fontSize: number) => Promise<void>
}

export function useEditorFontSize({ onError }: UseEditorFontSizeOptions): UseEditorFontSizeResult {
  const [editorFontSize, setEditorFontSizeState] = useState(DEFAULT_EDITOR_FONT_SIZE)
  const latestFontSizeRef = useRef(DEFAULT_EDITOR_FONT_SIZE)
  const persistQueueRef = useRef(Promise.resolve())

  useEffect(() => {
    let cancelled = false

    if (!window.appApi) {
      return
    }

    void window.appApi
      .getEditorFontSize()
      .then((persisted) => {
        if (!cancelled) {
          const normalized = normalizeEditorFontSize(persisted)
          latestFontSizeRef.current = normalized
          setEditorFontSizeState(normalized)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          onError(formatError(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [onError])

  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${editorFontSize}px`)
  }, [editorFontSize])

  useEffect(() => {
    const existingStyle = document.getElementById(EDITOR_FONT_STYLE_ID)
    if (existingStyle) {
      return
    }

    const style = document.createElement('style')
    style.id = EDITOR_FONT_STYLE_ID
    style.textContent =
      '.cm-editor .cm-scroller { font-size: var(--editor-font-size, 13.5px) !important; }'
    document.head.append(style)

    return () => {
      style.remove()
    }
  }, [])

  const setEditorFontSize = useCallback(
    async (fontSize: number): Promise<void> => {
      const normalized = normalizeEditorFontSize(fontSize)
      latestFontSizeRef.current = normalized
      setEditorFontSizeState(normalized)

      if (!window.appApi) {
        return
      }

      const persist = persistQueueRef.current.then(async () => {
        const persisted = normalizeEditorFontSize(await window.appApi.setEditorFontSize(normalized))
        if (latestFontSizeRef.current === normalized) {
          latestFontSizeRef.current = persisted
          setEditorFontSizeState(persisted)
        }
      })

      persistQueueRef.current = persist.catch((error) => {
        onError(formatError(error))
      })

      await persistQueueRef.current
    },
    [onError]
  )

  return { editorFontSize, setEditorFontSize }
}

function normalizeEditorFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_EDITOR_FONT_SIZE
  }

  return Math.min(MAX_EDITOR_FONT_SIZE, Math.max(MIN_EDITOR_FONT_SIZE, value))
}
