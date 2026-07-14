import type { ReactNode } from 'react'

export interface TraceBlockProps {
  children: ReactNode
}

export function TraceBlock({ children }: TraceBlockProps): React.JSX.Element {
  return <pre className="in-trace">{children}</pre>
}
