import type { ReactNode } from 'react'

export interface PrimerTermProps {
  term: string
  href?: string
  children: ReactNode
}

export function PrimerTerm({ term, href, children }: PrimerTermProps): React.JSX.Element {
  return (
    <div className="in-primer-row">
      <span className="in-primer-term">{term}</span> — {children}{' '}
      {href ? (
        <a className="in-primer-link" href={href}>
          ↓ Đọc thêm
        </a>
      ) : null}
    </div>
  )
}
