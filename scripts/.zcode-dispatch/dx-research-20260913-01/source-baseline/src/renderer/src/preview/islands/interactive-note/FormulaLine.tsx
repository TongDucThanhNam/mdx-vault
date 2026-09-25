import type { ReactNode } from 'react'

export interface FormulaLineProps {
  children: ReactNode
}

export function FormulaLine({ children }: FormulaLineProps): React.JSX.Element {
  return <div className="in-formula-line">{children}</div>
}
