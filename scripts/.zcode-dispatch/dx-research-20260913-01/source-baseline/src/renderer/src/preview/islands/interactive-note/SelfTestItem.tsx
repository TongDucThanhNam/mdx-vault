import { type ReactNode, useId, useState } from 'react'

export interface SelfTestItemProps {
  level: 3 | 4 | 5
  question: string
  children: ReactNode
}

export function SelfTestItem({ level, question, children }: SelfTestItemProps): React.JSX.Element {
  const [revealed, setRevealed] = useState(false)
  const answerId = useId()

  return (
    <article className="in-question">
      <div className="in-question-head">
        <span className="in-question-level">Mức {level}</span>
        <span>{question}</span>
      </div>
      <div className="in-question-actions">
        <button
          className="in-button"
          type="button"
          aria-controls={answerId}
          aria-expanded={revealed}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? 'Ẩn đáp án' : 'Hiện đáp án'}
        </button>
      </div>
      {revealed ? (
        <div className="in-question-answer" id={answerId}>
          {children}
        </div>
      ) : null}
    </article>
  )
}
