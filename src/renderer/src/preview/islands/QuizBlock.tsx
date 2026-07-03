import { CheckCircle2, Circle, XCircle } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

export interface QuizBlockProps {
  question: string
  options: string[]
  answerIndex: number
  explanation?: string
}

export function QuizBlock({
  question,
  options,
  answerIndex,
  explanation
}: QuizBlockProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const hasAnswered = selectedIndex !== null
  const selectedCorrect = selectedIndex === answerIndex

  return (
    <section className="my-5 rounded-md border bg-background p-4 shadow-xs">
      <div className="mb-3">
        <div className="text-xs font-medium uppercase text-muted-foreground">
          Check understanding
        </div>
        <div className="mt-1 text-base font-semibold leading-snug">{question}</div>
      </div>

      <div role="radiogroup" aria-label={question} className="grid gap-2">
        {options.map((option, index) => {
          const isSelected = selectedIndex === index
          const isCorrectAnswer = index === answerIndex
          const shouldShowCorrect = hasAnswered && isCorrectAnswer
          const shouldShowWrong = hasAnswered && isSelected && !isCorrectAnswer

          return (
            <button
              key={`${option}-${index}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={cn(
                'flex w-full items-start gap-3 rounded-md border bg-card px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                isSelected && 'border-primary bg-primary/5',
                shouldShowCorrect && 'border-emerald-500/60 bg-emerald-500/10',
                shouldShowWrong && 'border-destructive/60 bg-destructive/10'
              )}
              onClick={() => setSelectedIndex(index)}
            >
              <QuizOptionIcon
                selected={isSelected}
                correct={shouldShowCorrect}
                wrong={shouldShowWrong}
              />
              <span className="min-w-0">{option}</span>
            </button>
          )
        })}
      </div>

      {hasAnswered ? (
        <div
          className={cn(
            'mt-3 rounded-md border px-3 py-2 text-sm',
            selectedCorrect
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
              : 'border-destructive/35 bg-destructive/10 text-destructive'
          )}
        >
          <div className="flex items-center gap-2 font-medium">
            {selectedCorrect ? (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            ) : (
              <XCircle className="size-4" aria-hidden="true" />
            )}
            {selectedCorrect ? 'Correct' : `Not quite. Correct answer: ${options[answerIndex]}`}
          </div>
          {explanation ? <div className="mt-1 text-sm opacity-90">{explanation}</div> : null}
        </div>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground">
          Pick an answer to get immediate feedback.
        </div>
      )}
    </section>
  )
}

function QuizOptionIcon({
  selected,
  correct,
  wrong
}: {
  selected: boolean
  correct: boolean
  wrong: boolean
}): React.JSX.Element {
  if (correct) {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
  }

  if (wrong) {
    return <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
  }

  return (
    <Circle
      className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground', selected && 'text-primary')}
      aria-hidden="true"
    />
  )
}
