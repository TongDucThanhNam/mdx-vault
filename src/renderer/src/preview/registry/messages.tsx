import { AlertTriangle, CircleHelp } from 'lucide-react'
import type { ZodIssue } from 'zod'

interface ComponentValidationWarningProps {
  componentName: string
  issues: ZodIssue[]
}

export function ComponentValidationWarning({
  componentName,
  issues
}: ComponentValidationWarningProps): React.JSX.Element {
  return (
    <div className="my-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Invalid props for {componentName}
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-950/80 dark:text-amber-100/85">
        {issues.map((issue, index) => (
          <li key={`${issue.path.join('.')}-${index}`}>
            <span className="font-mono">{formatIssuePath(issue.path)}</span>: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function UnknownComponentPlaceholder({
  componentName
}: {
  componentName: string
}): React.JSX.Element {
  return (
    <div className="my-4 rounded-md border border-dashed bg-muted/50 p-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <CircleHelp className="size-4" aria-hidden="true" />
        Unknown component: {componentName}
      </div>
      <div className="mt-1 text-xs">
        Register this component before using it as a trusted MDX island.
      </div>
    </div>
  )
}

function formatIssuePath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return 'props'
  }

  return path.map((part) => String(part)).join('.')
}
