import { useCallback, useEffect, useRef, useState } from 'react'

import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { NoteIndexController } from '@/hooks/useNoteIndex'
import { formatError } from '@/lib/format-error'
import type { BookmarkManifest } from '../../../shared/bookmarks'
import type {
  KnowledgeNoteSnapshot,
  PropertyMutationInput,
  PropertyRenamePlan,
  PropertySummary,
  UnlinkedMention
} from '../../../shared/knowledge'

interface UseKnowledgeUtilitiesOptions {
  vaultKey: string | null
  selectedPath: string | null
  editor: NoteEditorController
  noteIndex: NoteIndexController
  onError: (message: string | null) => void
}

export interface KnowledgeUtilitiesController {
  snapshot: KnowledgeNoteSnapshot | null
  propertyInventory: PropertySummary[]
  bookmarks: BookmarkManifest | null
  isLoading: boolean
  isMutating: boolean
  refresh: () => Promise<void>
  mutateProperty: (mutation: PropertyMutationInput) => Promise<boolean>
  linkMention: (mention: UnlinkedMention, targetRelativePath: string) => Promise<boolean>
  planPropertyRename: (oldName: string, newName: string) => Promise<PropertyRenamePlan | null>
  applyPropertyRename: (plan: PropertyRenamePlan) => Promise<boolean>
  saveBookmarks: (manifest: BookmarkManifest) => Promise<boolean>
}

export function useKnowledgeUtilities({
  vaultKey,
  selectedPath,
  editor,
  noteIndex,
  onError
}: UseKnowledgeUtilitiesOptions): KnowledgeUtilitiesController {
  const [snapshotState, setSnapshotState] = useState<{
    relativePath: string
    value: KnowledgeNoteSnapshot
  } | null>(null)
  const [propertyInventory, setPropertyInventory] = useState<PropertySummary[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkManifest | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const requestRef = useRef(0)

  const load = useCallback(async (): Promise<void> => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId

    if (!vaultKey) {
      setSnapshotState(null)
      setPropertyInventory([])
      setBookmarks(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    if (!selectedPath) {
      setSnapshotState(null)
    }

    try {
      const [nextSnapshot, nextInventory, nextBookmarks] = await Promise.all([
        selectedPath ? window.knowledgeApi.noteSnapshot(selectedPath) : Promise.resolve(null),
        window.knowledgeApi.propertyInventory(),
        window.bookmarkApi.get()
      ])
      if (requestRef.current !== requestId) return

      setSnapshotState(
        nextSnapshot ? { relativePath: nextSnapshot.relativePath, value: nextSnapshot } : null
      )
      setPropertyInventory(nextInventory)
      setBookmarks(nextBookmarks)
    } catch (loadError) {
      if (requestRef.current === requestId) {
        onError(formatError(loadError))
      }
    } finally {
      if (requestRef.current === requestId) {
        setIsLoading(false)
      }
    }
  }, [onError, selectedPath, vaultKey])

  useEffect(() => {
    setSnapshotState((current) => (current?.relativePath === selectedPath ? current : null))
    void load()
  }, [load, noteIndex.indexRevision, selectedPath])

  const applyActiveSource = useCallback(
    (relativePath: string, source: string): void => {
      if (editor.selectedPath !== relativePath) return
      editor.setContent(source)
      editor.setSavedContent(source)
      editor.setLastSavedAt(new Date())
    },
    [editor]
  )

  const mutateProperty = useCallback(
    async (mutation: PropertyMutationInput): Promise<boolean> => {
      const snapshot = snapshotState?.relativePath === selectedPath ? snapshotState.value : null
      if (!selectedPath || !snapshot) return false
      if (editor.isDirty) {
        onError('Save the active note before editing properties.')
        return false
      }

      setIsMutating(true)
      try {
        const result = await window.knowledgeApi.mutateProperty({
          relativePath: selectedPath,
          expectedContentHash: snapshot.contentHash,
          mutation
        })
        applyActiveSource(result.relativePath, result.source)
        noteIndex.bumpIndexRevision()
        await load()
        return true
      } catch (mutationError) {
        onError(formatError(mutationError))
        await load()
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [
      applyActiveSource,
      editor.isDirty,
      load,
      noteIndex.bumpIndexRevision,
      onError,
      selectedPath,
      snapshotState
    ]
  )

  const linkMention = useCallback(
    async (mention: UnlinkedMention, targetRelativePath: string): Promise<boolean> => {
      const snapshot = snapshotState?.relativePath === selectedPath ? snapshotState.value : null
      if (!selectedPath || !snapshot) return false
      if (editor.isDirty) {
        onError('Save the active note before linking an unlinked mention.')
        return false
      }

      setIsMutating(true)
      try {
        const result = await window.knowledgeApi.linkMention({
          relativePath: selectedPath,
          expectedContentHash: snapshot.contentHash,
          mention,
          targetRelativePath
        })
        applyActiveSource(result.relativePath, result.source)
        noteIndex.bumpIndexRevision()
        await load()
        return true
      } catch (mutationError) {
        onError(formatError(mutationError))
        await load()
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [
      applyActiveSource,
      editor.isDirty,
      load,
      noteIndex.bumpIndexRevision,
      onError,
      selectedPath,
      snapshotState
    ]
  )

  const planPropertyRename = useCallback(
    async (oldName: string, newName: string): Promise<PropertyRenamePlan | null> => {
      try {
        return await window.knowledgeApi.planPropertyRename(oldName, newName)
      } catch (renameError) {
        onError(formatError(renameError))
        return null
      }
    },
    [onError]
  )

  const applyPropertyRename = useCallback(
    async (plan: PropertyRenamePlan): Promise<boolean> => {
      if (editor.isDirty) {
        onError('Save the active note before renaming a property across the vault.')
        return false
      }
      setIsMutating(true)
      try {
        const result = await window.knowledgeApi.applyPropertyRename({
          oldName: plan.oldName,
          newName: plan.newName,
          expectedFiles: plan.affectedFiles.map(({ relativePath, contentHash }) => ({
            relativePath,
            contentHash
          }))
        })
        const activeUpdate = result.updatedFiles.find(
          (file) => file.relativePath === editor.selectedPath
        )
        if (activeUpdate) {
          applyActiveSource(activeUpdate.relativePath, activeUpdate.source)
        }
        noteIndex.bumpIndexRevision()
        await load()
        return true
      } catch (renameError) {
        onError(formatError(renameError))
        await load()
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [
      applyActiveSource,
      editor.isDirty,
      editor.selectedPath,
      load,
      noteIndex.bumpIndexRevision,
      onError
    ]
  )

  const saveBookmarks = useCallback(
    async (manifest: BookmarkManifest): Promise<boolean> => {
      const expectedRevision = bookmarks?.revision
      if (expectedRevision === undefined) return false
      setIsMutating(true)
      try {
        const confirmed = await window.bookmarkApi.save(manifest, expectedRevision)
        setBookmarks(confirmed)
        return true
      } catch (bookmarkError) {
        onError(formatError(bookmarkError))
        await load()
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [bookmarks?.revision, load, onError]
  )

  return {
    snapshot: snapshotState?.relativePath === selectedPath ? snapshotState.value : null,
    propertyInventory,
    bookmarks,
    isLoading,
    isMutating,
    refresh: load,
    mutateProperty,
    linkMention,
    planPropertyRename,
    applyPropertyRename,
    saveBookmarks
  }
}
