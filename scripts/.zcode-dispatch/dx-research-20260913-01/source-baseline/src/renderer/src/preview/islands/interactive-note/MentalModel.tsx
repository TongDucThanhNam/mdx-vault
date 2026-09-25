import type { ReactNode } from 'react'

export interface MentalModelProps {
  children: ReactNode
}

export function MentalModel({ children }: MentalModelProps): React.JSX.Element {
  return <dl className="in-mm-grid">{children}</dl>
}
