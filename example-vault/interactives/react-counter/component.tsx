import { useMemo, useState } from 'react'

interface ReactCounterProps {
  label: string
  start: number
}

export default function ReactCounter({ label, start }: ReactCounterProps): React.JSX.Element {
  const [count, setCount] = useState(start)
  const doubled = useMemo(() => count * 2, [count])
  const vaultApiState = typeof window.vaultApi === 'undefined' ? 'undefined' : 'visible'

  return (
    <section
      style={{
        border: '1px solid #d1d5db',
        borderRadius: 8,
        padding: 16,
        background: '#ffffff',
        color: '#111827'
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
        React sandbox
      </div>
      <h2 style={{ margin: '6px 0 8px', fontSize: 18 }}>{label}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => setCount((value) => value - 1)}>
          -
        </button>
        <strong style={{ minWidth: 40, textAlign: 'center' }}>{count}</strong>
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          +
        </button>
      </div>
      <p style={{ margin: '10px 0 0', color: '#4b5563', fontSize: 13 }}>
        doubled={doubled}; window.vaultApi={vaultApiState}
      </p>
    </section>
  )
}
