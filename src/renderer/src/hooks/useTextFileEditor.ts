import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatError } from '@/lib/format-error'
import { applySynchronousEditorValue } from '@/workbench/editor-adapter'

interface UseTextFileEditorOptions {
  onError: (message: string | null) => void
}

export type TextFileLoadResult = 'loaded' | 'load-failed' | 'save-failed' | 'superseded'

export function useTextFileEditor({ onError }: UseTextFileEditorOptions) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContentState] = useState('')
  const [savedContent, setSavedContentState] = useState('')
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCurrentFileMissing, setIsCurrentFileMissing] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const selectedPathRef = useRef(selectedPath)
  const contentRef = useRef(content)
  const savedContentRef = useRef(savedContent)
  const saveRequestRef = useRef(0)
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true))
  const loadRequestRef = useRef(0)
  const isCurrentFileMissingRef = useRef(false)

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

  const updateContent = useCallback<Dispatch<SetStateAction<string>>>((nextValue) => {
    applySynchronousEditorValue(contentRef, setContentState, nextValue)
  }, [])

  const saveCurrentFile = useCallback((): Promise<boolean> => {
    const operation = saveQueueRef.current.then(async () => {
      const path = selectedPathRef.current
      const value = contentRef.current

      if (!path || value === savedContentRef.current) {
        return true
      }

      if (isCurrentFileMissingRef.current) {
        onError(`Cannot save ${path}: the file was deleted outside mdx-vault`)
        return false
      }

      const requestId = saveRequestRef.current + 1
      saveRequestRef.current = requestId
      setIsSaving(true)
      onError(null)

      try {
        await window.vaultApi.writeTextFile(path, value)

        if (selectedPathRef.current === path) {
          savedContentRef.current = value
          setSavedContentState(value)
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
    async (
      relativePath: string,
      saveBeforeLoad = true,
      shouldCommit: () => boolean = () => true
    ): Promise<TextFileLoadResult> => {
      const requestId = loadRequestRef.current + 1
      loadRequestRef.current = requestId
      setIsLoadingFile(true)
      onError(null)

      if (saveBeforeLoad) {
        const saved = await saveCurrentFile()

        if (requestId !== loadRequestRef.current || !shouldCommit()) {
          return 'superseded'
        }

        if (!saved) {
          setIsLoadingFile(false)
          return 'save-failed'
        }
      }

      try {
        if (!shouldCommit()) {
          return 'superseded'
        }

        const fileContent = await window.vaultApi.readTextFile(relativePath)

        if (requestId !== loadRequestRef.current || !shouldCommit()) {
          return 'superseded'
        }

        selectedPathRef.current = relativePath
        contentRef.current = fileContent
        savedContentRef.current = fileContent
        isCurrentFileMissingRef.current = false
        setSelectedPath(relativePath)
        setContentState(fileContent)
        setSavedContentState(fileContent)
        setIsCurrentFileMissing(false)
        setLastSavedAt(null)
        return 'loaded'
      } catch (loadError) {
        if (requestId !== loadRequestRef.current) {
          return 'superseded'
        }

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
    if (!selectedPath || content === savedContent || isCurrentFileMissing) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveCurrentFile()
    }, 1000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [content, isCurrentFileMissing, savedContent, saveCurrentFile, selectedPath])

  const cancelPendingLoad = useCallback((): void => {
    loadRequestRef.current += 1
    setIsLoadingFile(false)
  }, [])

  const resetEditor = useCallback((): void => {
    loadRequestRef.current += 1
    selectedPathRef.current = null
    contentRef.current = ''
    savedContentRef.current = ''
    isCurrentFileMissingRef.current = false
    setSelectedPath(null)
    setContentState('')
    setSavedContentState('')
    setLastSavedAt(null)
    setIsCurrentFileMissing(false)
    setIsLoadingFile(false)
  }, [])

  const markCurrentFileMissing = useCallback((relativePath: string, missing: boolean): void => {
    if (selectedPathRef.current !== relativePath) {
      return
    }

    isCurrentFileMissingRef.current = missing
    setIsCurrentFileMissing(missing)
  }, [])

  const restoreFileBuffer = useCallback(
    (relativePath: string, value: string, persistedValue: string, missing: boolean): void => {
      loadRequestRef.current += 1
      selectedPathRef.current = relativePath
      contentRef.current = value
      savedContentRef.current = persistedValue
      isCurrentFileMissingRef.current = missing
      setSelectedPath(relativePath)
      setContentState(value)
      setSavedContentState(persistedValue)
      setIsCurrentFileMissing(missing)
      setLastSavedAt(null)
      setIsLoadingFile(false)
    },
    []
  )

  return {
    selectedPath,
    content,
    savedContent,
    isDirty,
    isLoadingFile,
    isSaving,
    isCurrentFileMissing,
    lastSavedAt,
    selectedPathRef,
    contentRef,
    savedContentRef,
    setContent: updateContent,
    saveCurrentFile,
    loadFile,
    cancelPendingLoad,
    resetEditor,
    markCurrentFileMissing,
    restoreFileBuffer
  }
}

export type TextFileEditorController = ReturnType<typeof useTextFileEditor>
