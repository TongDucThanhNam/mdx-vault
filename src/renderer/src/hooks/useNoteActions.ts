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
import { resolveVaultNavigationTarget } from '@/vault/goto-definition-path'
import type { IndexedNoteSummary, NoteTemplate, VaultInfo } from '@/vault/types'
import { openVaultNote } from '@/workbench/note-action-lifecycle'

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
  const { selectedPathRef } = editor
  const { createNote, selectNote, selectTreeFile } = vaultSession

  const navigateToNote = useCallback(
    (relativePath: string): Promise<boolean> => {
      return selectNote(relativePath)
    },
    [selectNote]
  )

  const navigateToVaultFile = useCallback(
    async (relativePath: string): Promise<boolean> => {
      const targetPath = resolveVaultNavigationTarget(vault?.treeFiles ?? [], relativePath)

      if (!targetPath) {
        showToast(`File not found: ${relativePath}`)
        return false
      }

      return selectTreeFile(targetPath)
    },
    [selectTreeFile, showToast, vault]
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

  const openDailyNote = useCallback(async (): Promise<boolean> => {
    if (!vault) {
      return false
    }

    onError(null)

    try {
      const date = formatLocalDate(new Date())
      const relativePath = `journal/${date}.mdx`

      if (await window.vaultApi.fileExists(relativePath)) {
        return openVaultNote(
          () => selectNote(relativePath, false),
          () => showToast(`Opened ${relativePath}`)
        )
      }

      const templatePath = 'templates/daily.mdx'
      const content = (await window.vaultApi.fileExists(templatePath))
        ? await window.vaultApi.renderTemplate(templatePath, date)
        : buildDailyNoteScaffold(date)
      const createdPath = await createNote(relativePath, content)
      showToast(`Created ${createdPath}`)
      return true
    } catch (dailyNoteError) {
      onError(formatError(dailyNoteError))
      return false
    }
  }, [createNote, onError, selectNote, showToast, vault])

  const openRandomNote = useCallback(async (): Promise<boolean> => {
    if (indexNotes.length === 0) {
      return false
    }

    const note = indexNotes[Math.floor(Math.random() * indexNotes.length)]
    return openVaultNote(
      () => selectNote(note.relativePath),
      () => showToast(`Opened ${note.title}`)
    )
  }, [indexNotes, selectNote, showToast])

  const createUniqueNote = useCallback(async (): Promise<boolean> => {
    if (!vault) {
      return false
    }

    const timestamp = formatUniqueTimestamp(new Date())
    const relativePath = await findUniqueNotePath(`${timestamp}.mdx`)
    const createdPath = await createNote(relativePath, buildTimestampNoteScaffold(timestamp))

    showToast(`Created ${createdPath}`)
    return true
  }, [createNote, showToast, vault])

  const createNoteFromSwitcher = useCallback(
    async (query: string): Promise<boolean> => {
      if (!vault) {
        return false
      }

      const title = sanitizeNoteTitle(query)
      const relativePath = await findUniqueNotePath(`${title}.mdx`)

      const createdPath = await createNote(relativePath, buildNewNoteScaffold(title))
      showToast(`Created ${createdPath}`)
      return true
    },
    [createNote, showToast, vault]
  )

  return {
    editorInsertRequest,
    navigateToNote,
    navigateToVaultFile,
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
