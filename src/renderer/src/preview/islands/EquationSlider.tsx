import { AlertTriangle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { evaluateMathExpression, parseMathExpression } from '../../../../shared/math-expression'

export interface EquationVariableConfig {
  min: number
  max: number
  default: number
  step: number
}

export interface EquationSliderProps {
  formula: string
  variables: Record<string, EquationVariableConfig>
  compute?: string
}

interface ChartPoint {
  input: number
  result: number
}

interface VariableValueState {
  signature: string
  values: Record<string, number>
}

type ParsedExpression =
  | {
      ok: true
      expression: ReturnType<typeof parseMathExpression>
    }
  | {
      ok: false
      message: string
    }

type EvaluationResult =
  | {
      ok: true
      value: number
    }
  | {
      ok: false
      message: string
    }

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 4
})

export function EquationSlider({
  formula,
  variables,
  compute
}: EquationSliderProps): React.JSX.Element {
  const variableEntries = useMemo(() => Object.entries(variables), [variables])
  const variableSignature = useMemo(
    () => createVariableSignature(variableEntries),
    [variableEntries]
  )
  const fallbackValues = useMemo(() => createInitialValues(variableEntries), [variableEntries])
  const expressionSource = useMemo(() => getExpressionSource(formula, compute), [formula, compute])
  const parsedExpression = useMemo(
    () => parseExpressionSafely(expressionSource),
    [expressionSource]
  )
  const [valueState, setValueState] = useState<VariableValueState>(() => ({
    signature: variableSignature,
    values: fallbackValues
  }))
  const values = valueState.signature === variableSignature ? valueState.values : fallbackValues

  const result = useMemo<EvaluationResult>(() => {
    if (!parsedExpression.ok) {
      return {
        ok: false,
        message: parsedExpression.message
      }
    }

    try {
      return {
        ok: true,
        value: evaluateMathExpression(parsedExpression.expression, values)
      }
    } catch (error) {
      return {
        ok: false,
        message: formatError(error)
      }
    }
  }, [parsedExpression, values])
  const errorMessage = !parsedExpression.ok
    ? parsedExpression.message
    : result.ok
      ? null
      : result.message

  const chartVariable = variableEntries[0] ?? null
  const chartData = useMemo(() => {
    if (!parsedExpression.ok || !chartVariable) {
      return []
    }

    return sampleChartPoints(parsedExpression.expression, chartVariable, values)
  }, [chartVariable, parsedExpression, values])

  const handleVariableChange = useCallback(
    (name: string, value: number) => {
      setValueState((currentState) => {
        const currentValues =
          currentState.signature === variableSignature ? currentState.values : fallbackValues

        return {
          signature: variableSignature,
          values: {
            ...currentValues,
            [name]: value
          }
        }
      })
    },
    [fallbackValues, variableSignature]
  )

  return (
    <section className="my-5 border-2 border-foreground bg-background p-4 shadow-[3px_3px_0_0_var(--foreground)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Equation slider
          </div>
          <div className="mt-1 font-mono text-lg font-bold">{formula}</div>
        </div>
        <div className="border-2 border-foreground bg-[var(--editorial-blue)] px-3 py-2 text-right text-[var(--note-on-solid)] shadow-[2px_2px_0_0_var(--foreground)]">
          <div className="font-mono text-xs font-bold uppercase tracking-[0.15em]">Result</div>
          <div className="font-mono text-2xl font-bold tabular-nums">
            {result.ok ? numberFormatter.format(result.value) : 'Error'}
          </div>
        </div>
      </div>

      {errorMessage ? <EquationError message={errorMessage} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(260px,1.1fr)]">
        <div className="space-y-3">
          {variableEntries.map(([name, config]) => (
            <label key={name} className="block border-2 border-foreground bg-card px-3 py-2.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-mono text-sm font-bold">{name}</span>
                <span className="font-mono text-sm tabular-nums text-[var(--editorial-red)]">
                  {numberFormatter.format(values[name] ?? config.default)}
                </span>
              </div>
              <input
                type="range"
                min={config.min}
                max={config.max}
                step={config.step}
                value={values[name] ?? config.default}
                className="w-full accent-[var(--editorial-red)]"
                onChange={(event) => handleVariableChange(name, Number(event.currentTarget.value))}
              />
              <div className="mt-1 flex justify-between font-mono text-xs text-muted-foreground">
                <span>{numberFormatter.format(config.min)}</span>
                <span>{numberFormatter.format(config.max)}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="min-w-0 border-2 border-foreground bg-card p-3">
          <div className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            {chartVariable ? `Result as ${chartVariable[0]} changes` : 'Mini chart'}
          </div>
          <div className="h-56 min-w-0">
            {chartData.length > 0 && chartVariable ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="input"
                    type="number"
                    tick={{ fontSize: 12 }}
                    stroke="var(--muted-foreground)"
                    domain={[chartVariable[1].min, chartVariable[1].max]}
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" width={44} />
                  <Tooltip
                    contentStyle={{
                      border: '2px solid var(--note-ink)',
                      borderRadius: 0,
                      background: 'var(--note-paper)',
                      boxShadow: 'var(--note-shadow-sm)',
                      color: 'var(--note-ink)',
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: 12
                    }}
                    formatter={(value) => numberFormatter.format(Number(value))}
                    labelFormatter={(value) =>
                      `${chartVariable[0]} = ${numberFormatter.format(Number(value))}`
                    }
                  />
                  <ReferenceLine
                    x={values[chartVariable[0]] ?? chartVariable[1].default}
                    stroke="var(--chart-1)"
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="result"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Adjust variables after fixing the expression.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function EquationError({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="mb-3 flex items-start gap-2 border-2 border-destructive bg-background px-3 py-2 font-mono text-[12px] uppercase tracking-wider text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{message}</div>
    </div>
  )
}

function parseExpressionSafely(source: string): ParsedExpression {
  try {
    return {
      ok: true,
      expression: parseMathExpression(source)
    }
  } catch (error) {
    return {
      ok: false,
      message: formatError(error)
    }
  }
}

function getExpressionSource(formula: string, compute: string | undefined): string {
  const explicitCompute = compute?.trim()

  if (explicitCompute) {
    return explicitCompute
  }

  const equalsIndex = formula.lastIndexOf('=')

  if (equalsIndex >= 0) {
    const rightHandSide = formula.slice(equalsIndex + 1).trim()

    if (rightHandSide) {
      return rightHandSide
    }
  }

  return formula.trim()
}

function createInitialValues(
  entries: Array<[string, EquationVariableConfig]>
): Record<string, number> {
  return Object.fromEntries(entries.map(([name, config]) => [name, config.default]))
}

function createVariableSignature(entries: Array<[string, EquationVariableConfig]>): string {
  return entries
    .map(([name, config]) => `${name}:${config.min}:${config.max}:${config.default}:${config.step}`)
    .join('|')
}

function sampleChartPoints(
  expression: ReturnType<typeof parseMathExpression>,
  chartVariable: [string, EquationVariableConfig],
  values: Record<string, number>
): ChartPoint[] {
  const [variableName, config] = chartVariable
  const samples = 41
  const width = config.max - config.min
  const points: ChartPoint[] = []

  for (let index = 0; index < samples; index += 1) {
    const input = config.min + (width * index) / (samples - 1)

    try {
      points.push({
        input,
        result: evaluateMathExpression(expression, {
          ...values,
          [variableName]: input
        })
      })
    } catch {
      return []
    }
  }

  return points
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
