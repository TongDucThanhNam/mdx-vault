import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

export function WindowControls(): React.JSX.Element | null {
  const [isMaximized, setIsMaximized] = useState(false)
  const platform = window.windowApi.platform

  useEffect(() => {
    if (platform !== 'win32' && platform !== 'linux') {
      return
    }

    let active = true
    void window.windowApi.isMaximized().then((nextState) => {
      if (active) {
        setIsMaximized(nextState)
      }
    })
    const unsubscribe = window.windowApi.onMaximizeChange(setIsMaximized)

    return () => {
      active = false
      unsubscribe()
    }
  }, [platform])

  if (platform !== 'win32' && platform !== 'linux') {
    return null
  }

  return (
    <div className="app-no-drag ml-1 flex h-full items-stretch border-l border-[var(--line)]">
      <Button
        type="button"
        variant="ghost"
        className="h-full w-10 text-muted-foreground hover:bg-foreground hover:text-background"
        title="Minimize"
        aria-label="Minimize window"
        onClick={() => void window.windowApi.minimize()}
      >
        <Minus className="size-3.5" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-full w-10 text-muted-foreground hover:bg-foreground hover:text-background"
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        onClick={() => void window.windowApi.toggleMaximize()}
      >
        {isMaximized ? (
          <Copy className="size-3" aria-hidden="true" />
        ) : (
          <Square className="size-3" aria-hidden="true" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-full w-10 text-muted-foreground hover:bg-destructive hover:text-white"
        title="Close"
        aria-label="Close window"
        onClick={() => void window.windowApi.close()}
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  )
}
