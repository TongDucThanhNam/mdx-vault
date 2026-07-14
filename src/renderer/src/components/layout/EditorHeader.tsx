import { cn } from '@/lib/utils'

interface EditorHeaderProps {
  selectedPath: string | null
  children?: React.ReactNode
}

export function EditorHeader({ selectedPath, children }: EditorHeaderProps): React.JSX.Element {
  const pathParts = selectedPath?.split(/[\\/]/).filter(Boolean) ?? []

  return (
    <header className="flex h-8 shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper-dark)] pl-3">
      {pathParts.length > 0 ? (
        <nav
          className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden font-mono text-[11px]"
          aria-label={`Current file: ${selectedPath}`}
        >
          {pathParts.map((part, index) => {
            const isCurrentNote = index === pathParts.length - 1

            return (
              <span
                key={`${part}-${index}`}
                className={cn(
                  'flex min-w-0 items-center gap-1',
                  isCurrentNote ? 'flex-1' : 'shrink'
                )}
              >
                {index > 0 ? (
                  <span className="shrink-0 text-muted-foreground/55" aria-hidden="true">
                    ›
                  </span>
                ) : null}
                <span
                  className={cn(
                    'truncate',
                    isCurrentNote
                      ? 'min-w-16 font-medium text-foreground'
                      : 'max-w-28 text-muted-foreground'
                  )}
                >
                  {part}
                </span>
              </span>
            )
          })}
        </nav>
      ) : (
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          No file selected
        </span>
      )}

      {children ? <div className="flex h-full shrink-0 items-center pr-1">{children}</div> : null}
    </header>
  )
}
