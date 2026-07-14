import { createContext, use } from 'react'

export interface WidgetFrameState {
  locked: boolean
  prediction: string | null
  commit: (prediction: string) => void
  complete: () => void
}

export const WidgetFrameContext = createContext<WidgetFrameState | null>(null)

export function useWidgetFrameState(): WidgetFrameState | null {
  return use(WidgetFrameContext)
}
