import { useCallback, useEffect, useRef, useState } from 'react'
import {
  resolveActiveHeadingFromOffset,
  resolveAvailableHeadingId
} from '@/components/layout/living-outline'
import type { ViewMode } from '@/components/ViewModeToggle'
import { EditorAnalysisClient } from '@/editor/editor-analysis-client'
import type { NoteHeadingResult } from '@/vault/types'

interface UseLivingOutlineOptions {
  sessionId: number
  selectedPath: string | null
  editorPath: string | null
  source: string
  indexedHeadings: readonly NoteHeadingResult[]
  viewMode: ViewMode
  cursorOffset: number | null
}

export function useLivingOutline({
  sessionId,
  selectedPath,
  editorPath,
  source,
  indexedHeadings,
  viewMode,
  cursorOffset
}: UseLivingOutlineOptions) {
  const [analysis, setAnalysis] = useState<{
    sessionId: number
    path: string
    headings: NoteHeadingResult[]
  } | null>(null)
  const clientRef = useRef<EditorAnalysisClient | null>(null)
  // Client disposal belongs to a separate mount effect; typing only cancels
  // publication of stale results, without restarting the parser worker.
  useEffect(() => {
    const client = new EditorAnalysisClient('outline')
    clientRef.current = client
    return () => client.dispose()
  }, [sessionId])
  useEffect(() => {
    if (!selectedPath || editorPath !== selectedPath) return
    let current = true
    const timer = window.setTimeout(() => {
      void clientRef.current?.analyze(source).then((result) => {
        if (current && result)
          setAnalysis({ sessionId, path: selectedPath, headings: result.headings })
      })
    }, 120)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [sessionId, editorPath, selectedPath, source])
  const headings =
    analysis?.sessionId === sessionId && analysis.path === selectedPath
      ? analysis.headings
      : indexedHeadings
  const [readingActiveHeadingId, setReadingActiveHeadingId] = useState<string | null>(null)
  const activeHeadingId =
    viewMode === 'reading'
      ? resolveAvailableHeadingId(headings, readingActiveHeadingId)
      : resolveActiveHeadingFromOffset(headings, cursorOffset ?? 0)

  const handleReadingActiveHeadingChange = useCallback((headingId: string | null): void => {
    setReadingActiveHeadingId(headingId)
  }, [])

  return {
    headings,
    activeHeadingId,
    handleReadingActiveHeadingChange
  }
}

export type LivingOutlineController = ReturnType<typeof useLivingOutline>
