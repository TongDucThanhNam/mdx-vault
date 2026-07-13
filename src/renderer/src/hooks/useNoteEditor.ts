import { useCallback, useEffect, useRef, useState } from 'react'
import { fileToBase64 } from '@/lib/file-encoding'
import { formatError } from '@/lib/format-error'

interface UseNoteEditorOptions {
  onError: (message: string | null) => void
  onRecentNote: (relativePath: string) => void
  showToast: (message: string) => void
}

export function useNoteEditor({ onError, onRecentNote, showToast }: UseNoteEditorOptions) {
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
        await window.vaultApi.writeFile(path, value)

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
    async (relativePath: string, saveBeforeLoad = true): Promise<void> => {
      if (saveBeforeLoad) {
        await saveCurrentFile()
      }

      setIsLoadingFile(true)
      onError(null)

      try {
        const fileContent = await window.vaultApi.readFile(relativePath)
        selectedPathRef.current = relativePath
        contentRef.current = fileContent
        savedContentRef.current = fileContent
        setSelectedPath(relativePath)
        setContent(fileContent)
        setSavedContent(fileContent)
        setLastSavedAt(null)
        onRecentNote(relativePath)
      } catch (loadError) {
        onError(formatError(loadError))
      } finally {
        setIsLoadingFile(false)
      }
    },
    [onError, onRecentNote, saveCurrentFile]
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

  const resetEditor = useCallback((): void => {
    setSelectedPath(null)
    setContent('')
    setSavedContent('')
    selectedPathRef.current = null
    contentRef.current = ''
    savedContentRef.current = ''
  }, [])

  const clearSelectedFile = useCallback((relativePath: string): void => {
    if (selectedPathRef.current === relativePath) {
      selectedPathRef.current = null
      setSelectedPath(null)
      setContent('')
      setSavedContent('')
    }
  }, [])

  const writeFileFromAssistant = useCallback(
    async (relativePath: string, value: string): Promise<void> => {
      await saveCurrentFile()
      await window.vaultApi.writeFile(relativePath, value)
      if (relativePath === selectedPathRef.current) {
        savedContentRef.current = value
        setSavedContent(value)
        setLastSavedAt(new Date())
        setContent(value)
        contentRef.current = value
      }
    },
    [saveCurrentFile]
  )

  const handleSaveImage = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const base64 = await fileToBase64(file)
        const relativePath = await window.vaultApi.saveAsset(file.name, base64)
        showToast(`Saved image to ${relativePath}`)
        return relativePath
      } catch (saveImageError) {
        onError(formatError(saveImageError))
        return null
      }
    },
    [onError, showToast]
  )

  return {
    selectedPath,
    content,
    savedContent,
    isDirty,
    isLoadingFile,
    isSaving,
    lastSavedAt,
    selectedPathRef,
    contentRef,
    savedContentRef,
    setContent,
    setSavedContent,
    setLastSavedAt,
    saveCurrentFile,
    loadFile,
    resetEditor,
    clearSelectedFile,
    writeFileFromAssistant,
    handleSaveImage
  }
}

export type NoteEditorController = ReturnType<typeof useNoteEditor>
