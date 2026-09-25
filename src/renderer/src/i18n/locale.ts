import type { AppLocale } from '../../../shared/app-settings'

export type ResolvedLocale = 'en' | 'vi'

export function resolveAppLocale(locale: AppLocale, systemLocale: string): ResolvedLocale {
  if (locale === 'en' || locale === 'vi') {
    return locale
  }
  return systemLocale.toLowerCase().startsWith('vi') ? 'vi' : 'en'
}

export function interpolate(
  template: string,
  variables: Readonly<Record<string, string | number>> | undefined
): string {
  if (!variables) {
    return template
  }
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, key: string) =>
    Object.hasOwn(variables, key) ? String(variables[key]) : match
  )
}
