import { useCallback, useEffect, useRef, useState } from 'react'
import { formatError } from '@/lib/format-error'

interface UseTextFileEditorOptions {
  onError: (message: string | null) => void
}

export type TextFileLoadResult = 'loaded' | 'load-failed' | 'save-failed' | 'superseded'

export function useTextFileEditor({ onError }: UseTextFileEditorOptions) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const selectedPathRef = useRef(selectedPath)
  const contentRef = useRef(content)
  const savedContentRef = useRef(savedContent)
  const saveRequestRef = useRef(0)
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const loadRequestRef = useRef(0)

  const isDirty = selectedPath !== null && content !== savedContent

  useEffect(() => {
    selectedPathRef.current = selectedPath
  }, [selectedPath])

  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    savedContentRef.current = savedContent
  }, [savedContent])

  const saveCurrentFile = useCallback((): Promise<boolean> => {
    const operation = saveQueueRef.current.then(async () => {
      const path = selectedPathRef.current
      const value = contentRef.current

      if (!path || value === savedContentRef.current) {
        return true
      }

      const requestId = saveRequestRef.current + 1
      saveRequestRef.current = requestId
      setIsSaving(true)
      onError(null)

      try {
        await window.vaultApi.writeTextFile(path, value)

        if (selectedPathRef.current === path) {
          savedContentRef.current = value
          setSavedContent(value)
          setLastSavedAt(new Date())
        }

        return true
      } catch (saveError) {
        onError(formatError(saveError))
        return false
      } finally {
        if (saveRequestRef.current === requestId) {
          setIsSaving(false)
        }
      }
    })

    saveQueueRef.current = operation
    return operation
  }, [onError])

  const loadFile = useCallback(
    async (relativePath: string, saveBeforeLoad = true): Promise<TextFileLoadResult> => {
      const requestId = loadRequestRef.current + 1
      loadRequestRef.current = requestId
      setIsLoadingFile(true)
      onError(null)

      if (saveBeforeLoad) {
        const saved = await saveCurrentFile()

        if (requestId !== loadRequestRef.current) {
          return 'superseded'
        }

        if (!saved) {
          setIsLoadingFile(false)
          return 'save-failed'
        }
      }

      try {
        const fileContent = await window.vaultApi.readTextFile(relativePath)

        if (requestId !== loadRequestRef.current) {
          return 'superseded'
        }

        selectedPathRef.current = relativePath
        contentRef.current = fileContent
        savedContentRef.current = fileContent
        setSelectedPath(relativePath)
        setContent(fileContent)
        setSavedContent(fileContent)
        setLastSavedAt(null)
        return 'loaded'
      } catch (loadError) {
        if (requestId !== loadRequestRef.current) {
          return 'superseded'
        }

        selectedPathRef.current = null
        contentRef.current = ''
        savedContentRef.current = ''
        setSelectedPath(null)
        setContent('')
        setSavedContent('')
        setLastSavedAt(null)
        onError(formatError(loadError))
        return 'load-failed'
      } finally {
        if (requestId === loadRequestRef.current) {
          setIsLoadingFile(false)
        }
      }
    },
    [onError, saveCurrentFile]
  )

  useEffect(() => {
    if (!selectedPath || content === savedContent) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveCurrentFile()
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [content, savedContent, saveCurrentFile, selectedPath])

  const cancelPendingLoad = useCallback((): void => {
    loadRequestRef.current += 1
    setIsLoadingFile(false)
  }, [])

  const resetEditor = useCallback((): void => {
    loadRequestRef.current += 1
    selectedPathRef.current = null
    contentRef.current = ''
    savedContentRef.current = ''
    setSelectedPath(null)
    setContent('')
    setSavedContent('')
    setLastSavedAt(null)
    setIsLoadingFile(false)
  }, [])

  return {
    selectedPath,
    content,
    isDirty,
    isLoadingFile,
    isSaving,
    lastSavedAt,
    selectedPathRef,
    setContent,
    saveCurrentFile,
    loadFile,
    cancelPendingLoad,
    resetEditor
  }
}

export type TextFileEditorController = ReturnType<typeof useTextFileEditor>
