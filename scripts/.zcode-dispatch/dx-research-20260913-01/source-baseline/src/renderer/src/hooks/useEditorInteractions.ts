import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useMemo, useState } from 'react'
import type { SelectionActionPalettePosition } from '@/ai/panels/AiSelectionActionPalette'
import type {
  EditorSelectionSnapshot,
  RevealLineRequest,
  RevealSourceRangeRequest
} from '@/editor/MdxEditor'
import type { NoteEditorController } from '@/hooks/useNoteEditor'
import { findHeadingLine } from '@/lib/editor-navigation'
import type { NoteHeadingResult } from '@/vault/types'
import type { SelectionRange } from '../../../shared/ai'
import type { SourceRange } from '../../../shared/knowledge'

export interface PreviewHeadingRequest {
  id: string
  position: number
  requestId: number
}

interface UseEditorInteractionsOptions {
  editor: NoteEditorController
  setAiPanelOpen: Dispatch<SetStateAction<boolean>>
}

export function useEditorInteractions({ editor, setAiPanelOpen }: UseEditorInteractionsOptions) {
  const [editorSelection, setEditorSelection] = useState<EditorSelectionSnapshot | null>(null)
  const [revealLineRequest, setRevealLineRequest] = useState<RevealLineRequest | null>(null)
  const [revealSourceRangeRequest, setRevealSourceRangeRequest] =
    useState<RevealSourceRangeRequest | null>(null)
  const [previewHeadingRequest, setPreviewHeadingRequest] = useState<PreviewHeadingRequest | null>(
    null
  )
  const [aiPaletteOpen, setAiPaletteOpen] = useState(false)
  const [aiPalettePosition, setAiPalettePosition] = useState<SelectionActionPalettePosition | null>(
    null
  )

  const revealEditorLine = useCallback((line: number): void => {
    setRevealLineRequest({
      line,
      requestId: Date.now()
    })
  }, [])

  const revealEditorRange = useCallback((range: SourceRange): void => {
    setRevealSourceRangeRequest({
      from: range.from,
      to: range.to,
      requestId: Date.now()
    })
  }, [])

  const revealHeading = useCallback(
    (heading: NoteHeadingResult): void => {
      const editorLine = findHeadingLine(editor.contentRef.current, heading.position)

      if (editorLine !== null) {
        revealEditorLine(editorLine)
      }

      setPreviewHeadingRequest({
        id: heading.id,
        position: heading.position,
        requestId: Date.now()
      })
    },
    [editor.contentRef, revealEditorLine]
  )

  const handleEditorSelectionChange = useCallback((snapshot: EditorSelectionSnapshot): void => {
    setEditorSelection(snapshot)
    if (!snapshot.hasSelection) {
      setAiPaletteOpen(false)
    }
  }, [])

  const openAiPalette = useCallback((): void => {
    if (!editorSelection?.hasSelection) {
      return
    }
    setAiPalettePosition({ top: 56, left: 320 })
    setAiPaletteOpen(true)
  }, [editorSelection])

  const handleAiActionPicked = useCallback(
    (..._args: [string, string]): void => {
      void _args
      setAiPaletteOpen(false)
      setAiPanelOpen(true)
    },
    [setAiPanelOpen]
  )

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

  return {
    editorSelection,
    revealLineRequest,
    revealSourceRangeRequest,
    previewHeadingRequest,
    aiPaletteOpen,
    aiPalettePosition,
    selectionForAssistant,
    setAiPaletteOpen,
    revealEditorLine,
    revealEditorRange,
    revealHeading,
    handleEditorSelectionChange,
    openAiPalette,
    handleAiActionPicked
  }
}

export type EditorInteractionsController = ReturnType<typeof useEditorInteractions>
