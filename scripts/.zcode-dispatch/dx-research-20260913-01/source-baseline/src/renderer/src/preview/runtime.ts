import { createContext, useContext } from 'react'

export interface PreviewRuntimeValue {
  selectedPath: string | null
}

export const PreviewRuntimeContext = createContext<PreviewRuntimeValue>({
  selectedPath: null
})

export function usePreviewRuntime(): PreviewRuntimeValue {
  return useContext(PreviewRuntimeContext)
}
