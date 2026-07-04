import {
  Columns2,
  Eye,
  FilePlus,
  FileSearch,
  FolderOpen,
  Moon,
  Save,
  Search,
  Sparkles,
  Sun,
  Download,
  SquareCode,
  Trash2,
  ArrowDownUp
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MdxEditor, type EditorSelectionSnapshot, type RevealLineRequest } from '@/editor/MdxEditor'
import { CreateNoteDialog } from '@/explorer/CreateNoteDialog'
import { FileTree, type FileTreeSortMode } from '@/explorer/FileTree'
import { QuickSwitcher } from '@/explorer/QuickSwitcher'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { cn } from '@/lib/utils'
import { BacklinksPanel } from '@/panels/BacklinksPanel'
import { MdxPreview } from '@/preview/MdxPreview'
import { SearchPane } from '@/search/SearchPane'
import type { BacklinkResult, IndexedNoteSummary, VaultInfo } from '@/vault/types'

import { ExportDialog } from '@/export/ExportDialog'
import {
  AiSelectionActionPalette,
  type SelectionActionPalettePosition
} from '@/ai/panels/AiSelectionActionPalette'
import { AiSidePanel } from '@/ai/panels/AiSidePanel'
import type { SelectionRange } from '../../shared/ai'

type ViewMode = 'source' | 'split' | 'preview'

interface DeleteRequest {
  relativePath: string
}

interface ToastState {
  message: string
  variant: 'default' | 'destructive'
  key: number
}

function App(): React.JSX.Element {
  const { theme, resolvedTheme, toggle: toggleTheme } = useTheme()
  const [vault, setVault] = useState<VaultInfo | null>(null)
  const [indexNotes, setIndexNotes] = useState<IndexedNoteSummary[]>([])
  const [backlinksState, setBacklinksState] = useState<{
    relativePath: string | null
    backlinks: BacklinkResult[]
  }>({
    relativePath: null,
    backlinks: []
  })
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [aiPaletteOpen, setAiPaletteOpen] = useState(false)
  const [aiPalettePosition, setAiPalettePosition] = useState<SelectionActionPalettePosition | null>(
    null
  )
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [createNoteOpen, setCreateNoteOpen] = useState(false)
  const [editorSelection, setEditorSelection] = useState<EditorSelectionSnapshot | null>(null)
  const [revealLineRequest, setRevealLineRequest] = useState<RevealLineRequest | null>(null)
  const [indexRevision, setIndexRevision] = useState(0)
  const [isOpening, setIsOpening] = useState(false)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<FileTreeSortMode>('name')
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null)
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false)
  const [vaultOpsPending, setVaultOpsPending] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [trashCount, setTrashCount] = useState(0)

  const selectedPathRef = useRef(selectedPath)
  const contentRef = useRef(content)
  const savedContentRef = useRef(savedContent)
  const saveRequestRef = useRef(0)

  const isDirty = selectedPath !== null && content !== savedContent

  const refreshVaultSnapshot = useCallback(async () => {
    const [files, notes] = await Promise.all([window.vaultApi.listFiles(), window.indexApi.notes()])

    setVault((currentVault) => {
      if (!currentVault) {
        return currentVault
      }

      return {
        ...currentVault,
        files
      }
    })
    setIndexNotes(notes)
  }, [])

  useEffect(() => {
    selectedPathRef.current = selectedPath
  }, [selectedPath])

  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    savedContentRef.current = savedContent
  }, [savedContent])

  const saveCurrentFile = useCallback(async () => {
    const path = selectedPathRef.current
    const value = contentRef.current

    if (!path || value === savedContentRef.current) {
      return
    }

    const requestId = saveRequestRef.current + 1
    saveRequestRef.current = requestId
    setIsSaving(true)
    setError(null)

    try {
      await window.vaultApi.writeFile(path, value)

      if (selectedPathRef.current === path) {
        savedContentRef.current = value
        setSavedContent(value)
        setLastSavedAt(new Date())
      }
    } catch (saveError) {
      setError(formatError(saveError))
    } finally {
      if (saveRequestRef.current === requestId) {
        setIsSaving(false)
      }
    }
  }, [])

  const loadFile = useCallback(
    async (relativePath: string, saveBeforeLoad = true) => {
      if (saveBeforeLoad) {
        await saveCurrentFile()
      }

      setIsLoadingFile(true)
      setError(null)

      try {
        const fileContent = await window.vaultApi.readFile(relativePath)
        selectedPathRef.current = relativePath
        contentRef.current = fileContent
        savedContentRef.current = fileContent
        setSelectedPath(relativePath)
        setContent(fileContent)
        setSavedContent(fileContent)
        setLastSavedAt(null)
      } catch (loadError) {
        setError(formatError(loadError))
      } finally {
        setIsLoadingFile(false)
      }
    },
    [saveCurrentFile]
  )

  const createNote = useCallback(
    async (relativePath: string, content: string): Promise<void> => {
      await saveCurrentFile()
      const createdPath = await window.vaultApi.createFile(relativePath, content)
      await refreshVaultSnapshot()
      await loadFile(createdPath, false)
    },
    [loadFile, refreshVaultSnapshot, saveCurrentFile]
  )

  const showToast = useCallback(
    (message: string, variant: ToastState['variant'] = 'default'): void => {
      setToast({ message, variant, key: Date.now() })
    },
    []
  )

  // Auto-dismiss toast after a short delay.
  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => {
      window.clearTimeout(timer)
    }
  }, [toast])

  const refreshTrashCount = useCallback(async (): Promise<void> => {
    try {
      const entries = await window.vaultApi.listTrash()
      setTrashCount(entries.length)
    } catch {
      // Non-fatal: trash count is a UI nicety, not a hard requirement.
      setTrashCount(0)
    }
  }, [])

  const handleDelete = useCallback(
    async (relativePath: string): Promise<void> => {
      setVaultOpsPending(true)
      setError(null)
      try {
        await window.vaultApi.deleteFile(relativePath)
        if (selectedPathRef.current === relativePath) {
          selectedPathRef.current = null
          setSelectedPath(null)
          setContent('')
          setSavedContent('')
        }
        await refreshVaultSnapshot()
        await refreshTrashCount()
        showToast(`Moved "${deriveNoteTitle(relativePath)}" to trash`)
      } catch (deleteError) {
        setError(formatError(deleteError))
      } finally {
        setVaultOpsPending(false)
      }
    },
    [refreshTrashCount, refreshVaultSnapshot, showToast]
  )

  const handleRename = useCallback(
    async (fromRelativePath: string, toRelativePath: string): Promise<void> => {
      if (fromRelativePath === toRelativePath) {
        return
      }
      setVaultOpsPending(true)
      setError(null)
      try {
        const newPath = await window.vaultApi.renameFile(fromRelativePath, toRelativePath)
        // If we were editing the renamed note, switch to the new path so the
        // editor state (selection, save label) tracks the rename.
        if (selectedPathRef.current === fromRelativePath) {
          selectedPathRef.current = newPath
          setSelectedPath(newPath)
        }
        await refreshVaultSnapshot()
        showToast(`Renamed to "${deriveNoteTitle(newPath)}"`)
      } catch (renameError) {
        setError(formatError(renameError))
      } finally {
        setVaultOpsPending(false)
      }
    },
    [refreshVaultSnapshot, showToast]
  )

  const handleDuplicate = useCallback(
    async (relativePath: string): Promise<void> => {
      setVaultOpsPending(true)
      setError(null)
      try {
        const newPath = await window.vaultApi.duplicateFile(relativePath)
        await refreshVaultSnapshot()
        await loadFile(newPath, false)
        showToast(`Duplicated to "${deriveNoteTitle(newPath)}"`)
      } catch (duplicateError) {
        setError(formatError(duplicateError))
      } finally {
        setVaultOpsPending(false)
      }
    },
    [loadFile, refreshVaultSnapshot, showToast]
  )

  const handleRevealInExplorer = useCallback(
    async (relativePath: string): Promise<void> => {
      try {
        await window.vaultApi.revealInExplorer(relativePath)
      } catch (revealError) {
        setError(formatError(revealError))
      }
    },
    []
  )

  const handleCopyPath = useCallback(
    async (relativePath: string): Promise<void> => {
      try {
        const absolutePath = await window.vaultApi.resolveAbsolutePath(relativePath)
        await navigator.clipboard.writeText(absolutePath)
        showToast(`Copied ${absolutePath}`)
      } catch (copyError) {
        setError(formatError(copyError))
      }
    },
    [showToast]
  )

  const handleSaveImage = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const base64 = await fileToBase64(file)
        const relativePath = await window.vaultApi.saveAsset(file.name, base64)
        showToast(`Saved image to ${relativePath}`)
        return relativePath
      } catch (saveImageError) {
        setError(formatError(saveImageError))
        return null
      }
    },
    [showToast]
  )

  const handleEmptyTrash = useCallback(async (): Promise<void> => {
    setVaultOpsPending(true)
    setError(null)
    try {
      await window.vaultApi.emptyTrash()
      await refreshTrashCount()
      showToast('Trash emptied')
    } catch (emptyTrashError) {
      setError(formatError(emptyTrashError))
    } finally {
      setVaultOpsPending(false)
    }
  }, [refreshTrashCount, showToast])

  // Persist sort mode changes.
  const handleSortModeChange = useCallback((next: FileTreeSortMode): void => {
    setSortMode(next)
    void window.appApi.setFileTreeSort(next).catch(() => {
      // Persistence is best-effort — the in-memory sort still applies.
    })
  }, [])

  // Load persisted sort mode + initial trash count when a vault opens. When
  // no vault is open, refreshTrashCount naturally reports 0 — no separate
  // state write needed here. The microtask wrapper keeps setState out of the
  // synchronous effect body (and silences the cascading-render lint rule).
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

  // Refresh trash count whenever the index changes (so deletes from elsewhere
  // surface in the sidebar indicator). Skips the no-vault case — refreshTrash
  // would also no-op, but skipping avoids an unnecessary IPC round trip.
  useEffect(() => {
    if (!vault) {
      return
    }
    queueMicrotask(() => {
      void refreshTrashCount()
    })
  }, [indexRevision, vault, refreshTrashCount])

  // When the vault closes, drop the trash count back to zero (deferred to a
  // microtask to avoid the synchronous-setState-in-effect lint rule).
  const prevVaultRef = useRef(vault)
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
      setIndexRevision((current) => current + 1)
      setSelectedPath(null)
      setContent('')
      setSavedContent('')
      selectedPathRef.current = null
      contentRef.current = ''
      savedContentRef.current = ''

      const firstFile =
        openedVault.files.find((file) => file.relativePath.endsWith('/Welcome.mdx')) ??
        openedVault.files.find((file) => file.relativePath === 'Welcome.mdx') ??
        openedVault.files[0]

      if (firstFile) {
        await loadFile(firstFile.relativePath, false)
      }
    },
    [loadFile]
  )

  // Open via folder picker dialog.
  const openVault = useCallback(async (): Promise<void> => {
    await saveCurrentFile()
    setIsOpening(true)
    setError(null)

    try {
      const openedVault = await window.vaultApi.openVault()
      await openVaultInternal(openedVault)
    } catch (openError) {
      setError(formatError(openError))
    } finally {
      setIsOpening(false)
    }
  }, [openVaultInternal, saveCurrentFile])

  // Reopen a vault by absolute path without showing a dialog. Used on startup
  // to restore the last-opened vault. Fails silently to the empty state if the
  // path is missing or the vault cannot be opened (the backend already checks
  // existence; this guards against race/move-after-startup).
  const reopenVault = useCallback(
    async (path: string): Promise<boolean> => {
      setIsOpening(true)
      setError(null)

      try {
        const openedVault = await window.vaultApi.openVaultPath(path)
        await openVaultInternal(openedVault)
        return openedVault !== null
      } catch (reopenError) {
        // Don't surface as a hard error — fall through to empty state.
        console.warn('Failed to reopen last vault:', reopenError)
        return false
      } finally {
        setIsOpening(false)
      }
    },
    [openVaultInternal]
  )

  // On first mount, try to restore the last-opened vault silently.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

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

  useEffect(() => {
    if (!vault) {
      return
    }

    return window.indexApi.onDidChange(() => {
      setIndexRevision((current) => current + 1)

      void refreshVaultSnapshot().catch((refreshError: unknown) => {
        setError(formatError(refreshError))
      })
    })
  }, [refreshVaultSnapshot, vault])

  useEffect(() => {
    if (!selectedPath) {
      return
    }

    let cancelled = false

    void window.indexApi
      .backlinks(selectedPath)
      .then((nextBacklinks) => {
        if (!cancelled) {
          setBacklinksState({
            relativePath: selectedPath,
            backlinks: nextBacklinks
          })
        }
      })
      .catch((backlinksError: unknown) => {
        if (!cancelled) {
          setBacklinksState({
            relativePath: selectedPath,
            backlinks: []
          })
          setError(formatError(backlinksError))
        }
      })

    return () => {
      cancelled = true
    }
  }, [indexRevision, selectedPath])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase()

      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault()
        void saveCurrentFile()
        return
      }

      if ((event.ctrlKey || event.metaKey) && key === 'p') {
        event.preventDefault()
        setQuickSwitcherOpen(true)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'v') {
        event.preventDefault()
        setViewMode((current) =>
          current === 'source' ? 'split' : current === 'split' ? 'preview' : 'source'
        )
      }

      if ((event.ctrlKey || event.metaKey) && key === 'n') {
        event.preventDefault()
        setCreateNoteOpen(true)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'f') {
        event.preventDefault()
        setSearchOpen(true)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'a') {
        event.preventDefault()
        setAiPanelOpen((current) => !current)
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'e') {
        event.preventDefault()
        if (selectedPathRef.current) {
          setExportDialogOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [saveCurrentFile])

  const navigateToNote = useCallback(
    (relativePath: string) => {
      void loadFile(relativePath)
    },
    [loadFile]
  )

  const revealEditorLine = useCallback((line: number) => {
    setRevealLineRequest({
      line,
      requestId: Date.now()
    })
  }, [])

  const handleEditorSelectionChange = useCallback((snapshot: EditorSelectionSnapshot) => {
    setEditorSelection(snapshot)
    // Auto-close the floating palette when the selection is cleared.
    if (!snapshot.hasSelection) {
      setAiPaletteOpen(false)
    }
  }, [])

  const openAiPalette = useCallback(() => {
    if (!editorSelection?.hasSelection) {
      return
    }
    // Place the palette at a sensible spot near the top of the editor pane.
    // A more sophisticated impl would query CodeMirror coords, but for now
    // a top-aligned anchor inside the editor wrapper is enough.
    setAiPalettePosition({ top: 56, left: 320 })
    setAiPaletteOpen(true)
  }, [editorSelection])

  const handleAiActionPicked = useCallback((..._args: [string, string]) => {
    void _args
    setAiPaletteOpen(false)
    setAiPanelOpen(true)
  }, [])

  const selectionForAssistant: SelectionRange | null = useMemo(() => {
    if (!editorSelection || !editorSelection.hasSelection) {
      return null
    }

    return {
      startLine: editorSelection.startLine,
      startColumn: editorSelection.startColumn,
      endLine: editorSelection.endLine,
      endColumn: editorSelection.endColumn,
      text: editorSelection.text
    }
  }, [editorSelection])

  const saveLabel = getSaveLabel({
    hasFile: selectedPath !== null,
    isDirty,
    isSaving,
    lastSavedAt
  })
  const wordCount = useMemo(() => computeWordCount(content), [content])
  const backlinks = backlinksState.relativePath === selectedPath ? backlinksState.backlinks : []
  const showEditor = viewMode !== 'preview'
  const showPreview = viewMode !== 'source'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="text-[15px] font-semibold tracking-tight">
            mdx-vault<span className="text-[var(--viridian)]">.</span>
          </div>
          {vault ? (
            <>
              <span className="text-muted-foreground/40">/</span>
              <span className="truncate text-[13px] text-muted-foreground">{vault.name}</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden text-xs text-muted-foreground sm:block">{saveLabel}</div>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            title="Open note"
            aria-label="Open note"
            disabled={!vault}
            onClick={() => setQuickSwitcherOpen(true)}
          >
            <FileSearch className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            title="Search notes"
            aria-label="Search notes"
            disabled={!vault}
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!selectedPath || isSaving || !isDirty}
            onClick={() => void saveCurrentFile()}
          >
            <Save className="size-4" aria-hidden="true" />
            Save
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            title="Export note (Ctrl+Shift+E)"
            aria-label="Export note"
            disabled={!selectedPath}
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={aiPanelOpen ? 'default' : 'outline'}
            title="AI assistant (Ctrl+Shift+A)"
            aria-label="Toggle AI assistant"
            aria-pressed={aiPanelOpen}
            disabled={!vault}
            onClick={() => setAiPanelOpen((current) => !current)}
          >
            <Sparkles className="size-4" aria-hidden="true" />
          </Button>
          <ViewModeToggle value={viewMode} onChange={setViewMode} disabled={!selectedPath} />
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            title={
              theme === 'system'
                ? `Theme: follow system (currently ${resolvedTheme})`
                : `Theme: ${theme}`
            }
            aria-label="Toggle dark mode"
            onClick={() => void toggleTheme()}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
          </Button>
          <Button type="button" size="sm" onClick={() => void openVault()} disabled={isOpening}>
            <FolderOpen className="size-4" aria-hidden="true" />
            {isOpening ? 'Opening' : 'Open vault'}
          </Button>
        </div>
      </header>

      {error ? (
        <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <main
        className={cn(
          'grid min-h-0 flex-1 overflow-hidden',
          gridTemplateColumns(viewMode, aiPanelOpen)
        )}
      >
        <aside className="min-h-0 min-w-0 border-r bg-sidebar">
          <div className="flex h-9 items-center justify-between border-b px-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Vault
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                title="New note"
                aria-label="New note"
                disabled={!vault}
                onClick={() => setCreateNoteOpen(true)}
              >
                <FilePlus className="size-3.5" aria-hidden="true" />
              </Button>
              <SortMenu sortMode={sortMode} onChange={handleSortModeChange} disabled={!vault} />
              <Button
                type="button"
                size="icon-sm"
                variant={trashCount > 0 ? 'outline' : 'ghost'}
                title={
                  trashCount > 0
                    ? `Trash (${trashCount} item${trashCount === 1 ? '' : 's'})`
                    : 'Trash is empty'
                }
                aria-label="Trash"
                disabled={!vault || trashCount === 0}
                onClick={() => setEmptyTrashOpen(true)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {trashCount > 0 ? (
                  <span className="ml-1 text-[11px] tabular-nums">{trashCount}</span>
                ) : null}
              </Button>
              <div className="text-[11px] tabular-nums text-muted-foreground/60">
                {vault?.files.length ?? 0}
              </div>
            </div>
          </div>
          <div className="h-[calc(100%-2.5rem)] overflow-auto">
            {vault ? (
              <FileTree
                files={vault.files}
                notes={indexNotes}
                selectedPath={selectedPath}
                sortMode={sortMode}
                onSelectFile={(relativePath) => void loadFile(relativePath)}
                onDeleteFile={(relativePath) => setDeleteRequest({ relativePath })}
                onRenameFile={(fromRelativePath, toRelativePath) =>
                  void handleRename(fromRelativePath, toRelativePath)
                }
                onDuplicateFile={(relativePath) => void handleDuplicate(relativePath)}
                onRevealInExplorer={(relativePath) => void handleRevealInExplorer(relativePath)}
                onCopyPath={(relativePath) => void handleCopyPath(relativePath)}
              />
            ) : (
              <EmptyState
                icon={<FolderOpen className="size-5" aria-hidden="true" />}
                title="No vault open"
                action={
                  <Button type="button" size="sm" onClick={() => void openVault()}>
                    <FolderOpen className="size-4" aria-hidden="true" />
                    Open vault
                  </Button>
                }
              />
            )}
          </div>
        </aside>

        {showEditor ? (
          <section className="min-h-0 min-w-0 border-r bg-card/50">
            <div className="flex h-9 items-center justify-between border-b px-4">
              <div className="min-w-0 truncate text-[13px] font-medium tracking-tight">
                {selectedPath ?? 'No file selected'}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[11px] tabular-nums text-muted-foreground/70">
                {selectedPath ? (
                  <span title="Word / character count and estimated reading time">
                    {wordCount.words} words · {wordCount.chars} chars · {wordCount.readingMinutes}{' '}
                    min read
                  </span>
                ) : null}
                <span>{isLoadingFile ? 'Loading' : saveLabel}</span>
              </div>
            </div>
            <div className="relative h-[calc(100%-2.25rem)] min-h-0">
              {selectedPath ? (
                isLoadingFile ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Loading file.
                  </div>
                ) : (
                  <>
                    <MdxEditor
                      value={content}
                      onChange={setContent}
                      notes={indexNotes}
                      revealLineRequest={revealLineRequest}
                      onSelectionChange={handleEditorSelectionChange}
                      onSaveImage={handleSaveImage}
                    />
                    <AiSelectionActionPalette
                      open={aiPaletteOpen}
                      position={aiPalettePosition}
                      selectedText={editorSelection?.text ?? ''}
                      hasSelection={editorSelection?.hasSelection ?? false}
                      onClose={() => setAiPaletteOpen(false)}
                      onPickAction={handleAiActionPicked}
                    />
                  </>
                )
              ) : (
                <EmptyState
                  icon={<Save className="size-5" aria-hidden="true" />}
                  title="Select a note"
                  action={null}
                />
              )}
            </div>
          </section>
        ) : null}

        {showPreview ? (
          <aside className="min-h-0 min-w-0 bg-card/30">
            <div className="flex h-9 items-center border-b px-4">
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Preview
              </span>
            </div>
            <div className="grid h-[calc(100%-2.25rem)] min-h-0 grid-rows-[minmax(0,1fr)_180px]">
              <div className="min-h-0 overflow-hidden">
                <MdxPreview
                  source={content}
                  selectedPath={selectedPath}
                  notes={indexNotes}
                  onNavigate={navigateToNote}
                  onRevealLine={revealEditorLine}
                />
              </div>
              <div className="min-h-0 overflow-hidden border-t bg-muted/10">
                <BacklinksPanel
                  backlinks={backlinks}
                  selectedPath={selectedPath}
                  onSelectNote={navigateToNote}
                />
              </div>
            </div>
          </aside>
        ) : null}

        {aiPanelOpen ? (
          <aside className="min-h-0 min-w-0 border-l bg-card/30">
            <AiSidePanel
              noteRelativePath={selectedPath}
              noteTitle={selectedPath ? deriveNoteTitle(selectedPath) : 'No note'}
              noteContent={content}
              selection={selectionForAssistant}
              backlinks={backlinks.map((entry) => ({
                relativePath: entry.source.relativePath,
                display: entry.display
              }))}
              onWriteFile={async (relativePath, value) => {
                await saveCurrentFile()
                await window.vaultApi.writeFile(relativePath, value)
                if (relativePath === selectedPathRef.current) {
                  savedContentRef.current = value
                  setSavedContent(value)
                  setLastSavedAt(new Date())
                  setContent(value)
                  contentRef.current = value
                }
              }}
              onRequestActionPalette={openAiPalette}
            />
          </aside>
        ) : null}
      </main>

      <QuickSwitcher
        open={quickSwitcherOpen}
        notes={indexNotes}
        onOpenChange={setQuickSwitcherOpen}
        onSelectNote={navigateToNote}
      />
      <SearchPane open={searchOpen} onOpenChange={setSearchOpen} onSelectNote={navigateToNote} />
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        noteRelativePath={selectedPath}
        noteTitle={selectedPath ? deriveNoteTitle(selectedPath) : ''}
      />
      <CreateNoteDialog
        open={createNoteOpen}
        onOpenChange={setCreateNoteOpen}
        onCreate={createNote}
      />
      <ConfirmDialog
        open={deleteRequest !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteRequest(null)
          }
        }}
        title={`Delete "${deleteRequest ? deriveNoteTitle(deleteRequest.relativePath) : ''}"?`}
        description={
          <>
            The note will be moved to{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{'.trash/'}</code>. You can
            recover it from there with your file manager, or use “Empty trash” to remove it
            permanently.
          </>
        }
        confirmLabel="Move to trash"
        destructive
        isPending={vaultOpsPending}
        onConfirm={() => {
          if (deleteRequest) {
            void handleDelete(deleteRequest.relativePath)
          }
        }}
      />
      <ConfirmDialog
        open={emptyTrashOpen}
        onOpenChange={setEmptyTrashOpen}
        title="Empty trash?"
        description={
          <>
            This permanently deletes{' '}
            <strong className="text-foreground">
              {trashCount} item{trashCount === 1 ? '' : 's'}
            </strong>{' '}
            from <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{'.trash/'}</code>. This
            cannot be undone.
          </>
        }
        confirmLabel="Empty trash"
        destructive
        isPending={vaultOpsPending}
        onConfirm={() => void handleEmptyTrash()}
      />
      {toast ? (
        <ToastView key={toast.key} message={toast.message} variant={toast.variant} />
      ) : null}
    </div>
  )
}

function SortMenu({
  sortMode,
  onChange,
  disabled
}: {
  sortMode: FileTreeSortMode
  onChange: (mode: FileTreeSortMode) => void
  disabled?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const options: Array<{ mode: FileTreeSortMode; label: string }> = [
    { mode: 'name', label: 'Name (A→Z)' },
    { mode: 'modified-desc', label: 'Modified (newest)' },
    { mode: 'created-desc', label: 'Created (newest)*' }
  ]

  return (
    <div className="relative">
      <Button
        type="button"
        size="icon-sm"
        variant={open ? 'outline' : 'ghost'}
        title={`Sort: ${options.find((option) => option.mode === sortMode)?.label ?? 'Name'}`}
        aria-label="Sort files"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => {
          // Defer to allow click events on menu items to fire first.
          window.setTimeout(() => setOpen(false), 150)
        }}
      >
        <ArrowDownUp className="size-3.5" aria-hidden="true" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-1 min-w-[180px] overflow-hidden rounded-md border bg-popover p-1 text-[13px] text-popover-foreground shadow-md">
          {options.map((option) => (
            <button
              key={option.mode}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                onChange(option.mode)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-accent',
                sortMode === option.mode && 'bg-accent/60 font-medium'
              )}
            >
              <span>{option.label}</span>
              {sortMode === option.mode ? <span className="text-[var(--viridian)]">✓</span> : null}
            </button>
          ))}
          <p className="px-2 pt-1 text-[10px] text-muted-foreground">
            *Created time is not yet tracked; falls back to Name.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function ToastView({
  message,
  variant
}: {
  message: string
  variant: ToastState['variant']
}): React.JSX.Element {
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border px-3 py-1.5 text-[13px] shadow-md',
        variant === 'destructive'
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-popover text-popover-foreground'
      )}
    >
      {message}
    </div>
  )
}

function ViewModeToggle({
  value,
  onChange,
  disabled
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  disabled?: boolean
}): React.JSX.Element {
  const modes: Array<{ mode: ViewMode; label: string; icon: React.ReactNode }> = [
    {
      mode: 'source',
      label: 'Source',
      icon: <SquareCode className="size-3.5" aria-hidden="true" />
    },
    { mode: 'split', label: 'Split', icon: <Columns2 className="size-3.5" aria-hidden="true" /> },
    { mode: 'preview', label: 'Preview', icon: <Eye className="size-3.5" aria-hidden="true" /> }
  ]

  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5"
    >
      {modes.map(({ mode, label, icon }) => {
        const isActive = value === mode
        return (
          <button
            key={mode}
            type="button"
            title={`${label} view`}
            aria-label={`${label} view`}
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={cn(
              'flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  action
}: {
  icon: React.ReactNode
  title: string
  action: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border bg-card text-muted-foreground shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        <p className="mt-1 text-[13px] text-muted-foreground/60">
          Open a vault folder to start writing.
        </p>
      </div>
      {action}
    </div>
  )
}

function gridTemplateColumns(viewMode: ViewMode, aiPanelOpen: boolean): string {
  const showEditor = viewMode !== 'preview'
  const showPreview = viewMode !== 'source'

  // AI panel always adds a 360px column at the end.
  if (showEditor && showPreview && aiPanelOpen) {
    return 'grid-cols-[280px_minmax(0,1fr)_minmax(340px,0.9fr)_360px]'
  }
  if ((showEditor || showPreview) && aiPanelOpen) {
    return 'grid-cols-[280px_minmax(0,1fr)_360px]'
  }
  if (showEditor && showPreview) {
    return 'grid-cols-[280px_minmax(0,1fr)_minmax(340px,0.9fr)]'
  }
  // Only one pane (source-only or preview-only).
  return 'grid-cols-[280px_minmax(0,1fr)]'
}

function deriveNoteTitle(relativePath: string): string {
  const segments = relativePath.split('/')
  const last = segments[segments.length - 1] ?? relativePath
  return last.replace(/\.(md|mdx)$/i, '')
}

function getSaveLabel({
  hasFile,
  isDirty,
  isSaving,
  lastSavedAt
}: {
  hasFile: boolean
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
}): string {
  if (!hasFile) {
    return 'No file'
  }

  if (isSaving) {
    return 'Saving'
  }

  if (isDirty) {
    return 'Unsaved'
  }

  if (lastSavedAt) {
    return `Saved ${lastSavedAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })}`
  }

  return 'Saved'
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

interface WordCount {
  words: number
  chars: number
  readingMinutes: number
}

/**
 * Read a File as a base64 string (no data: prefix). The main process decodes
 * this back to bytes via Buffer.from(base64, 'base64'). Using base64 instead
 * of passing ArrayBuffer through the context bridge avoids structuredClone
 * overhead and matches what the preload IPC schema expects.
 */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[])
  }
  return btoa(binary)
}

const WORDS_PER_MINUTE = 200

/**
 * Compute word / character count + estimated reading time for the editor
 * status bar. Strips common Markdown syntax (frontmatter, code fences,
 * heading/list markers, wikilink brackets) so the count reflects what a reader
 * would see — not the raw source. Reading time uses the standard 200 wpm.
 */
function computeWordCount(value: string): WordCount {
  if (!value) {
    return { words: 0, chars: 0, readingMinutes: 0 }
  }

  // Drop YAML frontmatter block entirely.
  const withoutFrontmatter = value.replace(/^---\n[\s\S]*?\n---\n?/, '')

  // Strip fenced code blocks (treat them as a single chunk per block to avoid
  // counting code identifiers as words).
  const withoutCodeFences = withoutFrontmatter.replace(/```[\s\S]*?```/g, ' ')

  // Inline code, MDX/JSX tags, images, links → keep the link text but drop the
  // markup. `[label](url)` → `label`; `![alt](src)` → `alt`; `<Foo bar />` → ''.
  const stripped = withoutCodeFences
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+\/?>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => alt as string)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, (_, label) => label as string)
    .replace(/\[\[([^\]]*)\]\]/g, (_, label) => label as string)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~]/g, '')

  const words = stripped.split(/\s+/).filter((word) => word.length > 0).length
  const chars = withoutFrontmatter.length
  const readingMinutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))

  return { words, chars, readingMinutes }
}

export default App
