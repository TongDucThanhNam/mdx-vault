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
  ArrowDownUp,
  ListTree,
  Hash,
  Link2,
  Command
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CommandPalette } from '@/commands/CommandPalette'
import type { CommandAction } from '@/commands/actions'
import { MdxEditor, type EditorSelectionSnapshot, type RevealLineRequest } from '@/editor/MdxEditor'
import { CreateNoteDialog } from '@/explorer/CreateNoteDialog'
import { FileTree, type FileTreeSortMode } from '@/explorer/FileTree'
import { QuickSwitcher } from '@/explorer/QuickSwitcher'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { cn } from '@/lib/utils'
import { BacklinksPanel } from '@/panels/BacklinksPanel'
import { OutlinePanel } from '@/panels/OutlinePanel'
import { TagsPanel } from '@/panels/TagsPanel'
import { MdxPreview } from '@/preview/MdxPreview'
import { SearchPane } from '@/search/SearchPane'
import type {
  BacklinkResult,
  IndexedNoteSummary,
  NoteHeadingResult,
  TagSummary,
  VaultInfo
} from '@/vault/types'

import { ExportDialog } from '@/export/ExportDialog'
import {
  AiSelectionActionPalette,
  type SelectionActionPalettePosition
} from '@/ai/panels/AiSelectionActionPalette'
import { AiSidePanel } from '@/ai/panels/AiSidePanel'
import type { SelectionRange } from '../../shared/ai'

type ViewMode = 'source' | 'split' | 'preview'
type NavigationPanel = 'outline' | 'tags' | 'backlinks'

interface DeleteRequest {
  relativePath: string
}

interface PreviewHeadingRequest {
  position: number
  requestId: number
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
  const [outlineState, setOutlineState] = useState<{
    relativePath: string | null
    headings: NoteHeadingResult[]
  }>({
    relativePath: null,
    headings: []
  })
  const [tags, setTags] = useState<TagSummary[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [taggedNotes, setTaggedNotes] = useState<IndexedNoteSummary[]>([])
  const [isLoadingTaggedNotes, setIsLoadingTaggedNotes] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [navigationPanel, setNavigationPanel] = useState<NavigationPanel>('outline')
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
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
  const [previewHeadingRequest, setPreviewHeadingRequest] = useState<PreviewHeadingRequest | null>(
    null
  )
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

  const openDailyNote = useCallback(async (): Promise<void> => {
    if (!vault) {
      return
    }

    await saveCurrentFile()
    setError(null)

    try {
      const date = formatLocalDate(new Date())
      const relativePath = `journal/${date}.mdx`

      if (await window.vaultApi.fileExists(relativePath)) {
        await loadFile(relativePath, false)
        showToast(`Opened ${relativePath}`)
        return
      }

      const templatePath = 'templates/daily.mdx'
      const content = (await window.vaultApi.fileExists(templatePath))
        ? await window.vaultApi.renderTemplate(templatePath, date)
        : buildDailyNoteScaffold(date)
      const createdPath = await window.vaultApi.createFile(relativePath, content)

      await refreshVaultSnapshot()
      await loadFile(createdPath, false)
      showToast(`Created ${createdPath}`)
    } catch (dailyNoteError) {
      setError(formatError(dailyNoteError))
    }
  }, [loadFile, refreshVaultSnapshot, saveCurrentFile, showToast, vault])

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

  const handleRevealInExplorer = useCallback(async (relativePath: string): Promise<void> => {
    try {
      await window.vaultApi.revealInExplorer(relativePath)
    } catch (revealError) {
      setError(formatError(revealError))
    }
  }, [])

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
    if (!selectedPath) {
      queueMicrotask(() => {
        setOutlineState({
          relativePath: null,
          headings: []
        })
      })
      return
    }

    let cancelled = false

    void window.indexApi
      .headingsOfNote(selectedPath)
      .then((headings) => {
        if (!cancelled) {
          setOutlineState({
            relativePath: selectedPath,
            headings
          })
        }
      })
      .catch((outlineError: unknown) => {
        if (!cancelled) {
          setOutlineState({
            relativePath: selectedPath,
            headings: []
          })
          setError(formatError(outlineError))
        }
      })

    return () => {
      cancelled = true
    }
  }, [indexRevision, selectedPath])

  useEffect(() => {
    if (!vault) {
      queueMicrotask(() => {
        setTags([])
        setSelectedTag(null)
        setTaggedNotes([])
      })
      return
    }

    let cancelled = false

    void window.indexApi
      .tags()
      .then((nextTags) => {
        if (cancelled) {
          return
        }

        setTags(nextTags)
        setSelectedTag((currentTag) =>
          currentTag && nextTags.some((tag) => tag.tag === currentTag) ? currentTag : null
        )
      })
      .catch((tagsError: unknown) => {
        if (!cancelled) {
          setTags([])
          setError(formatError(tagsError))
        }
      })

    return () => {
      cancelled = true
    }
  }, [indexRevision, vault])

  useEffect(() => {
    if (!selectedTag) {
      queueMicrotask(() => {
        setTaggedNotes([])
        setIsLoadingTaggedNotes(false)
      })
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoadingTaggedNotes(true)
      }
    })

    void window.indexApi
      .notesByTag(selectedTag)
      .then((notes) => {
        if (!cancelled) {
          setTaggedNotes(notes)
        }
      })
      .catch((tagNotesError: unknown) => {
        if (!cancelled) {
          setTaggedNotes([])
          setError(formatError(tagNotesError))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTaggedNotes(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [indexRevision, selectedTag])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase()

      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault()
        void saveCurrentFile()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'p') {
        event.preventDefault()
        setCommandPaletteOpen(true)
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

  const revealHeading = useCallback(
    (heading: NoteHeadingResult) => {
      const editorLine = findHeadingLine(contentRef.current, heading.position)

      if (editorLine !== null) {
        revealEditorLine(editorLine)
      }

      setPreviewHeadingRequest({
        position: heading.position,
        requestId: Date.now()
      })
    },
    [revealEditorLine]
  )

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
  const outlineHeadings = outlineState.relativePath === selectedPath ? outlineState.headings : []
  const showEditor = viewMode !== 'preview'
  const showPreview = viewMode !== 'source'
  const commandActions = useMemo<CommandAction[]>(
    () => [
      {
        id: 'note.new',
        title: 'New note',
        description: 'Create a blank MDX note.',
        category: 'Notes',
        keywords: ['create', 'file'],
        disabled: vault === null,
        run: () => setCreateNoteOpen(true)
      },
      {
        id: 'note.new-template',
        title: 'New note from template',
        description: 'Create a note and choose a vault template.',
        category: 'Notes',
        keywords: ['insert', 'template'],
        disabled: vault === null,
        run: () => setCreateNoteOpen(true)
      },
      {
        id: 'note.daily',
        title: "Open today's daily note",
        description: 'Open or create the journal note for today.',
        category: 'Notes',
        keywords: ['journal', 'today'],
        disabled: vault === null,
        run: openDailyNote
      },
      {
        id: 'note.open',
        title: 'Open note',
        description: 'Jump to a note in the current vault.',
        category: 'Navigation',
        keywords: ['quick switcher'],
        disabled: vault === null,
        run: () => setQuickSwitcherOpen(true)
      },
      {
        id: 'note.search',
        title: 'Search notes',
        description: 'Search indexed note content.',
        category: 'Navigation',
        keywords: ['find'],
        disabled: vault === null,
        run: () => setSearchOpen(true)
      },
      {
        id: 'view.source',
        title: 'Source view',
        description: 'Show the MDX editor only.',
        category: 'View',
        keywords: ['editor'],
        disabled: selectedPath === null,
        run: () => setViewMode('source')
      },
      {
        id: 'view.split',
        title: 'Split view',
        description: 'Show editor and preview together.',
        category: 'View',
        keywords: ['editor', 'preview'],
        disabled: selectedPath === null,
        run: () => setViewMode('split')
      },
      {
        id: 'view.preview',
        title: 'Preview view',
        description: 'Show the rendered MDX preview only.',
        category: 'View',
        keywords: ['rendered'],
        disabled: selectedPath === null,
        run: () => setViewMode('preview')
      },
      {
        id: 'note.export',
        title: 'Export current note',
        description: 'Open export options for the selected note.',
        category: 'Notes',
        keywords: ['static', 'html', 'snapshot'],
        disabled: selectedPath === null,
        run: () => setExportDialogOpen(true)
      },
      {
        id: 'ai.toggle',
        title: 'Toggle AI assistant',
        description: 'Show or hide the assistant panel.',
        category: 'AI',
        keywords: ['assistant'],
        disabled: vault === null,
        run: () => setAiPanelOpen((current) => !current)
      },
      {
        id: 'theme.toggle',
        title: 'Toggle theme',
        description: 'Switch between light and dark appearance.',
        category: 'App',
        keywords: ['dark', 'light'],
        run: toggleTheme
      },
      {
        id: 'vault.open',
        title: 'Open vault',
        description: 'Choose a vault folder from disk.',
        category: 'Vault',
        keywords: ['folder', 'workspace'],
        run: openVault
      },
      {
        id: 'vault.empty-trash',
        title: 'Empty trash',
        description: 'Permanently remove notes currently in trash.',
        category: 'Vault',
        keywords: ['delete', 'remove'],
        disabled: vault === null || trashCount === 0,
        run: () => setEmptyTrashOpen(true)
      }
    ],
    [openDailyNote, openVault, selectedPath, toggleTheme, trashCount, vault]
  )

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 flex h-11 shrink-0 items-center justify-between border-b-2 border-foreground bg-background px-4 text-foreground">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="font-mono text-[13px] font-bold uppercase tracking-[0.15em] text-foreground">
            mdx-vault<span className="text-[var(--editorial-red)]">.</span>
          </div>
          {vault ? (
            <>
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
                /
              </span>
              <span className="truncate font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {vault.name}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:block">
            {saveLabel}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
            title="Command palette"
            aria-label="Command palette"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Command className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
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
            variant="ghost"
            className="text-muted-foreground"
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
            variant="ghost"
            className="border-2 border-foreground text-foreground"
            disabled={!selectedPath || isSaving || !isDirty}
            onClick={() => void saveCurrentFile()}
          >
            <Save className="size-4" aria-hidden="true" />
            Save
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground"
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
            variant={aiPanelOpen ? 'default' : 'ghost'}
            className={
              aiPanelOpen
                ? 'bg-[var(--editorial-red)] text-white hover:bg-[var(--editorial-red)]/90'
                : 'text-muted-foreground'
            }
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
            variant="ghost"
            className="text-muted-foreground"
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
          <Button
            type="button"
            size="sm"
            className="hover:bg-[var(--editorial-red)] hover:text-white"
            onClick={() => void openVault()}
            disabled={isOpening}
          >
            <FolderOpen className="size-4" aria-hidden="true" />
            {isOpening ? 'Opening' : 'Open vault'}
          </Button>
        </div>
      </header>

      {error ? (
        <div className="border-b-2 border-destructive bg-destructive/10 px-4 py-2 font-mono text-[12px] font-bold uppercase tracking-wider text-destructive">
          {error}
        </div>
      ) : null}

      <main
        className={cn(
          'grid min-h-0 flex-1 overflow-hidden',
          gridTemplateColumns(viewMode, aiPanelOpen)
        )}
      >
        <aside className="min-h-0 min-w-0 border-r-2 border-foreground bg-sidebar">
          <div className="flex h-9 items-center justify-between border-b-2 border-foreground px-3">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
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
          <section className="min-h-0 min-w-0 border-r-2 border-foreground bg-card/50">
            <div className="flex h-9 items-center justify-between border-b-2 border-foreground px-4">
              <div className="min-w-0 truncate font-mono text-[12px] font-medium tracking-tight">
                {selectedPath ?? 'No file selected'}
              </div>
              <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] tabular-nums text-muted-foreground">
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
          <aside className="min-h-0 min-w-0 bg-background">
            <div className="flex h-9 items-center justify-between border-b-2 border-foreground bg-[var(--paper-dark)] px-4">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Preview
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant={navigationPanel === 'outline' ? 'outline' : 'ghost'}
                  title="Outline"
                  aria-label="Outline"
                  onClick={() => setNavigationPanel('outline')}
                >
                  <ListTree className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={navigationPanel === 'tags' ? 'outline' : 'ghost'}
                  title="Tags"
                  aria-label="Tags"
                  onClick={() => setNavigationPanel('tags')}
                >
                  <Hash className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={navigationPanel === 'backlinks' ? 'outline' : 'ghost'}
                  title="Backlinks"
                  aria-label="Backlinks"
                  onClick={() => setNavigationPanel('backlinks')}
                >
                  <Link2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="grid h-[calc(100%-2.25rem)] min-h-0 grid-rows-[minmax(0,1fr)_220px]">
              <div className="min-h-0 overflow-hidden">
                <MdxPreview
                  source={content}
                  selectedPath={selectedPath}
                  notes={indexNotes}
                  revealHeadingRequest={previewHeadingRequest}
                  onNavigate={navigateToNote}
                  onRevealLine={revealEditorLine}
                  onSourceChange={setContent}
                />
              </div>
              <div className="min-h-0 overflow-hidden border-t-2 border-foreground bg-[var(--paper-dark)]">
                {navigationPanel === 'outline' ? (
                  <OutlinePanel
                    headings={outlineHeadings}
                    selectedPath={selectedPath}
                    onSelectHeading={revealHeading}
                  />
                ) : navigationPanel === 'tags' ? (
                  <TagsPanel
                    tags={tags}
                    selectedTag={selectedTag}
                    taggedNotes={taggedNotes}
                    isLoading={isLoadingTaggedNotes}
                    onSelectTag={setSelectedTag}
                    onSelectNote={navigateToNote}
                  />
                ) : (
                  <BacklinksPanel
                    backlinks={backlinks}
                    selectedPath={selectedPath}
                    onSelectNote={navigateToNote}
                  />
                )}
              </div>
            </div>
          </aside>
        ) : null}

        {aiPanelOpen ? (
          <aside className="min-h-0 min-w-0 border-l-2 border-foreground bg-[var(--paper-dark)]">
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
      <CommandPalette
        open={commandPaletteOpen}
        actions={commandActions}
        onOpenChange={setCommandPaletteOpen}
        onError={setError}
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
            <code className="bg-foreground px-1 py-0.5 font-mono text-[11px] text-background">
              {'.trash/'}
            </code>
            . You can recover it from there with your file manager, or use “Empty trash” to remove
            it permanently.
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
            from{' '}
            <code className="bg-foreground px-1 py-0.5 font-mono text-[11px] text-background">
              {'.trash/'}
            </code>
            . This cannot be undone.
          </>
        }
        confirmLabel="Empty trash"
        destructive
        isPending={vaultOpsPending}
        onConfirm={() => void handleEmptyTrash()}
      />
      {toast ? <ToastView key={toast.key} message={toast.message} variant={toast.variant} /> : null}
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
        <div className="absolute right-0 top-full z-40 mt-1 min-w-[180px] border-2 border-foreground bg-popover p-1 text-[13px] text-popover-foreground shadow-[4px_4px_0_0_var(--foreground)]">
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
                'flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-foreground hover:text-background',
                sortMode === option.mode && 'bg-foreground text-background font-bold'
              )}
            >
              <span>{option.label}</span>
              {sortMode === option.mode ? (
                <span className="text-[var(--editorial-red)]">✓</span>
              ) : null}
            </button>
          ))}
          <p className="px-2 pt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
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
        'pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border-2 border-foreground px-3 py-1.5 font-mono text-[12px] font-bold uppercase tracking-wider shadow-[4px_4px_0_0_var(--foreground)]',
        variant === 'destructive' ? 'bg-destructive text-white' : 'bg-foreground text-background'
      )}
    >
      {message}
    </div>
  )
}

function ViewModeToggle({
  value,
  onChange,
  disabled,
  dark = false
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  disabled?: boolean
  dark?: boolean
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
      className={cn(
        'flex items-center gap-0.5 border-2 p-0.5',
        dark ? 'border-background' : 'border-foreground'
      )}
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
              'flex h-7 items-center gap-1 px-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors',
              isActive
                ? dark
                  ? 'bg-background text-foreground'
                  : 'bg-foreground text-background'
                : dark
                  ? 'text-background/70 hover:bg-background hover:text-foreground'
                  : 'text-muted-foreground hover:bg-foreground hover:text-background',
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
      <div className="flex size-12 items-center justify-center border-2 border-foreground bg-card text-muted-foreground shadow-[3px_3px_0_0_var(--foreground)]">
        {icon}
      </div>
      <div>
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
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

function findHeadingLine(source: string, headingPosition: number): number | null {
  const lines = source.split(/\r?\n/)
  let currentHeadingPosition = 0

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s{0,3}#{1,6}\s+\S/.test(lines[index])) {
      if (currentHeadingPosition === headingPosition) {
        return index + 1
      }

      currentHeadingPosition += 1
    }
  }

  return null
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildDailyNoteScaffold(date: string): string {
  return `---\ntitle: ${date}\ndate: ${date}\n---\n\n# ${date}\n\n## Notes\n\n## Links\n\n`
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
