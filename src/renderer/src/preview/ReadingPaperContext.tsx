import { createContext, useContext } from 'react'

export type ResolvedReadingPaper = 'light' | 'dark'

export const ReadingPaperContext = createContext<ResolvedReadingPaper>('light')

export function useReadingPaper(): ResolvedReadingPaper {
  return useContext(ReadingPaperContext)
}
