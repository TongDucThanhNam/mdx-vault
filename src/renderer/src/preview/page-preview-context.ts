import { createContext, useContext } from 'react'

import type { useWikilinkPreview } from './useWikilinkPreview'

export type PagePreviewController = ReturnType<typeof useWikilinkPreview>

export const PagePreviewContext = createContext<PagePreviewController | null>(null)

export function usePagePreviewController(): PagePreviewController | null {
  return useContext(PagePreviewContext)
}
