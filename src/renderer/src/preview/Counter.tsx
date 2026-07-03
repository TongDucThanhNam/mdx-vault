import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

interface CounterProps {
  initial?: number
}

export function Counter({ initial = 0 }: CounterProps): React.JSX.Element {
  const [count, setCount] = useState(initial)

  return (
    <div className="my-4 flex w-full max-w-xs items-center justify-between rounded-md border bg-background p-2 shadow-xs">
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
        <div className="text-[11px] font-medium uppercase text-muted-foreground">Counter</div>
        <div className="text-2xl font-semibold tabular-nums">{count}</div>
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
