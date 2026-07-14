import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useRef, useState } from 'react'
import type { ViewMode } from '@/components/ViewModeToggle'
import type { EditorInsertRequest } from '@/editor/MdxEditor'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import type { VaultSessionController } from '@/hooks/useVaultSession'
import { formatError } from '@/lib/format-error'
import {
  buildDailyNoteScaffold,
  buildNewNoteScaffold,
  buildTimestampNoteScaffold,
  formatLocalDate,
  formatLocalTime,
  formatUniqueTimestamp
} from '@/lib/note-scaffolds'
import { deriveNoteTitle, sanitizeNoteTitle } from '@/lib/note-title'
import type { IndexedNoteSummary, NoteTemplate, VaultInfo } from '@/vault/types'

interface UseNoteActionsOptions {
  vault: VaultInfo | null
  indexNotes: IndexedNoteSummary[]
  editor: NoteEditorController
  vaultSession: VaultSessionController
  setViewMode: Dispatch<SetStateAction<ViewMode>>
  onError: (message: string | null) => void
  showToast: (message: string) => void
}

export function useNoteActions({
  vault,
  indexNotes,
  editor,
  vaultSession,
  setViewMode,
  onError,
  showToast
}: UseNoteActionsOptions) {
  const [editorInsertRequest, setEditorInsertRequest] = useState<EditorInsertRequest | null>(null)
  const insertRequestRef = useRef(0)
  const { loadFile, saveCurrentFile, selectedPathRef } = editor
  const { createNote, refreshVaultSnapshot } = vaultSession

  const navigateToNote = useCallback(
    (relativePath: string): void => {
      void loadFile(relativePath)
    },
    [loadFile]
  )

  const insertIntoEditor = useCallback(
    (text: string, placement: EditorInsertRequest['placement']): void => {
      if (!selectedPathRef.current) {
        throw new Error('Select a note before inserting content.')
      }

      if (!text) {
        return
      }

      insertRequestRef.current += 1
      setViewMode((current) => (current === 'reading' ? 'live' : current))
      setEditorInsertRequest({
        requestId: insertRequestRef.current,
        text,
        placement
      })
    },
    [selectedPathRef, setViewMode]
  )

  const insertTemplateAtCursor = useCallback(
    async (template: NoteTemplate): Promise<void> => {
      const currentPath = selectedPathRef.current

      if (!currentPath) {
        throw new Error('Select a note before inserting a template.')
      }

      const renderedTemplate = await window.vaultApi.renderTemplate(
        template.relativePath,
        deriveNoteTitle(currentPath)
      )
      insertIntoEditor(renderedTemplate, 'block')
      showToast(`Inserted ${template.name}`)
    },
    [insertIntoEditor, selectedPathRef, showToast]
  )

  const insertCurrentDate = useCallback((): void => {
    insertIntoEditor(formatLocalDate(new Date()), 'inline')
  }, [insertIntoEditor])

  const insertCurrentTime = useCallback((): void => {
    insertIntoEditor(formatLocalTime(new Date()), 'inline')
  }, [insertIntoEditor])

  const openDailyNote = useCallback(async (): Promise<void> => {
    if (!vault) {
      return
    }

    await saveCurrentFile()
    onError(null)

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
      onError(formatError(dailyNoteError))
    }
  }, [loadFile, onError, refreshVaultSnapshot, saveCurrentFile, showToast, vault])

  const openRandomNote = useCallback(async (): Promise<void> => {
    if (indexNotes.length === 0) {
      return
    }

    const note = indexNotes[Math.floor(Math.random() * indexNotes.length)]
    await loadFile(note.relativePath)
    showToast(`Opened ${note.title}`)
  }, [indexNotes, loadFile, showToast])

  const createUniqueNote = useCallback(async (): Promise<void> => {
    if (!vault) {
      return
    }

    await saveCurrentFile()
    const timestamp = formatUniqueTimestamp(new Date())
    const relativePath = await findUniqueNotePath(`${timestamp}.mdx`)
    const createdPath = await window.vaultApi.createFile(
      relativePath,
      buildTimestampNoteScaffold(timestamp)
    )

    await refreshVaultSnapshot()
    await loadFile(createdPath, false)
    showToast(`Created ${createdPath}`)
  }, [loadFile, refreshVaultSnapshot, saveCurrentFile, showToast, vault])

  const createNoteFromSwitcher = useCallback(
    async (query: string): Promise<void> => {
      if (!vault) {
        return
      }

      const title = sanitizeNoteTitle(query)
      const relativePath = await findUniqueNotePath(`${title}.mdx`)

      await createNote(relativePath, buildNewNoteScaffold(title))
      showToast(`Created ${relativePath}`)
    },
    [createNote, showToast, vault]
  )

  return {
    editorInsertRequest,
    navigateToNote,
    insertTemplateAtCursor,
    insertCurrentDate,
    insertCurrentTime,
    openDailyNote,
    openRandomNote,
    createUniqueNote,
    createNoteFromSwitcher
  }
}

export type NoteActionsController = ReturnType<typeof useNoteActions>

async function findUniqueNotePath(relativePath: string): Promise<string> {
  const normalizedPath = relativePath.replaceAll('\\', '/')
  const dotIndex = normalizedPath.lastIndexOf('.')
  const stem = dotIndex > 0 ? normalizedPath.slice(0, dotIndex) : normalizedPath
  const extension = dotIndex > 0 ? normalizedPath.slice(dotIndex) : '.mdx'
  let candidate = `${stem}${extension}`
  let counter = 2

  while (await window.vaultApi.fileExists(candidate)) {
    candidate = `${stem} ${counter}${extension}`
    counter += 1
  }

  return candidate
}
