import type { ReactNode } from 'react'

export interface MentalModelRowProps {
  label: string
  conflict?: boolean
  children: ReactNode
}

export function MentalModelRow({
  label,
  conflict = false,
  children
}: MentalModelRowProps): React.JSX.Element {
  return (
    <>
      <dt className={conflict ? 'in-mm-key in-mm-key-conflict' : 'in-mm-key'}>{label}</dt>
      <dd className="in-mm-value">{children}</dd>
    </>
  )
}
