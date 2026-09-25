import { createContext } from 'react'
import type { MessageKey } from './catalog'
import type { ResolvedLocale } from './locale'

export interface I18nContextValue {
  locale: ResolvedLocale
  t: (key: MessageKey, variables?: Readonly<Record<string, string | number>>) => string
  formatNumber: (value: number) => string
  formatTime: (value: Date) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)
