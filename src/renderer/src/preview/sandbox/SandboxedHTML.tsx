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
    <div className="my-5 border-2 border-destructive bg-background p-4 text-sm text-destructive shadow-[3px_3px_0_0_var(--destructive)]">
      <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider">
        <AlertTriangle className="size-4" aria-hidden="true" />
        Sandbox props error
      </div>
      <div className="mt-2">{message}</div>
    </div>
  )
}
