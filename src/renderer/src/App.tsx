import { Eye, EyeOff, FileSearch, FolderOpen, PanelRight, Save, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { MdxEditor, type RevealLineRequest } from '@/editor/MdxEditor'
import { FileTree } from '@/explorer/FileTree'
import { QuickSwitcher } from '@/explorer/QuickSwitcher'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BacklinksPanel } from '@/panels/BacklinksPanel'
import { MdxPreview } from '@/preview/MdxPreview'
import { SearchPane } from '@/search/SearchPane'
import type { BacklinkResult, IndexedNoteSummary, VaultInfo } from '@/vault/types'

function App(): React.JSX.Element {
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
  const [showPreview, setShowPreview] = useState(true)
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [revealLineRequest, setRevealLineRequest] = useState<RevealLineRequest | null>(null)
  const [indexRevision, setIndexRevision] = useState(0)
  const [isOpening, setIsOpening] = useState(false)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const openVault = useCallback(async () => {
    await saveCurrentFile()
    setIsOpening(true)
    setError(null)

    try {
      const openedVault = await window.vaultApi.openVault()

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
    } catch (openError) {
      setError(formatError(openError))
    } finally {
      setIsOpening(false)
    }
  }, [loadFile, saveCurrentFile])

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

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'f') {
        event.preventDefault()
        setSearchOpen(true)
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

  const saveLabel = getSaveLabel({
    hasFile: selectedPath !== null,
    isDirty,
    isSaving,
    lastSavedAt
  })
  const backlinks = backlinksState.relativePath === selectedPath ? backlinksState.backlinks : []

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-md border bg-muted font-mono text-xs font-semibold">
            mdx
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">mdx-vault</div>
            <div className="truncate text-xs text-muted-foreground">
              {vault ? vault.name : 'No vault open'}
            </div>
          </div>
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
            title={showPreview ? 'Hide preview' : 'Show preview'}
            aria-label={showPreview ? 'Hide preview' : 'Show preview'}
            onClick={() => setShowPreview((current) => !current)}
          >
            {showPreview ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
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
          showPreview
            ? 'grid-cols-[280px_minmax(0,1fr)_minmax(340px,0.9fr)]'
            : 'grid-cols-[280px_minmax(0,1fr)]'
        )}
      >
        <aside className="min-h-0 min-w-0 border-r bg-muted/20">
          <div className="flex h-10 items-center justify-between border-b px-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Files</div>
            <div className="text-xs tabular-nums text-muted-foreground">
              {vault?.files.length ?? 0}
            </div>
          </div>
          <div className="h-[calc(100%-2.5rem)] overflow-auto">
            {vault ? (
              <FileTree
                files={vault.files}
                selectedPath={selectedPath}
                onSelectFile={(relativePath) => void loadFile(relativePath)}
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

        <section className="min-h-0 min-w-0 border-r">
          <div className="flex h-10 items-center justify-between border-b px-4">
            <div className="truncate text-sm font-medium">{selectedPath ?? 'Editor'}</div>
            <div className="text-xs text-muted-foreground">
              {isLoadingFile ? 'Loading' : saveLabel}
            </div>
          </div>
          <div className="h-[calc(100%-2.5rem)] min-h-0">
            {selectedPath ? (
              isLoadingFile ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading file.
                </div>
              ) : (
                <MdxEditor
                  value={content}
                  onChange={setContent}
                  revealLineRequest={revealLineRequest}
                />
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

        {showPreview ? (
          <aside className="min-h-0 min-w-0 bg-background">
            <div className="flex h-10 items-center gap-2 border-b px-4 text-sm font-medium">
              <PanelRight className="size-4" aria-hidden="true" />
              Preview
            </div>
            <div className="grid h-[calc(100%-2.5rem)] min-h-0 grid-rows-[minmax(0,1fr)_180px]">
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
      </main>

      <QuickSwitcher
        open={quickSwitcherOpen}
        notes={indexNotes}
        onOpenChange={setQuickSwitcherOpen}
        onSelectNote={navigateToNote}
      />
      <SearchPane open={searchOpen} onOpenChange={setSearchOpen} onSelectNote={navigateToNote} />
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
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
      <div className="flex size-10 items-center justify-center rounded-md border bg-background">
        {icon}
      </div>
      <div className="text-sm font-medium text-foreground">{title}</div>
      {action}
    </div>
  )
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

export default App
