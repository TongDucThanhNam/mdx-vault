import { useCallback, useEffect, useState } from 'react'
import { loadRecentNotePaths, recordRecentNotePath, saveRecentNotePaths } from '@/lib/recent-notes'

export function useRecentNotes(): {
  recentNotePaths: string[]
  recordRecentNote: (relativePath: string) => void
} {
  const [recentNotePaths, setRecentNotePaths] = useState<string[]>(() => loadRecentNotePaths())

  useEffect(() => {
    saveRecentNotePaths(recentNotePaths)
  }, [recentNotePaths])

  const recordRecentNote = useCallback((relativePath: string): void => {
    setRecentNotePaths((current) => recordRecentNotePath(current, relativePath))
  }, [])

  return { recentNotePaths, recordRecentNote }
}
