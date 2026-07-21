import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ViewMode } from '@/components/ViewModeToggle'
import {
  captureActiveEditorView,
  type EditorViewSnapshot,
  restoreActiveEditorView
} from '@/editor/editor-view-state'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { TextFileEditorController } from '@/hooks/useTextFileEditor'
import { formatError } from '@/lib/format-error'
import { type PreparedPreviewImage, PreviewImageCache } from '@/preview/preview-image'
import { isEditableTextPath, isNotePath, isPreviewableVaultImagePath } from '@/vault/file-kind'
import type { VaultInfo, VaultTreeFile } from '@/vault/types'
import { runWorkbenchControllerTransaction } from '@/workbench/controller-transaction'
import { focusActiveDocument } from '@/workbench/document-focus'
import {
  type CachedWorkbenchBuffer,
  commitPreparedWorkbenchDocument,
  type PreparedWorkbenchDocument,
  prepareWorkbenchDocumentForController,
  releasePreparedWorkbenchDocument
} from '@/workbench/editor-adapter'
import type {
  ActivateOnClose,
  WhenClosingWithNoTabs,
  WorkbenchItem,
  WorkbenchItemKind,
  WorkbenchState,
  WorkbenchViewState
} from '@/workbench/types'
import {
  activateVisualWorkbenchItem,
  cancelMruSwitch,
  captureWorkbenchViewState,
  closeWorkbenchItem,
  commitTransactionalWorkbenchClose,
  createWorkbenchItem,
  createWorkbenchRequestCoordinator,
  createWorkbenchState,
  cycleMruSwitch,
  deleteWorkbenchItem,
  getMruSwitchCommitTarget,
  markWorkbenchItemMissing,
  markWorkbenchItemPresent,
  openOrActivateWorkbenchItem,
  renameWorkbenchItem,
  reopenWorkbenchItem,
  resetWorkbenchState,
  resolveCloseActiveIntent,
  resolveReopenCandidate,
  runWorkbenchTransaction,
  setWorkbenchItemDirty,
  startMruSwitch
} from '@/workbench/workbench-state'

interface UseWorkbenchOptions {
  vault: VaultInfo | null
  editor: NoteEditorController
  textEditor: TextFileEditorController
  viewMode: ViewMode
  setViewMode: Dispatch<SetStateAction<ViewMode>>
  setSelectedVaultPath: Dispatch<SetStateAction<string | null>>
  activateOnClose: ActivateOnClose
  whenClosingWithNoTabs: WhenClosingWithNoTabs
  onError: (message: string | null) => void
  showToast: (message: string) => void
}

interface OpenWorkbenchOptions {
  focus?: boolean
  knownFile?: VaultTreeFile
}

export interface WorkbenchController {
  state: WorkbenchState
  tabs: WorkbenchItem[]
  activePath: string | null
  activeItem: WorkbenchItem | null
  activeImageObjectUrl: string | null
  pendingMissingCloseItem: WorkbenchItem | null
  openOrActivate: (relativePath: string, options?: OpenWorkbenchOptions) => Promise<boolean>
  closeItem: (relativePath: string) => Promise<boolean>
  closeActiveItem: () => Promise<boolean>
  confirmDiscardMissingClose: () => Promise<boolean>
  cancelDiscardMissingClose: () => void
  activateVisual: (direction: 1 | -1) => Promise<boolean>
  reopenClosedItem: () => Promise<boolean>
  reloadActiveItem: () => Promise<boolean>
  startMruSwitch: (direction?: 1 | -1) => void
  cycleMruSwitch: (direction: 1 | -1) => void
  commitMruSwitch: () => Promise<boolean>
  cancelMruSwitch: () => void
  cancelPendingNavigation: () => void
  saveActiveItem: () => Promise<boolean>
  prepareNoteMutation: (relativePath: string) => Promise<boolean>
  commitNoteRename: (fromRelativePath: string, toRelativePath: string) => boolean
  commitNoteDelete: (relativePath: string) => Promise<boolean>
  resetForVault: (nextVault?: VaultInfo | null) => void
}

export function useWorkbench({
  vault,
  editor,
  textEditor,
  viewMode,
  setViewMode,
  setSelectedVaultPath,
  activateOnClose,
  whenClosingWithNoTabs,
  onError,
  showToast
}: UseWorkbenchOptions): WorkbenchController {
  const [state, setState] = useState(createWorkbenchState)
  const [pendingMissingCloseId, setPendingMissingCloseId] = useState<string | null>(null)
  const [activeImagePreview, setActiveImagePreview] = useState<PreparedPreviewImage | null>(null)
  const stateRef = useRef(state)
  const vaultRef = useRef(vault)
  const viewModeRef = useRef(viewMode)
  const activateOnCloseRef = useRef(activateOnClose)
  const whenClosingWithNoTabsRef = useRef(whenClosingWithNoTabs)
  const coordinatorRef = useRef(createWorkbenchRequestCoordinator())
  const bufferCacheRef = useRef(new Map<string, CachedWorkbenchBuffer>())
  const imageCacheRef = useRef(new PreviewImageCache())
  const restoreViewRequestRef = useRef(0)
  const editorControllerRef = useRef(editor)
  const textEditorControllerRef = useRef(textEditor)

  stateRef.current = state
  vaultRef.current = vault
  viewModeRef.current = viewMode
  activateOnCloseRef.current = activateOnClose
  whenClosingWithNoTabsRef.current = whenClosingWithNoTabs
  editorControllerRef.current = editor
  textEditorControllerRef.current = textEditor

  useEffect(() => {
    return () => activeImagePreview?.release()
  }, [activeImagePreview])

  useEffect(() => {
    return () => imageCacheRef.current.dispose()
  }, [])

  const commitState = useCallback(
    (nextState: WorkbenchState): void => {
      stateRef.current = nextState
      setState(nextState)
      setSelectedVaultPath(nextState.activeId)
    },
    [setSelectedVaultPath]
  )

  const cancelPendingNavigation = useCallback((): void => {
    coordinatorRef.current.invalidate()
    editorControllerRef.current.cancelPendingLoad()
    textEditorControllerRef.current.cancelPendingLoad()
  }, [])

  const cacheActiveBuffer = useCallback((): void => {
    const activeItem = getActiveItem(stateRef.current)

    const noteEditor = editorControllerRef.current
    const textFileEditor = textEditorControllerRef.current

    if (
      activeItem?.kind === 'note' &&
      noteEditor.selectedPathRef.current === activeItem.relativePath
    ) {
      bufferCacheRef.current.set(activeItem.id, {
        kind: 'note',
        content: noteEditor.contentRef.current,
        savedContent: noteEditor.savedContentRef.current
      })
      return
    }

    if (
      activeItem?.kind === 'text' &&
      textFileEditor.selectedPathRef.current === activeItem.relativePath
    ) {
      bufferCacheRef.current.set(activeItem.id, {
        kind: 'text',
        content: textFileEditor.contentRef.current,
        savedContent: textFileEditor.savedContentRef.current
      })
    }
  }, [])

  const saveActiveItem = useCallback(async (): Promise<boolean> => {
    const activeItem = getActiveItem(stateRef.current)

    if (!activeItem || (activeItem.kind !== 'note' && activeItem.kind !== 'text')) {
      return true
    }

    const saved =
      activeItem.kind === 'note'
        ? await editorControllerRef.current.saveCurrentFile()
        : await textEditorControllerRef.current.saveCurrentFile()

    cacheActiveBuffer()

    if (!saved) {
      return false
    }

    const controller =
      activeItem.kind === 'note' ? editorControllerRef.current : textEditorControllerRef.current
    const fullySaved =
      stateRef.current.activeId === activeItem.id &&
      controller.selectedPathRef.current === activeItem.relativePath &&
      controller.contentRef.current === controller.savedContentRef.current

    commitState(setWorkbenchItemDirty(stateRef.current, activeItem.id, !fullySaved))
    if (!fullySaved) {
      onError('The file changed while it was being saved; navigation was cancelled')
    }

    return fullySaved
  }, [cacheActiveBuffer, commitState, onError])

  const isEditableItemBufferClean = useCallback((item: WorkbenchItem): boolean => {
    if (item.kind === 'note') {
      const noteEditor = editorControllerRef.current
      return (
        noteEditor.selectedPathRef.current === item.relativePath &&
        noteEditor.contentRef.current === noteEditor.savedContentRef.current
      )
    }

    if (item.kind === 'text') {
      const textFileEditor = textEditorControllerRef.current
      return (
        textFileEditor.selectedPathRef.current === item.relativePath &&
        textFileEditor.contentRef.current === textFileEditor.savedContentRef.current
      )
    }

    return true
  }, [])

  const prepareItemLoad = useCallback(
    async (
      item: WorkbenchItem,
      isCurrent: () => boolean = () => true
    ): Promise<PreparedWorkbenchDocument | null> => {
      const result = await prepareWorkbenchDocumentForController(
        {
          item,
          cachedBuffer: bufferCacheRef.current.get(item.id),
          readNote: window.vaultApi.readFile,
          readText: window.vaultApi.readTextFile,
          prepareImage: (relativePath) => imageCacheRef.current.prepare(relativePath),
          probeUnsupported: window.vaultApi.probeFile,
          isCurrent
        },
        (loadError) => onError(formatError(loadError))
      )

      if (result.status === 'unavailable' && isCurrent()) {
        onError(`Cannot restore ${item.relativePath}: its session buffer is unavailable`)
      }

      return result.status === 'ready' ? result.document : null
    },
    [onError]
  )

  const commitItemLoad = useCallback((prepared: PreparedWorkbenchDocument): void => {
    commitPreparedWorkbenchDocument(prepared, {
      cancelNoteLoad: editorControllerRef.current.cancelPendingLoad,
      cancelTextLoad: textEditorControllerRef.current.cancelPendingLoad,
      restoreNoteBuffer: editorControllerRef.current.restoreFileBuffer,
      restoreTextBuffer: textEditorControllerRef.current.restoreFileBuffer,
      restoreImagePreview: setActiveImagePreview
    })

    if (
      (prepared.kind === 'note' || prepared.kind === 'text') &&
      prepared.content !== undefined &&
      prepared.savedContent !== undefined
    ) {
      bufferCacheRef.current.set(prepared.id, {
        kind: prepared.kind,
        content: prepared.content,
        savedContent: prepared.savedContent
      })
    }
  }, [])

  const restoreItemView = useCallback(
    (item: WorkbenchItem, focus: boolean): void => {
      const requestId = restoreViewRequestRef.current + 1
      restoreViewRequestRef.current = requestId
      if (item.kind === 'note') {
        setViewMode(item.viewState?.viewMode ?? 'live')
      }

      const applyView = (restoreFocus: boolean): void => {
        if (restoreViewRequestRef.current !== requestId || stateRef.current.activeId !== item.id) {
          return
        }

        const editorSnapshot = toEditorSnapshot(item.viewState)
        const restoredEditor = restoreActiveEditorView(editorSnapshot)

        if (!restoredEditor && item.viewState) {
          const surface = getActiveDocumentScrollSurface()
          if (surface) {
            surface.scrollTop = item.viewState.scrollTop ?? 0
            surface.scrollLeft = item.viewState.scrollLeft ?? 0
          }
        }

        if (restoreFocus) {
          focusActiveDocument()
        }
      }

      window.setTimeout(() => {
        applyView(focus)
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => applyView(false))
        })
      }, 0)
      window.setTimeout(() => applyView(false), 120)
    },
    [setViewMode]
  )

  const openOrActivate = useCallback(
    async (relativePath: string, options: OpenWorkbenchOptions = {}): Promise<boolean> => {
      const currentState = stateRef.current
      const existingItem = currentState.items.find((item) => item.id === relativePath)
      const vaultFile =
        options.knownFile?.relativePath === relativePath
          ? options.knownFile
          : vaultRef.current?.treeFiles.find((file) => file.relativePath === relativePath)

      if (!existingItem && !vaultFile) {
        cancelPendingNavigation()
        onError(`File is no longer available: ${relativePath}`)
        return false
      }

      if (currentState.activeId === relativePath) {
        cancelPendingNavigation()
        const nextState =
          existingItem?.missing && vaultFile
            ? markWorkbenchItemPresent(currentState, relativePath)
            : openOrActivateWorkbenchItem(currentState, existingItem as WorkbenchItem)
        if (vaultFile) {
          editorControllerRef.current.markCurrentFileMissing(relativePath, false)
          textEditorControllerRef.current.markCurrentFileMissing(relativePath, false)
        }
        commitState(nextState)
        if (options.focus !== false) {
          focusActiveDocument()
        }
        return true
      }

      const destination =
        existingItem ?? createWorkbenchItemFromVaultFile(vaultFile as VaultTreeFile)
      const destinationForLoad = {
        ...destination,
        missing: Boolean(destination.missing && !vaultFile),
        autosavePaused: Boolean(destination.missing && !vaultFile)
      }
      const capturedId = currentState.activeId
      let capturedView: WorkbenchViewState | null = null
      let preparedLoad: PreparedWorkbenchDocument | null = null
      let committedEditor = false
      cacheActiveBuffer()
      onError(null)

      const result = await runWorkbenchControllerTransaction({
        coordinator: coordinatorRef.current,
        store: { getState: () => stateRef.current, commit: commitState },
        operation: existingItem ? 'activate' : 'open',
        targetId: destination.id,
        prepare: async (token) => {
          if (!(await saveActiveItem())) {
            return false
          }
          preparedLoad = await prepareItemLoad(destinationForLoad, () =>
            coordinatorRef.current.isCurrent(token)
          )
          if (!preparedLoad) {
            return false
          }
          return { value: preparedLoad }
        },
        captureLatest: () => {
          const latestState = stateRef.current
          const latestOrigin = capturedId
            ? latestState.items.find((candidate) => candidate.id === capturedId)
            : null
          capturedView =
            latestOrigin && latestState.activeId === capturedId
              ? captureCurrentViewState(latestOrigin, viewModeRef.current)
              : null
        },
        transition: (latestState, prepared) => {
          const latestOrigin = capturedId
            ? latestState.items.find((candidate) => candidate.id === capturedId)
            : null
          if (
            prepared.id !== destination.id ||
            (latestOrigin &&
              latestState.activeId === latestOrigin.id &&
              !isEditableItemBufferClean(latestOrigin))
          ) {
            return false
          }

          let nextState = latestState
          if (capturedId && capturedView) {
            nextState = captureWorkbenchViewState(nextState, capturedId, capturedView)
          }
          if (destination.missing && vaultFile) {
            nextState = markWorkbenchItemPresent(nextState, destination.id)
          }
          return openOrActivateWorkbenchItem(nextState, {
            ...destinationForLoad
          })
        },
        commit: (prepared, committedState) => {
          const committedItem = committedState.items.find((item) => item.id === destination.id)
          if (!committedItem) {
            releasePreparedWorkbenchDocument(prepared)
            return
          }

          commitItemLoad(prepared)
          preparedLoad = null
          restoreItemView(committedItem, options.focus !== false)
          committedEditor = true
        }
      })

      if (result.status !== 'committed') {
        if (preparedLoad) {
          releasePreparedWorkbenchDocument(preparedLoad)
        }
        reportTransactionFailure(result, onError)
        return false
      }

      if (!committedEditor) {
        onError('The opened file did not match the committed workbench item')
        return false
      }

      return true
    },
    [
      cacheActiveBuffer,
      cancelPendingNavigation,
      commitItemLoad,
      commitState,
      isEditableItemBufferClean,
      onError,
      prepareItemLoad,
      restoreItemView,
      saveActiveItem
    ]
  )

  const closeItemInternal = useCallback(
    async (relativePath: string, discardMissing: boolean): Promise<boolean> => {
      const currentState = stateRef.current
      const item = currentState.items.find((candidate) => candidate.id === relativePath)
      if (!item) {
        return false
      }

      if (discardMissing && (!item.missing || !item.dirty)) {
        setPendingMissingCloseId(null)
        return false
      }

      if (item.missing && item.dirty && !discardMissing) {
        setPendingMissingCloseId(item.id)
        return false
      }

      const wasActive = currentState.activeId === item.id
      const authorization = discardMissing ? 'discard_missing' : 'saved'
      const proposedState = closeWorkbenchItem(currentState, item.id, {
        activateOnClose: activateOnCloseRef.current,
        authorization
      })
      const destination = wasActive ? getActiveItem(proposedState) : null
      const capturedActiveId = currentState.activeId
      let capturedView: WorkbenchViewState | null = null
      let preparedDestination: PreparedWorkbenchDocument | null = null
      let committedEditor = false
      cacheActiveBuffer()
      onError(null)

      const result = await runWorkbenchControllerTransaction<PreparedWorkbenchDocument | null>({
        coordinator: coordinatorRef.current,
        store: { getState: () => stateRef.current, commit: commitState },
        operation: 'close',
        targetId: item.id,
        prepare: async (token) => {
          if (!discardMissing && !wasActive && item.dirty) {
            return false
          }
          if (
            !discardMissing &&
            wasActive &&
            (item.kind === 'note' || item.kind === 'text') &&
            !(await saveActiveItem())
          ) {
            return false
          }
          if (destination) {
            preparedDestination = await prepareItemLoad(destination, () =>
              coordinatorRef.current.isCurrent(token)
            )
            if (!preparedDestination) {
              return false
            }
          }
          return { value: preparedDestination }
        },
        captureLatest: () => {
          const latestState = stateRef.current
          const latestActiveItem = capturedActiveId
            ? latestState.items.find((candidate) => candidate.id === capturedActiveId)
            : null
          capturedView =
            latestActiveItem && latestState.activeId === capturedActiveId
              ? captureCurrentViewState(latestActiveItem, viewModeRef.current)
              : null
        },
        transition: (latestState, prepared) => {
          const stateWithLatestView =
            capturedActiveId && capturedView && latestState.activeId === capturedActiveId
              ? captureWorkbenchViewState(latestState, capturedActiveId, capturedView)
              : latestState

          return commitTransactionalWorkbenchClose(stateWithLatestView, {
            id: item.id,
            wasActive,
            discardMissing,
            activeBufferClean: isEditableItemBufferClean(item),
            preparedDestinationId: prepared?.id ?? null,
            activateOnClose: activateOnCloseRef.current
          })
        },
        commit: (prepared, committedState) => {
          setPendingMissingCloseId(null)
          bufferCacheRef.current.delete(item.id)

          const nextActiveItem = getActiveItem(committedState)
          if (wasActive && nextActiveItem) {
            if (!prepared) {
              return
            }
            commitItemLoad(prepared)
            preparedDestination = null
            restoreItemView(nextActiveItem, true)
          } else if (wasActive) {
            setActiveImagePreview(null)
            editorControllerRef.current.resetEditor()
            textEditorControllerRef.current.resetEditor()
            setViewMode('live')
            window.setTimeout(() => focusActiveDocument(), 0)
          }
          committedEditor = true
        }
      })

      if (result.status !== 'committed') {
        if (preparedDestination) {
          releasePreparedWorkbenchDocument(preparedDestination)
        }
        const latestItem = stateRef.current.items.find((candidate) => candidate.id === item.id)
        if (latestItem?.missing && latestItem.dirty) {
          setPendingMissingCloseId(latestItem.id)
        }
        reportTransactionFailure(result, onError)
        return false
      }

      if (!committedEditor) {
        onError('The next tab was not ready after closing the active item')
        return false
      }
      return true
    },
    [
      cacheActiveBuffer,
      commitItemLoad,
      commitState,
      isEditableItemBufferClean,
      onError,
      prepareItemLoad,
      restoreItemView,
      saveActiveItem,
      setViewMode
    ]
  )

  const closeItem = useCallback(
    (relativePath: string): Promise<boolean> => closeItemInternal(relativePath, false),
    [closeItemInternal]
  )

  const closeActiveItem = useCallback(async (): Promise<boolean> => {
    const intent = resolveCloseActiveIntent(stateRef.current, whenClosingWithNoTabsRef.current)

    if (intent.type === 'close_item') {
      return closeItem(intent.id)
    }

    if (intent.type === 'close_window') {
      try {
        await window.windowApi.close()
        return true
      } catch (closeError) {
        onError(formatError(closeError))
        return false
      }
    }

    return true
  }, [closeItem, onError])

  const confirmDiscardMissingClose = useCallback(async (): Promise<boolean> => {
    const pendingId = pendingMissingCloseId
    return pendingId ? closeItemInternal(pendingId, true) : false
  }, [closeItemInternal, pendingMissingCloseId])

  const cancelDiscardMissingClose = useCallback((): void => {
    setPendingMissingCloseId(null)
  }, [])

  const activateVisual = useCallback(
    async (direction: 1 | -1): Promise<boolean> => {
      const candidateState = activateVisualWorkbenchItem(stateRef.current, direction)
      return candidateState.activeId ? openOrActivate(candidateState.activeId) : false
    },
    [openOrActivate]
  )

  const reopenClosedItem = useCallback(async (): Promise<boolean> => {
    const availablePaths = new Set(
      vaultRef.current?.treeFiles.map((file) => file.relativePath) ?? []
    )
    const resolution = resolveReopenCandidate(stateRef.current, (path) => availablePaths.has(path))

    if (resolution.state !== stateRef.current) {
      commitState(resolution.state)
    }

    if (!resolution.candidateId) {
      if (resolution.skippedIds.length > 0) {
        showToast('Closed files no longer exist in this vault')
      }
      return false
    }

    const file = vaultRef.current?.treeFiles.find(
      (candidate) => candidate.relativePath === resolution.candidateId
    )
    if (!file) {
      return false
    }

    const opened = await openOrActivate(file.relativePath)
    if (opened) {
      commitState(reopenWorkbenchItem(stateRef.current, createWorkbenchItemFromVaultFile(file)))
    }
    return opened
  }, [commitState, openOrActivate, showToast])

  const reloadActiveItem = useCallback(async (): Promise<boolean> => {
    const activeItem = getActiveItem(stateRef.current)
    if (!activeItem || activeItem.missing) {
      return false
    }
    if (!isEditableItemBufferClean(activeItem)) {
      onError('Reload was cancelled because the active file has unsaved changes')
      return false
    }

    const capturedView = captureCurrentViewState(activeItem, viewModeRef.current)
    let preparedLoad: PreparedWorkbenchDocument | null = null
    const result = await runWorkbenchTransaction({
      coordinator: coordinatorRef.current,
      store: { getState: () => stateRef.current, commit: commitState },
      operation: 'activate',
      targetId: activeItem.id,
      prepare: async (token) => {
        preparedLoad = await prepareItemLoad(activeItem, () =>
          coordinatorRef.current.isCurrent(token)
        )
        return preparedLoad !== null
      },
      transition: (latestState) => {
        const latestActive = getActiveItem(latestState)
        if (
          !preparedLoad ||
          latestActive?.id !== activeItem.id ||
          !isEditableItemBufferClean(latestActive)
        ) {
          return false
        }
        return capturedView
          ? captureWorkbenchViewState(latestState, activeItem.id, capturedView)
          : latestState
      }
    })

    if (result.status !== 'committed' || !preparedLoad) {
      if (preparedLoad) {
        releasePreparedWorkbenchDocument(preparedLoad)
      }
      reportTransactionFailure(result, onError)
      return false
    }

    const reloadedItem = result.state.items.find((item) => item.id === activeItem.id)
    if (!reloadedItem) {
      return false
    }

    commitItemLoad(preparedLoad)
    restoreItemView(reloadedItem, true)
    return true
  }, [
    commitItemLoad,
    commitState,
    isEditableItemBufferClean,
    onError,
    prepareItemLoad,
    restoreItemView
  ])

  const beginMruSwitch = useCallback(
    (direction: 1 | -1 = 1): void => {
      commitState(
        stateRef.current.mruSwitch
          ? cycleMruSwitch(stateRef.current, direction)
          : startMruSwitch(stateRef.current, direction)
      )
    },
    [commitState]
  )

  const advanceMruSwitch = useCallback(
    (direction: 1 | -1): void => {
      commitState(cycleMruSwitch(stateRef.current, direction))
    },
    [commitState]
  )

  const abortMruSwitch = useCallback((): void => {
    commitState(cancelMruSwitch(stateRef.current))
    window.setTimeout(() => focusActiveDocument(), 0)
  }, [commitState])

  const finishMruSwitch = useCallback(async (): Promise<boolean> => {
    const targetId = getMruSwitchCommitTarget(stateRef.current)
    if (!targetId) {
      return false
    }

    const opened = await openOrActivate(targetId)
    if (!opened) {
      abortMruSwitch()
    }
    return opened
  }, [abortMruSwitch, openOrActivate])

  const prepareNoteMutation = useCallback(
    async (relativePath: string): Promise<boolean> => {
      cancelPendingNavigation()
      const item = stateRef.current.items.find((candidate) => candidate.id === relativePath)
      if (!item || item.kind !== 'note') {
        return !item
      }
      if (stateRef.current.activeId !== item.id) {
        return !item.dirty
      }
      cacheActiveBuffer()
      return saveActiveItem()
    },
    [cacheActiveBuffer, cancelPendingNavigation, saveActiveItem]
  )

  const commitNoteRename = useCallback(
    (fromRelativePath: string, toRelativePath: string): boolean => {
      const currentState = stateRef.current
      const captured = captureCurrentViewState(getActiveItem(currentState), viewModeRef.current)
      let preparedState = currentState
      if (currentState.activeId === fromRelativePath && captured) {
        preparedState = captureWorkbenchViewState(preparedState, fromRelativePath, captured)
      }
      const nextState = renameWorkbenchItem(preparedState, fromRelativePath, toRelativePath)
      if (nextState === preparedState) {
        return false
      }

      const cached = bufferCacheRef.current.get(fromRelativePath)
      if (cached) {
        bufferCacheRef.current.delete(fromRelativePath)
        bufferCacheRef.current.set(toRelativePath, cached)
      }
      editorControllerRef.current.renameSelectedFile(fromRelativePath, toRelativePath)
      commitState(nextState)
      return true
    },
    [commitState]
  )

  const commitNoteDelete = useCallback(
    async (relativePath: string): Promise<boolean> => {
      const currentState = stateRef.current
      const deletedItem = currentState.items.find((item) => item.id === relativePath)
      if (!deletedItem) {
        return true
      }
      const wasActive = currentState.activeId === relativePath
      const proposedState = deleteWorkbenchItem(
        currentState,
        relativePath,
        activateOnCloseRef.current
      )
      const destination = wasActive ? getActiveItem(proposedState) : null
      let preparedDestination: PreparedWorkbenchDocument | null = null

      const result = await runWorkbenchTransaction({
        coordinator: coordinatorRef.current,
        store: { getState: () => stateRef.current, commit: commitState },
        operation: 'delete',
        targetId: relativePath,
        prepare: async (token) => {
          if (!destination) {
            return true
          }
          preparedDestination = await prepareItemLoad(destination, () =>
            coordinatorRef.current.isCurrent(token)
          )
          return preparedDestination !== null
        },
        transition: (latestState) => {
          if (
            !latestState.items.some((item) => item.id === relativePath) ||
            (latestState.activeId === relativePath) !== wasActive
          ) {
            return false
          }

          const nextState = deleteWorkbenchItem(
            latestState,
            relativePath,
            activateOnCloseRef.current
          )
          const nextActiveItem = getActiveItem(nextState)
          if (
            nextState.items.some((item) => item.id === relativePath) ||
            (wasActive && nextActiveItem?.id !== preparedDestination?.id)
          ) {
            return false
          }
          return nextState
        }
      })

      if (result.status !== 'committed') {
        if (preparedDestination) {
          releasePreparedWorkbenchDocument(preparedDestination)
        }
        const retainedState = markWorkbenchItemMissing(stateRef.current, relativePath)
        commitState(retainedState)
        if (wasActive) {
          editorControllerRef.current.markCurrentFileMissing(relativePath, true)
        }
        onError('The note was moved to trash, but the next tab could not be loaded')
        return false
      }

      bufferCacheRef.current.delete(relativePath)
      const nextItem = getActiveItem(result.state)
      if (wasActive && nextItem && preparedDestination) {
        commitItemLoad(preparedDestination)
        restoreItemView(nextItem, true)
      } else if (wasActive) {
        setActiveImagePreview(null)
        editorControllerRef.current.resetEditor()
        textEditorControllerRef.current.resetEditor()
        window.setTimeout(() => focusActiveDocument(), 0)
      }
      return true
    },
    [commitItemLoad, commitState, onError, prepareItemLoad, restoreItemView]
  )

  const resetForVault = useCallback(
    (nextVault: VaultInfo | null = null): void => {
      coordinatorRef.current.invalidate()
      restoreViewRequestRef.current += 1
      vaultRef.current = nextVault
      bufferCacheRef.current.clear()
      imageCacheRef.current.dispose()
      setActiveImagePreview(null)
      editorControllerRef.current.cancelPendingLoad()
      textEditorControllerRef.current.cancelPendingLoad()
      editorControllerRef.current.resetEditor()
      textEditorControllerRef.current.resetEditor()
      setPendingMissingCloseId(null)
      setViewMode('live')
      commitState(resetWorkbenchState(stateRef.current))
    },
    [commitState, setViewMode]
  )

  useEffect(() => {
    const currentState = stateRef.current
    const activeItem = getActiveItem(currentState)
    if (!activeItem) {
      return
    }

    const dirty =
      activeItem.kind === 'note'
        ? editor.isDirty
        : activeItem.kind === 'text'
          ? textEditor.isDirty
          : false
    if (activeItem.dirty !== dirty) {
      commitState(setWorkbenchItemDirty(currentState, activeItem.id, dirty))
    }
  }, [commitState, editor.isDirty, textEditor.isDirty])

  useEffect(() => {
    const currentState = stateRef.current
    const activeItem = getActiveItem(currentState)
    if (activeItem?.kind !== 'note' || activeItem.viewState?.viewMode === viewMode) {
      return
    }

    commitState(captureWorkbenchViewState(currentState, activeItem.id, { viewMode }))
  }, [commitState, viewMode])

  useEffect(() => {
    if (!vault) {
      return
    }

    const availablePaths = new Set(vault.treeFiles.map((file) => file.relativePath))
    let nextState = stateRef.current

    for (const item of nextState.items) {
      const exists = availablePaths.has(item.relativePath)
      nextState = exists
        ? markWorkbenchItemPresent(nextState, item.id)
        : markWorkbenchItemMissing(nextState, item.id)
    }

    const activeItem = getActiveItem(nextState)
    if (activeItem) {
      const missing = !availablePaths.has(activeItem.relativePath)
      if (activeItem.kind === 'note') {
        editorControllerRef.current.markCurrentFileMissing(activeItem.relativePath, missing)
      } else if (activeItem.kind === 'text') {
        textEditorControllerRef.current.markCurrentFileMissing(activeItem.relativePath, missing)
      }
    }

    if (nextState !== stateRef.current) {
      cacheActiveBuffer()
      commitState(nextState)
    }
  }, [cacheActiveBuffer, commitState, vault])

  const activeItem = getActiveItem(state)
  const activeImageObjectUrl =
    activeItem?.kind === 'image' && activeImagePreview?.relativePath === activeItem.relativePath
      ? activeImagePreview.objectUrl
      : null
  const pendingMissingCloseItem = pendingMissingCloseId
    ? (state.items.find((item) => item.id === pendingMissingCloseId) ?? null)
    : null

  return {
    state,
    tabs: state.items,
    activePath: state.activeId,
    activeItem,
    activeImageObjectUrl,
    pendingMissingCloseItem,
    openOrActivate,
    closeItem,
    closeActiveItem,
    confirmDiscardMissingClose,
    cancelDiscardMissingClose,
    activateVisual,
    reopenClosedItem,
    reloadActiveItem,
    startMruSwitch: beginMruSwitch,
    cycleMruSwitch: advanceMruSwitch,
    commitMruSwitch: finishMruSwitch,
    cancelMruSwitch: abortMruSwitch,
    cancelPendingNavigation,
    saveActiveItem,
    prepareNoteMutation,
    commitNoteRename,
    commitNoteDelete,
    resetForVault
  }
}

function createWorkbenchItemFromVaultFile(file: VaultTreeFile): WorkbenchItem {
  return createWorkbenchItem({
    relativePath: file.relativePath,
    kind: classifyWorkbenchItem(file.relativePath)
  })
}

function classifyWorkbenchItem(relativePath: string): WorkbenchItemKind {
  if (isNotePath(relativePath)) {
    return 'note'
  }
  if (isEditableTextPath(relativePath)) {
    return 'text'
  }
  if (isPreviewableVaultImagePath(relativePath)) {
    return 'image'
  }
  return 'unsupported'
}

function getActiveItem(state: WorkbenchState): WorkbenchItem | null {
  return state.activeId ? (state.items.find((item) => item.id === state.activeId) ?? null) : null
}

function captureCurrentViewState(
  item: WorkbenchItem | null,
  viewMode: ViewMode
): WorkbenchViewState | null {
  if (!item) {
    return null
  }

  const editorSnapshot = captureActiveEditorView()
  const surface = getActiveDocumentScrollSurface()

  return {
    cursor: editorSnapshot?.head,
    selection: editorSnapshot
      ? { anchor: editorSnapshot.anchor, head: editorSnapshot.head }
      : undefined,
    scrollTop: editorSnapshot?.scrollTop ?? surface?.scrollTop ?? 0,
    scrollLeft: editorSnapshot?.scrollLeft ?? surface?.scrollLeft ?? 0,
    viewMode: item.kind === 'note' ? viewMode : undefined
  }
}

function getActiveDocumentScrollSurface(): HTMLElement | null {
  const documentSurface = document.querySelector<HTMLElement>('[data-document-surface="active"]')
  return (
    documentSurface?.querySelector<HTMLElement>('[data-workbench-scroll-surface="true"]') ??
    documentSurface
  )
}

function toEditorSnapshot(viewState: WorkbenchViewState | undefined): EditorViewSnapshot | null {
  if (!viewState?.selection) {
    return null
  }

  return {
    anchor: viewState.selection.anchor,
    head: viewState.selection.head,
    scrollTop: viewState.scrollTop ?? 0,
    scrollLeft: viewState.scrollLeft ?? 0
  }
}

function reportTransactionFailure(
  result: Awaited<ReturnType<typeof runWorkbenchTransaction>>,
  onError: (message: string | null) => void
): void {
  if (result.status !== 'failed' || !(result.error instanceof Error)) {
    return
  }

  if (
    result.error.message !== 'Workbench transaction preparation returned false' &&
    result.error.message !== 'Workbench transaction preparation was rejected'
  ) {
    onError(formatError(result.error))
  }
}
