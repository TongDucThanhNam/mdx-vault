interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-md border border-border bg-card text-instrument-blue">
        {icon}
      </div>
      <div className="max-w-56">
        <p className="text-balance font-display text-lg leading-tight font-semibold text-foreground">
          {title}
        </p>
        <p className="mt-2 text-pretty font-sans text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action ?? null}
    </div>
  )
}
