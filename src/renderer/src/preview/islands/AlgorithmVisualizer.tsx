import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type AlgorithmName = 'binary-search' | 'bubble-sort'

export interface AlgorithmVisualizerProps {
  algorithm: AlgorithmName
  data: number[]
  target?: number
  speed?: number
}

export type AlgorithmStep =
  | {
      algorithm: 'binary-search'
      values: number[]
      low: number
      high: number
      mid: number | null
      status: 'start' | 'compare' | 'move-low' | 'move-high' | 'found' | 'not-found'
      description: string
    }
  | {
      algorithm: 'bubble-sort'
      values: number[]
      compare: [number, number] | null
      sortedFrom: number
      swapped: boolean
      description: string
    }

export function AlgorithmVisualizer({
  algorithm,
  data,
  target,
  speed = 700
}: AlgorithmVisualizerProps): React.JSX.Element {
  const steps = useMemo(
    () => createAlgorithmSteps({ algorithm, data, target }),
    [algorithm, data, target]
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const safeStepIndex = Math.min(stepIndex, steps.length - 1)
  const currentStep = steps[safeStepIndex] ?? steps[0]
  const atEnd = safeStepIndex >= steps.length - 1
  const effectivePlaying = playing && !atEnd

  useEffect(() => {
    if (!effectivePlaying) {
      return
    }

    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= steps.length - 1) {
          window.clearInterval(timer)
          return current
        }

        return current + 1
      })
    }, speed)

    return () => {
      window.clearInterval(timer)
    }
  }, [effectivePlaying, speed, steps.length])

  const handleStep = useCallback(() => {
    setPlaying(false)
    setStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }, [steps.length])

  const handleReset = useCallback(() => {
    setPlaying(false)
    setStepIndex(0)
  }, [])

  return (
    <section className="my-5 border-2 border-foreground bg-background p-4 shadow-[3px_3px_0_0_var(--foreground)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Algorithm visualizer
          </div>
          <div className="mt-1 font-display text-lg font-bold">
            {algorithm === 'binary-search' ? 'Binary search' : 'Bubble sort'}
          </div>
        </div>
        <div className="border-2 border-foreground bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
          Step {safeStepIndex + 1} / {steps.length}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={atEnd}
          onClick={() => setPlaying((current) => !current)}
        >
          {effectivePlaying ? (
            <Pause className="size-4" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
          {effectivePlaying ? 'Pause' : 'Play'}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={atEnd} onClick={handleStep}>
          <StepForward className="size-4" aria-hidden="true" />
          Step
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleReset}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset
        </Button>
      </div>

      <div className="border-2 border-foreground bg-card p-3">
        {currentStep.algorithm === 'binary-search' ? (
          <BinarySearchView step={currentStep} target={target} />
        ) : (
          <BubbleSortView step={currentStep} />
        )}
      </div>

      <div className="mt-3 border-2 border-foreground bg-muted px-3 py-2 text-sm italic">
        {currentStep.description}
      </div>
    </section>
  )
}

function BinarySearchView({
  step,
  target
}: {
  step: Extract<AlgorithmStep, { algorithm: 'binary-search' }>
  target: number | undefined
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="border-2 border-foreground bg-background px-2 py-1">
          target: {target ?? 'not set'}
        </span>
        <PointerBadge label="low" value={step.low} />
        <PointerBadge label="mid" value={step.mid} />
        <PointerBadge label="high" value={step.high} />
      </div>
      <div className="flex flex-wrap gap-2">
        {step.values.map((value, index) => {
          const labels = getBinarySearchLabels(step, index)

          return (
            <div
              key={`${value}-${index}`}
              className={cn(
                'min-w-12 flex-1 basis-12 border-2 border-foreground bg-background px-2 py-2 text-center',
                index < step.low || index > step.high ? 'opacity-35' : 'bg-muted',
                step.mid === index &&
                  'border-[var(--editorial-red)] bg-[var(--editorial-red)] text-white'
              )}
            >
              <div className="min-h-4 font-mono text-xs font-bold uppercase text-muted-foreground">
                {labels.join(' ')}
              </div>
              <div className="font-mono text-base font-bold tabular-nums">{value}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{index}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BubbleSortView({
  step
}: {
  step: Extract<AlgorithmStep, { algorithm: 'bubble-sort' }>
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {step.values.map((value, index) => {
        const comparing = step.compare?.includes(index) ?? false
        const sorted = index >= step.sortedFrom

        return (
          <div
            key={`${value}-${index}`}
            className="flex min-w-10 flex-1 basis-10 flex-col items-center gap-2"
          >
            <div
              className={cn(
                'w-full border-2 border-foreground bg-background px-2 py-2 text-center font-mono text-sm font-bold tabular-nums',
                comparing && 'border-[var(--editorial-red)] bg-[var(--editorial-red)] text-white',
                sorted && 'border-[var(--success)] bg-[var(--success)] text-white'
              )}
              style={{ minHeight: `${Math.max(36, Math.min(120, Math.abs(value) * 4))}px` }}
            >
              {value}
            </div>
            <div className="font-mono text-xs text-muted-foreground">{index}</div>
          </div>
        )
      })}
    </div>
  )
}

function PointerBadge({
  label,
  value
}: {
  label: string
  value: number | null
}): React.JSX.Element {
  return (
    <span className="border-2 border-foreground bg-background px-2 py-1">
      {label}: {value ?? '-'}
    </span>
  )
}

// The pure step builder is exported from its owning module for deterministic regression tests.
// biome-ignore lint/style/useComponentExportOnlyModules: Pure helper export is required by regression tests.
export function createAlgorithmSteps({
  algorithm,
  data,
  target
}: {
  algorithm: AlgorithmName
  data: number[]
  target?: number
}): AlgorithmStep[] {
  if (algorithm === 'bubble-sort') {
    return createBubbleSortSteps(data)
  }

  return createBinarySearchSteps(data, target)
}

function createBinarySearchSteps(data: number[], target: number | undefined): AlgorithmStep[] {
  const firstStep: Extract<AlgorithmStep, { algorithm: 'binary-search' }> = {
    algorithm: 'binary-search',
    values: data,
    low: 0,
    high: data.length - 1,
    mid: null,
    status: 'start',
    description: 'Start with the full sorted range.'
  }
  const steps: AlgorithmStep[] = [firstStep]

  if (target === undefined) {
    return [
      {
        ...firstStep,
        status: 'not-found',
        description: 'Binary search needs a target value.'
      }
    ]
  }

  let low = 0
  let high = data.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const value = data[mid]

    steps.push({
      algorithm: 'binary-search',
      values: data,
      low,
      high,
      mid,
      status: 'compare',
      description: `Compare middle value ${value} at index ${mid} with target ${target}.`
    })

    if (value === target) {
      steps.push({
        algorithm: 'binary-search',
        values: data,
        low,
        high,
        mid,
        status: 'found',
        description: `Found ${target} at index ${mid}.`
      })
      return steps
    }

    if (value < target) {
      low = mid + 1
      steps.push({
        algorithm: 'binary-search',
        values: data,
        low,
        high,
        mid,
        status: 'move-low',
        description: `${value} is smaller than ${target}, so discard the left half.`
      })
    } else {
      high = mid - 1
      steps.push({
        algorithm: 'binary-search',
        values: data,
        low,
        high,
        mid,
        status: 'move-high',
        description: `${value} is larger than ${target}, so discard the right half.`
      })
    }
  }

  steps.push({
    algorithm: 'binary-search',
    values: data,
    low,
    high,
    mid: null,
    status: 'not-found',
    description: `${target} is not in the array because low moved past high.`
  })

  return steps
}

function createBubbleSortSteps(data: number[]): AlgorithmStep[] {
  const values = [...data]
  const steps: AlgorithmStep[] = [
    {
      algorithm: 'bubble-sort',
      values: [...values],
      compare: null,
      sortedFrom: values.length,
      swapped: false,
      description: 'Start with the unsorted list.'
    }
  ]

  for (let pass = 0; pass < values.length - 1; pass += 1) {
    for (let index = 0; index < values.length - pass - 1; index += 1) {
      const left = values[index]
      const right = values[index + 1]
      const shouldSwap = left > right

      steps.push({
        algorithm: 'bubble-sort',
        values: [...values],
        compare: [index, index + 1],
        sortedFrom: values.length - pass,
        swapped: false,
        description: `Compare ${left} and ${right}.`
      })

      if (shouldSwap) {
        values[index] = right
        values[index + 1] = left
        steps.push({
          algorithm: 'bubble-sort',
          values: [...values],
          compare: [index, index + 1],
          sortedFrom: values.length - pass,
          swapped: true,
          description: `Swap ${left} and ${right} because ${left} is larger.`
        })
      }
    }
  }

  steps.push({
    algorithm: 'bubble-sort',
    values: [...values],
    compare: null,
    sortedFrom: 0,
    swapped: false,
    description: 'The list is sorted.'
  })

  return steps
}

function getBinarySearchLabels(
  step: Extract<AlgorithmStep, { algorithm: 'binary-search' }>,
  index: number
): string[] {
  const labels: string[] = []

  if (step.low === index) {
    labels.push('low')
  }

  if (step.mid === index) {
    labels.push('mid')
  }

  if (step.high === index) {
    labels.push('high')
  }

  return labels
}
