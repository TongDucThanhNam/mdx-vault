import { useEffect, useMemo } from 'react'
import type { AppLocale } from '../../../shared/app-settings'
import { EN_MESSAGES, type MessageCatalog, VI_MESSAGES } from './catalog'
import { I18nContext, type I18nContextValue } from './context'
import { interpolate, type ResolvedLocale, resolveAppLocale } from './locale'

export function I18nProvider({
  locale,
  children
}: {
  locale: AppLocale
  children: React.ReactNode
}): React.JSX.Element {
  const resolvedLocale = resolveAppLocale(locale, globalThis.navigator?.language ?? 'en')
  const value = useMemo<I18nContextValue>(() => {
    const catalog = catalogFor(resolvedLocale)
    const timeFormatter = new Intl.DateTimeFormat(resolvedLocale, {
      hour: '2-digit',
      minute: '2-digit'
    })
    const numberFormatter = new Intl.NumberFormat(resolvedLocale)

    return {
      locale: resolvedLocale,
      t: (key, variables) => interpolate(catalog[key], variables),
      formatNumber: (number) => numberFormatter.format(number),
      formatTime: (date) => timeFormatter.format(date)
    }
  }, [resolvedLocale])

  useEffect(() => {
    document.documentElement.lang = resolvedLocale
  }, [resolvedLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

function catalogFor(locale: ResolvedLocale): MessageCatalog {
  return locale === 'vi' ? VI_MESSAGES : EN_MESSAGES
}
