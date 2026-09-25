import type { ReactNode } from 'react'

export interface NotePrimerProps {
  children: ReactNode
}

export function NotePrimer({ children }: NotePrimerProps): React.JSX.Element {
  return (
    <aside className="in-primer" aria-label="Terms to know first">
      <div className="in-primer-head">Từ cần biết trước</div>
      {children}
    </aside>
  )
}
