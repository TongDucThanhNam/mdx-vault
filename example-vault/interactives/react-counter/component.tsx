import { useState } from 'react'
import { createRoot } from 'react-dom/client'

export interface ReactCounterProps {
  initial?: number
}

function ReactCounter({ initial = 0 }: ReactCounterProps): React.JSX.Element {
  const [count, setCount] = useState(initial)

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif'
      }}
    >
      <button
        type="button"
        aria-label="Decrement"
        onClick={() => setCount((value) => value - 1)}
        style={{ padding: '4px 10px' }}
      >
        −
      </button>
      <span style={{ minWidth: 32, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </span>
      <button
        type="button"
        aria-label="Increment"
        onClick={() => setCount((value) => value + 1)}
        style={{ padding: '4px 10px' }}
      >
        +
      </button>
    </div>
  )
}

export default ReactCounter

void createRoot