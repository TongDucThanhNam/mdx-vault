import type { ReactNode } from 'react'

export interface RecapProps {
  children: ReactNode
}

export function Recap({ children }: RecapProps): React.JSX.Element {
  return (
    <aside className="in-recap" aria-label="Static recap">
      <div className="in-recap-label">Recap tĩnh — cho lần đọc thứ N, sau khi đã qua gate</div>
      {children}
    </aside>
  )
}
