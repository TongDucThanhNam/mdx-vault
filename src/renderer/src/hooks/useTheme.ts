import { useEffect, useState } from 'react'

type AppTheme = 'light' | 'dark' | 'system'

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
 * Persistence goes through the main-process `appApi` so the choice survives
 * restarts. Falls back to system preference if no API is available (e.g.
 * during a pure-render test).
 */
export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<AppTheme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  // Load persisted theme on mount.
  useEffect(() => {
    if (!window.appApi) {
      return
    }

    void window.appApi.getTheme().then((persisted) => {
      setThemeState(persisted)
    })
  }, [])

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

  const setTheme = async (next: AppTheme): Promise<void> => {
    setThemeState(next)
    if (window.appApi) {
      await window.appApi.setTheme(next)
    }
  }

  const toggle = async (): Promise<void> => {
    const effective = theme === 'system' ? resolvedTheme : theme
    await setTheme(effective === 'dark' ? 'light' : 'dark')
  }

  return { theme, resolvedTheme, setTheme, toggle }
}
