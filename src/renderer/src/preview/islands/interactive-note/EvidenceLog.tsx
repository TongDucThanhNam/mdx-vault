import type { ReactNode } from 'react'

export interface EvidenceLogProps {
  children: ReactNode
}

export function EvidenceLog({ children }: EvidenceLogProps): React.JSX.Element {
  return (
    <section className="in-evidence-log" aria-label="Evidence log">
      {children}
    </section>
  )
}
