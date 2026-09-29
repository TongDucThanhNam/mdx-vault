import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

interface CounterProps {
  initial?: number
}

export function Counter({ initial = 0 }: CounterProps): React.JSX.Element {
  const [count, setCount] = useState(initial)

  return (
    <div className="my-4 flex w-full max-w-xs items-center justify-between border-2 border-foreground bg-background p-2 shadow-[3px_3px_0_0_var(--foreground)]">
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Decrease counter"
        onClick={() => setCount((current) => current - 1)}
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>
      <div className="min-w-16 text-center">
        <div className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Counter
        </div>
        <div className="mt-1 bg-[var(--editorial-blue)] px-2 font-mono text-2xl font-bold tabular-nums text-white">
          {count}
        </div>
      </div>
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        aria-label="Increase counter"
        onClick={() => setCount((current) => current + 1)}
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
