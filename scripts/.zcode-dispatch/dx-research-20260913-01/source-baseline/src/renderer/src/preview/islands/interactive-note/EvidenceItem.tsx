import { Children, type ReactNode } from 'react'

export interface EvidenceItemProps {
  cmd: string
  children?: ReactNode
}

export function EvidenceItem({ cmd, children }: EvidenceItemProps): React.JSX.Element {
  const hasEvidence = Children.toArray(children).some(
    (child) => typeof child !== 'string' || child.trim().length > 0
  )

  return (
    <article className="in-evidence-item">
      <code className="in-command">{cmd}</code>
      <div className="in-evidence-result">
        {hasEvidence ? children : <span className="in-evidence-empty">[CHƯA CÓ]</span>}
      </div>
    </article>
  )
}
