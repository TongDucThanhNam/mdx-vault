import { useState } from 'react'

import { commitPrediction } from './prediction-state'
import { useWidgetFrameState } from './widget-frame-context'

export interface PredictionGateProps {
  question: string
  options: string[]
  answer?: string
  explain?: string
}

export function PredictionGate({
  question,
  options,
  answer,
  explain
}: PredictionGateProps): React.JSX.Element {
  const widgetFrame = useWidgetFrameState()
  const [standalonePrediction, setStandalonePrediction] = useState<string | null>(null)
  const prediction = widgetFrame?.prediction ?? standalonePrediction
  const hasCommitted = prediction !== null
  const isCorrect = answer !== undefined && prediction === answer

  const choose = (candidate: string): void => {
    if (widgetFrame) {
      widgetFrame.commit(candidate)
      return
    }

    setStandalonePrediction((current) => commitPrediction(current, candidate))
  }

  return (
    <section className="in-gate" aria-label="Prediction gate">
      <div className="in-gate-question">
        <strong>Dự đoán trước:</strong> {question}
      </div>
      <div className="in-gate-options" role="radiogroup" aria-label={question}>
        {options.map((option, index) => {
          const chosen = prediction === option

          return (
            <button
              className={chosen ? 'in-button in-gate-option-chosen' : 'in-button'}
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={hasCommitted}
              key={`${option}-${index}`}
              onClick={() => choose(option)}
            >
              {option}
            </button>
          )
        })}
      </div>
      {hasCommitted && answer !== undefined ? (
        <div className="in-gate-verdict" aria-live="polite">
          {isCorrect ? (
            <>
              <span className="in-verdict-right">Đúng — {prediction}.</span>{' '}
            </>
          ) : (
            <>
              Bạn chọn <span className="in-verdict-wrong">{prediction}</span>. Đáp án đúng là{' '}
              <span className="in-verdict-right">{answer}</span>.{' '}
            </>
          )}
          {explain}
        </div>
      ) : null}
    </section>
  )
}
