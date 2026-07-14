import { type ReactNode, useCallback, useMemo, useState } from 'react'

import { commitPrediction } from './prediction-state'
import { WidgetFrameContext, type WidgetFrameState } from './widget-frame-context'

export interface WidgetFrameProps {
  title: string
  misconception?: string
  children: ReactNode
}

export function WidgetFrame({
  title,
  misconception,
  children
}: WidgetFrameProps): React.JSX.Element {
  const [prediction, setPrediction] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const locked = prediction === null
  const commit = useCallback((candidate: string): void => {
    setPrediction((current) => commitPrediction(current, candidate))
  }, [])
  const complete = useCallback((): void => setCompleted(true), [])
  const contextValue = useMemo<WidgetFrameState>(
    () => ({ locked, prediction, commit, complete }),
    [locked, prediction, commit, complete]
  )
  const status = completed ? 'DONE' : locked ? 'LOCKED' : 'READY'

  return (
    <WidgetFrameContext value={contextValue}>
      <section className="in-widget" aria-label={title}>
        <header className="in-widget-head">
          <span>{title}</span>
          <span className="in-widget-status" aria-live="polite">
            {status}
          </span>
        </header>
        {misconception ? (
          <div className="in-widget-misconception">
            Misconception nhắm tới: <strong>{misconception}</strong>
          </div>
        ) : null}
        <div className="in-widget-body">{children}</div>
      </section>
    </WidgetFrameContext>
  )
}
