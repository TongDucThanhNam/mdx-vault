import { AlertTriangle } from 'lucide-react'

import { SandboxHost } from './SandboxHost'

interface SandboxedHTMLProps {
  src?: unknown
}

export function SandboxedHTML({ src }: SandboxedHTMLProps): React.JSX.Element {
  if (typeof src !== 'string' || !src.trim()) {
    return <SandboxPropError message="SandboxedHTML requires a non-empty string src." />
  }

  return <SandboxHost kind="html" src={src} />
}

function SandboxPropError({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="my-5 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Sandbox props error
      </div>
      <div className="mt-2">{message}</div>
    </div>
  )
}
