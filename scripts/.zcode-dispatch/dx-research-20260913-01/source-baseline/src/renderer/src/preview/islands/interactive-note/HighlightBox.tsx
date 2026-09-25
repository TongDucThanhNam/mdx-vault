import type { ReactNode } from 'react'

export interface HighlightBoxProps {
  title?: string
  children: ReactNode
}

export function HighlightBox({ title, children }: HighlightBoxProps): React.JSX.Element {
  return (
    <aside className="in-highlight-box">
      {title ? <strong className="in-highlight-title">{title}: </strong> : null}
      {children}
    </aside>
  )
}
