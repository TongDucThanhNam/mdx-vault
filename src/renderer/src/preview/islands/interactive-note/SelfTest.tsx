import type { ReactNode } from 'react'

export interface SelfTestProps {
  children: ReactNode
}

export function SelfTest({ children }: SelfTestProps): React.JSX.Element {
  return (
    <section className="in-self-test" aria-label="Self-test">
      {children}
    </section>
  )
}
