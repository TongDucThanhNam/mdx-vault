import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileTreeSortMode } from '@/explorer/FileTree'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import type { TextFileEditorController } from '@/hooks/useTextFileEditor'
import { formatError } from '@/lib/format-error'
import { deriveNoteTitle } from '@/lib/note-title'
import { isEditableTextPath, isNotePath } from '@/vault/file-kind'
import type { VaultInfo } from '@/vault/types'
import type { RenamePlanPreview } from '../../../shared/rename'

export interface RenameRequest {
  fromRelativePath: string
  toRelativePath: string
  plan: RenamePlanPreview
}

interface UseVaultSessionOptions {
  vault: VaultInfo | null
  selectedVaultPath: string | null
  setVault: Dispatch<SetStateAction<VaultInfo | null>>
  setSelectedVaultPath: Dispatch<SetStateAction<string | null>>
  editor: NoteEditorController
  textEditor: TextFileEditorController
  noteIndex: NoteIndexController
  onError: (message: string | null) => void
  showToast: (message: string) => void
}

export function useVaultSession({
  vault,
  selectedVaultPath,
  setVault,
  setSelectedVaultPath,
  editor,
  textEditor,
  noteIndex,
  onError,
  showToast
}: UseVaultSessionOptions) {
  const [isOpening, setIsOpening] = useState(false)
  const [sortMode, setSortMode] = useState<FileTreeSortMode>('name')
  const [vaultOpsPending, setVaultOpsPending] = useState(false)
  const [trashCount, setTrashCount] = useState(0)
  const [renameRequest, setRenameRequest] = useState<RenameRequest | null>(null)
  const prevVaultRef = useRef(vault)
  const selectionRequestRef = useRef(0)
  const selectedVaultPathRef = useRef(selectedVaultPath)
  selectedVaultPathRef.current = selectedVaultPath

  const { clearSelectedFile, loadFile, resetEditor, saveCurrentFile, selectedPathRef } = editor
  const {
    cancelPendingLoad: cancelPendingTextLoad,
    loadFile: loadTextFile,
    resetEditor: resetTextEditor,
    saveCurrentFile: saveCurrentTextFile,
    selectedPathRef: selectedTextPathRef
  } = textEditor
  const { bumpIndexRevision, indexRevision, setIndexNotes } = noteIndex

  const selectNote = useCallback(
    async (relativePath: string, saveBeforeLoad = true): Promise<void> => {
      const requestId = selectionRequestRef.current + 1
      selectionRequestRef.current = requestId
      const previousUiPath = selectedVaultPathRef.current
      const rollbackPath = isEditableTextPath(previousUiPath)
        ? selectedTextPathRef.current
        : previousUiPath
      cancelPendingTextLoad()

      if (isEditableTextPath(previousUiPath)) {
        const saved = await saveCurrentTextFile()

        if (requestId !== selectionRequestRef.current) {
          return
        }

        if (!saved) {
          setSelectedVaultPath((currentPath) =>
            currentPath === previousUiPath ? rollbackPath : currentPath
          )
          return
        }
      }

      if (requestId !== selectionRequestRef.current) {
        return
      }

      setSelectedVaultPath(relativePath)
      await loadFile(relativePath, saveBeforeLoad)
    },
    [
      cancelPendingTextLoad,
      loadFile,
      saveCurrentTextFile,
      selectedTextPathRef,
      setSelectedVaultPath
    ]
  )

  const selectTextFile = useCallback(
    async (relativePath: string): Promise<void> => {
      const requestId = selectionRequestRef.current + 1
      selectionRequestRef.current = requestId
      const previousUiPath = selectedVaultPathRef.current
      const rollbackPath = isEditableTextPath(previousUiPath)
        ? selectedTextPathRef.current
        : previousUiPath

      if (isNotePath(previousUiPath) && !(await saveCurrentFile())) {
        return
      }

      if (requestId !== selectionRequestRef.current) {
        return
      }

      setSelectedVaultPath(relativePath)
      const result = await loadTextFile(relativePath)

      if (requestId === selectionRequestRef.current && result === 'save-failed') {
        setSelectedVaultPath((currentPath) =>
          currentPath === relativePath ? rollbackPath : currentPath
        )
      }
    },
    [loadTextFile, saveCurrentFile, selectedTextPathRef, setSelectedVaultPath]
  )

  const selectNonEditableFile = useCallback(
    async (relativePath: string): Promise<void> => {
      const requestId = selectionRequestRef.current + 1
      selectionRequestRef.current = requestId
      const currentPath = selectedVaultPathRef.current
      const rollbackPath = isEditableTextPath(currentPath)
        ? selectedTextPathRef.current
        : currentPath
      cancelPendingTextLoad()
      const saved = isNotePath(currentPath)
        ? await saveCurrentFile()
        : !isEditableTextPath(currentPath) || (await saveCurrentTextFile())

      if (requestId !== selectionRequestRef.current) {
        return
      }

      if (!saved) {
        setSelectedVaultPath((selectedPath) =>
          selectedPath === currentPath ? rollbackPath : selectedPath
        )
        return
      }

      setSelectedVaultPath(relativePath)
    },
    [
      cancelPendingTextLoad,
      saveCurrentFile,
      saveCurrentTextFile,
      selectedTextPathRef,
      setSelectedVaultPath
    ]
  )

  const selectTreeFile = useCallback(
    (relativePath: string): void => {
      if (isNotePath(relativePath)) {
        void selectNote(relativePath)
        return
      }

      if (isEditableTextPath(relativePath)) {
        void selectTextFile(relativePath)
        return
      }

      void selectNonEditableFile(relativePath)
    },
    [selectNonEditableFile, selectNote, selectTextFile]
  )

  const refreshVaultSnapshot = useCallback(async (): Promise<void> => {
    const [files, treeFiles, notes] = await Promise.all([
      window.vaultApi.listFiles(),
      window.vaultApi.listTreeFiles(),
      window.indexApi.notes()
    ])

    setVault((currentVault) => {
      if (!currentVault) {
        return currentVault
      }

      return {
        ...currentVault,
        files,
        treeFiles
      }
    })
    setIndexNotes(notes)
  }, [setIndexNotes, setVault])

  const refreshNoteSnapshot = useCallback(async (): Promise<void> => {
    const [files, notes] = await Promise.all([window.vaultApi.listFiles(), window.indexApi.notes()])

    setVault((currentVault) => (currentVault ? { ...currentVault, files } : currentVault))
    setIndexNotes(notes)
  }, [setIndexNotes, setVault])

  const refreshTreeSnapshot = useCallback(async (): Promise<void> => {
    const treeFiles = await window.vaultApi.listTreeFiles()
    const availablePaths = new Set(treeFiles.map((file) => file.relativePath))

    setVault((currentVault) => (currentVault ? { ...currentVault, treeFiles } : currentVault))
    setSelectedVaultPath((currentPath) => {
      if (!currentPath || availablePaths.has(currentPath)) {
        return currentPath
      }

      if (isNotePath(currentPath)) {
        const editorPath = selectedPathRef.current
        return editorPath && availablePaths.has(editorPath) ? editorPath : null
      }

      if (isEditableTextPath(currentPath)) {
        const textEditorPath = selectedTextPathRef.current
        return textEditorPath && availablePaths.has(textEditorPath) ? textEditorPath : null
      }

      return null
    })
  }, [selectedPathRef, selectedTextPathRef, setSelectedVaultPath, setVault])

  const refreshTrashCount = useCallback(async (): Promise<void> => {
    try {
      const entries = await window.vaultApi.listTrash()
      setTrashCount(entries.length)
    } catch {
      setTrashCount(0)
    }
  }, [])

  const createNote = useCallback(
    async (relativePath: string, content: string): Promise<void> => {
      await saveCurrentFile()
      const createdPath = await window.vaultApi.createFile(relativePath, content)
      await refreshVaultSnapshot()
      await selectNote(createdPath, false)
    },
    [refreshVaultSnapshot, saveCurrentFile, selectNote]
  )

  const handleDelete = useCallback(
    async (relativePath: string): Promise<void> => {
      setVaultOpsPending(true)
      onError(null)
      try {
        await window.vaultApi.deleteFile(relativePath)
        clearSelectedFile(relativePath)
        setSelectedVaultPath((currentPath) => (currentPath === relativePath ? null : currentPath))
        await refreshVaultSnapshot()
        await refreshTrashCount()
        showToast(`Moved "${deriveNoteTitle(relativePath)}" to trash`)
      } catch (deleteError) {
        onError(formatError(deleteError))
      } finally {
        setVaultOpsPending(false)
      }
    },
    [
      clearSelectedFile,
      onError,
      refreshTrashCount,
      refreshVaultSnapshot,
      setSelectedVaultPath,
      showToast
    ]
  )

  const applyRename = useCallback(
    async (
      fromRelativePath: string,
      toRelativePath: string,
      updateLinks: boolean
    ): Promise<void> => {
      const result = await window.vaultApi.renameFile(fromRelativePath, toRelativePath, updateLinks)
      const activePath = selectedPathRef.current
      const reloadPath =
        activePath === fromRelativePath
          ? result.newRelativePath
          : activePath && result.rewrittenFiles.includes(activePath)
            ? activePath
            : null

      if (reloadPath) {
        await selectNote(reloadPath, false)
      } else {
        setSelectedVaultPath((currentPath) =>
          currentPath === fromRelativePath ? result.newRelativePath : currentPath
        )
      }

      await refreshVaultSnapshot()
      showToast(
        result.updatedLinks > 0
          ? `Renamed and updated ${result.updatedLinks} link${result.updatedLinks === 1 ? '' : 's'}`
          : `Renamed to "${deriveNoteTitle(result.newRelativePath)}"`
      )
    },
    [refreshVaultSnapshot, selectNote, selectedPathRef, setSelectedVaultPath, showToast]
  )

  const commitRename = useCallback(
    async (
      fromRelativePath: string,
      toRelativePath: string,
      updateLinks: boolean
    ): Promise<void> => {
      setVaultOpsPending(true)
      onError(null)

      try {
        if (!(await saveCurrentFile())) {
          return
        }

        await applyRename(fromRelativePath, toRelativePath, updateLinks)
        setRenameRequest(null)
      } catch (renameError) {
        onError(formatError(renameError))
      } finally {
        setVaultOpsPending(false)
      }
    },
    [applyRename, onError, saveCurrentFile]
  )

  const handleRename = useCallback(
    async (fromRelativePath: string, toRelativePath: string): Promise<void> => {
      if (fromRelativePath === toRelativePath) {
        return
      }

      setVaultOpsPending(true)
      onError(null)

      try {
        if (!(await saveCurrentFile())) {
          return
        }

        const plan = await window.vaultApi.planRename(fromRelativePath, toRelativePath)

        if (plan.linkCount > 0) {
          setRenameRequest({ fromRelativePath, toRelativePath, plan })
        } else {
          await applyRename(fromRelativePath, toRelativePath, true)
        }
      } catch (renameError) {
        onError(formatError(renameError))
      } finally {
        setVaultOpsPending(false)
      }
    },
    [applyRename, onError, saveCurrentFile]
  )

  const handleDuplicate = useCallback(
    async (relativePath: string): Promise<void> => {
      setVaultOpsPending(true)
      onError(null)
      try {
        const newPath = await window.vaultApi.duplicateFile(relativePath)
        await refreshVaultSnapshot()
        await selectNote(newPath, false)
        showToast(`Duplicated to "${deriveNoteTitle(newPath)}"`)
      } catch (duplicateError) {
        onError(formatError(duplicateError))
      } finally {
        setVaultOpsPending(false)
      }
    },
    [onError, refreshVaultSnapshot, selectNote, showToast]
  )

  const handleRevealInExplorer = useCallback(
    async (relativePath: string): Promise<void> => {
      try {
        await window.vaultApi.revealInExplorer(relativePath)
      } catch (revealError) {
        onError(formatError(revealError))
      }
    },
    [onError]
  )

  const handleCopyPath = useCallback(
    async (relativePath: string): Promise<void> => {
      try {
        const absolutePath = await window.vaultApi.resolveAbsolutePath(relativePath)
        await navigator.clipboard.writeText(absolutePath)
        showToast(`Copied ${absolutePath}`)
      } catch (copyError) {
        onError(formatError(copyError))
      }
    },
    [onError, showToast]
  )

  const handleEmptyTrash = useCallback(async (): Promise<void> => {
    setVaultOpsPending(true)
    onError(null)
    try {
      await window.vaultApi.emptyTrash()
      await refreshTrashCount()
      showToast('Trash emptied')
    } catch (emptyTrashError) {
      onError(formatError(emptyTrashError))
    } finally {
      setVaultOpsPending(false)
    }
  }, [onError, refreshTrashCount, showToast])

  const handleSortModeChange = useCallback((next: FileTreeSortMode): void => {
    setSortMode(next)
    void window.appApi.setFileTreeSort(next).catch(() => {
      // Persistence is best-effort — the in-memory sort still applies.
    })
  }, [])

  useEffect(() => {
    if (!vault) {
      return
    }
    void window.appApi.getFileTreeSort().then((persisted) => {
      setSortMode(persisted)
    })
    queueMicrotask(() => {
      void refreshTrashCount()
    })
  }, [vault, refreshTrashCount])

  useEffect(() => {
    if (!vault) {
      return
    }
    queueMicrotask(() => {
      void refreshTrashCount()
    })
  }, [indexRevision, vault, refreshTrashCount])

  useEffect(() => {
    const hadVault = prevVaultRef.current
    prevVaultRef.current = vault
    if (hadVault && !vault) {
      queueMicrotask(() => {
        setTrashCount(0)
      })
    }
  }, [vault])

  const openVaultInternal = useCallback(
    async (openedVault: VaultInfo | null): Promise<void> => {
      if (!openedVault) {
        return
      }

      setVault(openedVault)
      setIndexNotes(await window.indexApi.notes())
      bumpIndexRevision()
      resetEditor()
      resetTextEditor()
      setSelectedVaultPath(null)

      const firstFile =
        openedVault.files.find((file) => file.relativePath.endsWith('/Welcome.mdx')) ??
        openedVault.files.find((file) => file.relativePath === 'Welcome.mdx') ??
        openedVault.files[0]

      if (firstFile) {
        await selectNote(firstFile.relativePath, false)
      }
    },
    [
      bumpIndexRevision,
      resetEditor,
      resetTextEditor,
      selectNote,
      setIndexNotes,
      setSelectedVaultPath,
      setVault
    ]
  )

  const openVault = useCallback(async (): Promise<void> => {
    const [noteSaved, textSaved] = await Promise.all([saveCurrentFile(), saveCurrentTextFile()])

    if (!noteSaved || !textSaved) {
      return
    }

    setIsOpening(true)
    onError(null)

    try {
      const openedVault = await window.vaultApi.openVault()
      await openVaultInternal(openedVault)
    } catch (openError) {
      onError(formatError(openError))
    } finally {
      setIsOpening(false)
    }
  }, [onError, openVaultInternal, saveCurrentFile, saveCurrentTextFile])

  const reopenVault = useCallback(
    async (path: string): Promise<boolean> => {
      setIsOpening(true)
      onError(null)

      try {
        const openedVault = await window.vaultApi.openVaultPath(path)
        await openVaultInternal(openedVault)
        return openedVault !== null
      } catch (reopenError) {
        console.warn('Failed to reopen last vault:', reopenError)
        return false
      } finally {
        setIsOpening(false)
      }
    },
    [onError, openVaultInternal]
  )

  useEffect(() => {
    let cancelled = false

    void window.vaultApi.lastOpenVault().then((path) => {
      if (cancelled || !path) {
        return
      }
      void reopenVault(path)
    })

    return () => {
      cancelled = true
    }
  }, [reopenVault])

  useEffect(() => {
    if (!vault) {
      return
    }

    return window.indexApi.onDidChange(() => {
      bumpIndexRevision()

      void refreshNoteSnapshot().catch((refreshError: unknown) => {
        onError(formatError(refreshError))
      })
    })
  }, [bumpIndexRevision, onError, refreshNoteSnapshot, vault])

  useEffect(() => {
    if (!vault) {
      return
    }

    return window.vaultApi.onTreeDidChange(() => {
      void refreshTreeSnapshot().catch((refreshError: unknown) => {
        onError(formatError(refreshError))
      })
    })
  }, [onError, refreshTreeSnapshot, vault])

  return {
    isOpening,
    sortMode,
    vaultOpsPending,
    trashCount,
    renameRequest,
    setRenameRequest,
    selectNote,
    selectTreeFile,
    refreshVaultSnapshot,
    createNote,
    handleDelete,
    commitRename,
    handleRename,
    handleDuplicate,
    handleRevealInExplorer,
    handleCopyPath,
    handleEmptyTrash,
    handleSortModeChange,
    openVault
  }
}

export type VaultSessionController = ReturnType<typeof useVaultSession>
