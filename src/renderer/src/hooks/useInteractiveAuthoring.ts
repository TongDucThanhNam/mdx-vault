import { useCallback, useMemo, useRef, useState } from 'react'
import type { EditorSelectionSnapshot } from '@/editor/MdxEditor'
import {
  hashInteractiveNoteContent,
  type InteractiveCreateForm,
  type InteractiveCreateInvocation,
  runInteractiveCreateJourney
} from '@/interactive/interactive-authoring-controller'
import { formatError } from '@/lib/format-error'
import type { VaultTreeFile } from '@/vault/types'
import type { NoteEditorController } from './useNoteEditor'
import type { WorkbenchController } from './useWorkbench'

interface UseInteractiveAuthoringOptions {
  hasVault: boolean
  editable: boolean
  selectedNotePath: string | null
  editorSelection: EditorSelectionSnapshot | null
  editor: NoteEditorController
  workbench: WorkbenchController
  refreshVaultSnapshot: () => Promise<VaultTreeFile[]>
  openDialog: () => void
  onStarterCreated: (result: Awaited<ReturnType<typeof window.interactiveApi.create>>) => void
  onError: (message: string | null) => void
  showToast: (message: string) => void
}

export function useInteractiveAuthoring({
  hasVault,
  editable,
  selectedNotePath,
  editorSelection,
  editor,
  workbench,
  refreshVaultSnapshot,
  openDialog,
  onStarterCreated,
  onError,
  showToast
}: UseInteractiveAuthoringOptions) {
  const [isCreating, setIsCreating] = useState(false)
  const invocationRef = useRef<InteractiveCreateInvocation | null>(null)
  const latestScopeRef = useRef({
    noteRelativePath: selectedNotePath,
    sessionId: workbench.state.sessionId
  })
  latestScopeRef.current = {
    noteRelativePath: selectedNotePath,
    sessionId: workbench.state.sessionId
  }

  const canCreate = useMemo(
    () =>
      hasVault &&
      editable &&
      selectedNotePath !== null &&
      editorSelection !== null &&
      !editor.isLoadingFile &&
      !editor.isCurrentFileMissing &&
      !isCreating,
    [
      editable,
      editor.isCurrentFileMissing,
      editor.isLoadingFile,
      editorSelection,
      hasVault,
      isCreating,
      selectedNotePath
    ]
  )

  const openCreateDialog = useCallback((): void => {
    if (
      !hasVault ||
      !editable ||
      !selectedNotePath ||
      !editorSelection ||
      editor.isLoadingFile ||
      editor.isCurrentFileMissing ||
      isCreating
    ) {
      onError('Open an editable Markdown note and place the caret before creating an interactive.')
      return
    }

    invocationRef.current = {
      noteRelativePath: selectedNotePath,
      insertionOffset: editorSelection.head,
      sessionId: workbench.state.sessionId
    }
    onError(null)
    openDialog()
  }, [
    editable,
    editor.isCurrentFileMissing,
    editor.isLoadingFile,
    editorSelection,
    hasVault,
    isCreating,
    onError,
    openDialog,
    selectedNotePath,
    workbench.state.sessionId
  ])

  const cancelCreateDialog = useCallback((): void => {
    if (!isCreating) {
      invocationRef.current = null
    }
  }, [isCreating])

  const createInteractive = useCallback(
    async (form: InteractiveCreateForm): Promise<void> => {
      const invocation = invocationRef.current
      if (!invocation) {
        throw new Error('The interactive creation request expired. Open the dialog again.')
      }

      setIsCreating(true)
      onError(null)
      try {
        let refreshedFiles: VaultTreeFile[] = []
        const journey = await runInteractiveCreateJourney({
          invocation,
          form,
          saveActiveNote: editor.saveCurrentFile,
          getCurrentScope: () => latestScopeRef.current,
          getPersistedNoteContent: () => editor.savedContentRef.current,
          hashContent: hashInteractiveNoteContent,
          create: window.interactiveApi.create,
          applyCommittedNote: (result) => {
            editor.restoreFileBuffer(
              result.noteRelativePath,
              result.noteContent,
              result.noteContent,
              false
            )
          },
          refreshVaultSnapshot: async () => {
            refreshedFiles = await refreshVaultSnapshot()
          },
          openComponent: (result) =>
            workbench.openOrActivate(result.componentRelativePath, {
              focus: true,
              knownFile: refreshedFiles.find(
                (file) => file.relativePath === result.componentRelativePath
              )
            }),
          onCommitted: onStarterCreated
        })

        invocationRef.current = null
        if (journey.disposition === 'completed-in-background') {
          showToast(`Created ${journey.result.projectRoot}; the active note was left unchanged.`)
          return
        }

        showToast(
          journey.warnings.length > 0
            ? journey.warnings.join(' ')
            : `Created ${journey.result.projectRoot} and inserted it into the note.`
        )
      } catch (createError) {
        const message = formatError(createError)
        onError(message)
        throw createError
      } finally {
        setIsCreating(false)
      }
    },
    [
      editor.restoreFileBuffer,
      editor.saveCurrentFile,
      editor.savedContentRef,
      onError,
      onStarterCreated,
      refreshVaultSnapshot,
      showToast,
      workbench.openOrActivate
    ]
  )

  return {
    canCreate,
    isCreating,
    openCreateDialog,
    cancelCreateDialog,
    createInteractive
  }
}

export type InteractiveAuthoringController = ReturnType<typeof useInteractiveAuthoring>
