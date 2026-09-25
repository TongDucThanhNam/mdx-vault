import { useCallback, useEffect, useState } from 'react'
import { type AppSettingsController, DEFAULT_APP_SETTINGS_SNAPSHOT } from '@/hooks/useAppSettings'

export type AppTheme = 'light' | 'dark' | 'system'

interface UseThemeOptions {
  settings: AppSettingsController
}

interface UseThemeResult {
  /** The theme chosen by the user (may be 'system'). */
  theme: AppTheme
  /** The resolved effective theme actually applied to the DOM. */
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: AppTheme) => Promise<void>
  toggle: () => Promise<void>
}

/**
 * Theme management hook. Loads the persisted theme on mount, applies the
 * `dark` class to `<html>` (Tailwind v4 dark variant), and listens to system
 * preference changes when the user selects 'system'.
 *
 * Persistence and initial loading flow through the shared confirmed Settings
 * controller. Until a snapshot is available, the safe `system` default is
 * applied without treating it as a persisted choice.
 */
export function useTheme({ settings }: UseThemeOptions): UseThemeResult {
  const theme = settings.snapshot?.theme ?? DEFAULT_APP_SETTINGS_SNAPSHOT.theme
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  // Track the OS color scheme for 'system' mode.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const update = (): void => {
      setResolvedTheme(media.matches ? 'dark' : 'light')
    }

    update()
    media.addEventListener('change', update)
    return () => {
      media.removeEventListener('change', update)
    }
  }, [])

  // Apply the `dark` class based on the chosen theme.
  useEffect(() => {
    const effective = theme === 'system' ? resolvedTheme : theme
    const root = document.documentElement

    if (effective === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme, resolvedTheme])

  const setTheme = useCallback(
    async (next: AppTheme): Promise<void> => {
      await settings.updateSettings({ theme: next })
    },
    [settings.updateSettings]
  )

  const toggle = useCallback(async (): Promise<void> => {
    const effective = theme === 'system' ? resolvedTheme : theme
    await setTheme(effective === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme, theme])

  return { theme, resolvedTheme, setTheme, toggle }
}
