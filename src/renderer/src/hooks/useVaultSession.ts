import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileTreeSortMode } from '@/explorer/FileTree'
import { type AppSettingsController, DEFAULT_APP_SETTINGS_SNAPSHOT } from '@/hooks/useAppSettings'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import type { WorkbenchController } from '@/hooks/useWorkbench'
import { formatError } from '@/lib/format-error'
import { deriveNoteTitle } from '@/lib/note-title'
import type { VaultInfo, VaultTreeFile } from '@/vault/types'
import { createAndOpenVaultNote, openRefreshedVaultFile } from '@/workbench/note-action-lifecycle'
import { deleteVaultNote } from '@/workbench/note-delete-lifecycle'
import type { RenamePlanPreview } from '../../../shared/rename'

export interface RenameRequest {
  fromRelativePath: string
  toRelativePath: string
  plan: RenamePlanPreview
}

interface UseVaultSessionOptions {
  vault: VaultInfo | null
  setVault: Dispatch<SetStateAction<VaultInfo | null>>
  workbench: WorkbenchController
  noteIndex: NoteIndexController
  appSettings: AppSettingsController
  onError: (message: string | null) => void
  showToast: (message: string) => void
}

export function useVaultSession({
  vault,
  setVault,
  workbench,
  noteIndex,
  appSettings,
  onError,
  showToast
}: UseVaultSessionOptions) {
  const [isOpening, setIsOpening] = useState(false)
  const sortMode = appSettings.snapshot?.fileTreeSort ?? DEFAULT_APP_SETTINGS_SNAPSHOT.fileTreeSort
  const [vaultOpsPending, setVaultOpsPending] = useState(false)
  const [trashCount, setTrashCount] = useState(0)
  const [renameRequest, setRenameRequest] = useState<RenameRequest | null>(null)
  const prevVaultRef = useRef(vault)
  const { bumpIndexRevision, indexRevision, setIndexNotes } = noteIndex

  const selectNote = useCallback(
    async (relativePath: string, _saveBeforeLoad = true): Promise<boolean> => {
      return workbench.openOrActivate(relativePath)
    },
    [workbench.openOrActivate]
  )

  const selectTreeFile = useCallback(
    (relativePath: string): Promise<boolean> => {
      return workbench.openOrActivate(relativePath)
    },
    [workbench.openOrActivate]
  )

  const refreshVaultSnapshot = useCallback(async (): Promise<VaultTreeFile[]> => {
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
    return treeFiles
  }, [setIndexNotes, setVault])

  const refreshNoteSnapshot = useCallback(async (): Promise<void> => {
    const [files, notes] = await Promise.all([window.vaultApi.listFiles(), window.indexApi.notes()])

    setVault((currentVault) => (currentVault ? { ...currentVault, files } : currentVault))
    setIndexNotes(notes)
  }, [setIndexNotes, setVault])

  const refreshTreeSnapshot = useCallback(async (): Promise<void> => {
    const treeFiles = await window.vaultApi.listTreeFiles()
    setVault((currentVault) => (currentVault ? { ...currentVault, treeFiles } : currentVault))
  }, [setVault])

  const refreshTrashCount = useCallback(async (): Promise<void> => {
    try {
      const entries = await window.vaultApi.listTrash()
      setTrashCount(entries.length)
    } catch {
      setTrashCount(0)
    }
  }, [])

  const createNote = useCallback(
    (relativePath: string, content: string): Promise<string> =>
      createAndOpenVaultNote({
        relativePath,
        content,
        saveActiveItem: workbench.saveActiveItem,
        createFile: window.vaultApi.createFile,
        refreshVaultSnapshot,
        openCreatedFile: (createdPath, file) =>
          workbench.openOrActivate(createdPath, { knownFile: file }),
        rollbackCreatedFile: async (createdPath) => {
          await window.vaultApi.deleteFile(createdPath)
        }
      }),
    [refreshVaultSnapshot, workbench.openOrActivate, workbench.saveActiveItem]
  )

  const handleDelete = useCallback(
    async (relativePath: string): Promise<void> => {
      setVaultOpsPending(true)
      onError(null)
      try {
        await deleteVaultNote({
          prepareDelete: () => workbench.prepareNoteMutation(relativePath),
          deleteFile: async () => {
            await window.vaultApi.deleteFile(relativePath)
          },
          refreshAfterDelete: async () => {
            await Promise.all([refreshVaultSnapshot(), refreshTrashCount()])
          },
          commitDelete: () => workbench.commitNoteDelete(relativePath),
          reportSuccess: () => showToast(`Moved "${deriveNoteTitle(relativePath)}" to trash`)
        })
      } catch (deleteError) {
        onError(formatError(deleteError))
      } finally {
        setVaultOpsPending(false)
      }
    },
    [
      onError,
      refreshTrashCount,
      refreshVaultSnapshot,
      showToast,
      workbench.commitNoteDelete,
      workbench.prepareNoteMutation
    ]
  )

  const applyRename = useCallback(
    async (
      fromRelativePath: string,
      toRelativePath: string,
      updateLinks: boolean
    ): Promise<void> => {
      const activePath = workbench.activePath
      const result = await window.vaultApi.renameFile(fromRelativePath, toRelativePath, updateLinks)
      workbench.commitNoteRename(fromRelativePath, result.newRelativePath)

      if (
        activePath &&
        activePath !== fromRelativePath &&
        result.rewrittenFiles.includes(activePath)
      ) {
        await workbench.reloadActiveItem()
      }

      await refreshVaultSnapshot()
      showToast(
        result.updatedLinks > 0
          ? `Renamed and updated ${result.updatedLinks} link${result.updatedLinks === 1 ? '' : 's'}`
          : `Renamed to "${deriveNoteTitle(result.newRelativePath)}"`
      )
    },
    [
      refreshVaultSnapshot,
      showToast,
      workbench.activePath,
      workbench.commitNoteRename,
      workbench.reloadActiveItem
    ]
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
        if (!(await workbench.saveActiveItem())) {
          return
        }
        if (!(await workbench.prepareNoteMutation(fromRelativePath))) {
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
    [applyRename, onError, workbench.prepareNoteMutation, workbench.saveActiveItem]
  )

  const handleRename = useCallback(
    async (fromRelativePath: string, toRelativePath: string): Promise<void> => {
      if (fromRelativePath === toRelativePath) {
        return
      }

      setVaultOpsPending(true)
      onError(null)

      try {
        if (!(await workbench.saveActiveItem())) {
          return
        }
        if (!(await workbench.prepareNoteMutation(fromRelativePath))) {
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
    [applyRename, onError, workbench.prepareNoteMutation, workbench.saveActiveItem]
  )

  const handleDuplicate = useCallback(
    async (relativePath: string): Promise<void> => {
      setVaultOpsPending(true)
      onError(null)
      try {
        const newPath = await window.vaultApi.duplicateFile(relativePath)
        const opened = await openRefreshedVaultFile({
          relativePath: newPath,
          refreshVaultSnapshot,
          openFile: (path, file) => workbench.openOrActivate(path, { knownFile: file })
        })
        if (!opened) {
          return
        }
        showToast(`Duplicated to "${deriveNoteTitle(newPath)}"`)
      } catch (duplicateError) {
        onError(formatError(duplicateError))
      } finally {
        setVaultOpsPending(false)
      }
    },
    [onError, refreshVaultSnapshot, showToast, workbench.openOrActivate]
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

  const handleSortModeChange = useCallback(
    async (next: FileTreeSortMode): Promise<void> => {
      await appSettings.updateSettings({ fileTreeSort: next })
    },
    [appSettings.updateSettings]
  )

  useEffect(() => {
    if (!vault) {
      return
    }
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

      workbench.resetForVault(openedVault)
      setIndexNotes([])
      setVault(openedVault)
      setIndexNotes(await window.indexApi.notes())
      bumpIndexRevision()

      const firstFile =
        openedVault.files.find((file) => file.relativePath.endsWith('/Welcome.mdx')) ??
        openedVault.files.find((file) => file.relativePath === 'Welcome.mdx') ??
        openedVault.files[0]

      if (firstFile) {
        await workbench.openOrActivate(firstFile.relativePath)
      }
    },
    [bumpIndexRevision, setIndexNotes, setVault, workbench.openOrActivate, workbench.resetForVault]
  )

  const openVault = useCallback(async (): Promise<void> => {
    if (!(await workbench.saveActiveItem())) {
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
  }, [onError, openVaultInternal, workbench.saveActiveItem])

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
  const startupReopenRef = useRef(reopenVault)
  startupReopenRef.current = reopenVault

  useEffect(() => {
    let cancelled = false

    void window.vaultApi.lastOpenVault().then((path) => {
      if (cancelled || !path) {
        return
      }
      void startupReopenRef.current(path)
    })

    return () => {
      cancelled = true
    }
  }, [])

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
