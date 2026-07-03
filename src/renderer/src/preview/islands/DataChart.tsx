import { AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { usePreviewRuntime } from '../runtime'
import { assertChartDataArray, parseChartDataSource, type ChartDatum } from './chart-data'

export type DataChartType = 'line' | 'bar' | 'scatter'

export interface DataChartProps {
  type: DataChartType
  data?: ChartDatum[]
  src?: string
  x: string
  y: string
  title?: string
}

type RemoteDataState =
  | {
      status: 'idle'
    }
  | {
      status: 'ready'
      path: string
      data: ChartDatum[]
    }
  | {
      status: 'error'
      path: string
      message: string
    }

type DatasetResolution =
  | {
      status: 'none'
    }
  | {
      status: 'ready'
      path: string
    }
  | {
      status: 'error'
      message: string
    }

export function DataChart({ type, data, src, x, y, title }: DataChartProps): React.JSX.Element {
  const { selectedPath } = usePreviewRuntime()
  const inlineData = useMemo(() => (data ? assertChartDataArray(data) : null), [data])
  const datasetResolution = useMemo(
    () => resolveDatasetPathSafely(selectedPath, src),
    [selectedPath, src]
  )
  const [remoteData, setRemoteData] = useState<RemoteDataState>({
    status: 'idle'
  })

  useEffect(() => {
    if (inlineData || datasetResolution.status !== 'ready') {
      return
    }

    let cancelled = false
    const resolvedPath = datasetResolution.path

    void window.vaultApi
      .readAssetFile(resolvedPath)
      .then((content) => {
        if (cancelled) {
          return
        }

        setRemoteData({
          status: 'ready',
          path: resolvedPath,
          data: parseChartDataSource(content, resolvedPath)
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setRemoteData({
          status: 'error',
          path: resolvedPath,
          message: `Could not load dataset "${src}": ${formatError(error)}`
        })
      })

    return () => {
      cancelled = true
    }
  }, [datasetResolution, inlineData, src])

  const remoteDataMatches =
    datasetResolution.status === 'ready' &&
    remoteData.status === 'ready' &&
    remoteData.path === datasetResolution.path
  const remoteErrorMatches =
    datasetResolution.status === 'ready' &&
    remoteData.status === 'error' &&
    remoteData.path === datasetResolution.path
  const chartData = inlineData ?? (remoteDataMatches ? remoteData.data : null)
  const validationError = chartData ? getChartValidationError(chartData, x, y, type) : null
  const loadError =
    datasetResolution.status === 'error'
      ? datasetResolution.message
      : remoteErrorMatches
        ? remoteData.message
        : null

  return (
    <section className="my-5 rounded-md border bg-background p-4 shadow-xs">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Data chart</div>
          <div className="mt-1 text-base font-semibold">{title ?? `${y} by ${x}`}</div>
        </div>
        {src ? (
          <div className="max-w-full truncate rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground">
            {src}
          </div>
        ) : null}
      </div>

      {loadError ? (
        <DataChartError message={loadError} />
      ) : validationError ? (
        <DataChartError message={validationError} />
      ) : chartData ? (
        <div className="h-72 min-w-0 rounded-md border bg-card p-3">
          {renderChart({
            type,
            data: chartData,
            x,
            y
          })}
        </div>
      ) : src && datasetResolution.status === 'ready' ? (
        <div className="flex h-64 items-center justify-center rounded-md border bg-card text-sm text-muted-foreground">
          Loading {datasetResolution.path}
        </div>
      ) : (
        <DataChartError message="DataChart needs either inline data or a dataset src." />
      )}
    </section>
  )
}

function DataChartError({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-md border border-destructive/35 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
      <div>
        <AlertTriangle className="mx-auto mb-2 size-5" aria-hidden="true" />
        <div className="font-medium">Chart unavailable</div>
        <div className="mt-1 max-w-lg">{message}</div>
      </div>
    </div>
  )
}

function renderChart({
  type,
  data,
  x,
  y
}: {
  type: DataChartType
  data: ChartDatum[]
  x: string
  y: string
}): React.JSX.Element {
  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          {renderGridAndAxes({ x, y, scatter: false })}
          <Bar dataKey={y} fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          {renderGridAndAxes({ x, y, scatter: true })}
          <Scatter data={data} dataKey={y} fill="var(--chart-2)" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        {renderGridAndAxes({ x, y, scatter: false })}
        <Line
          type="monotone"
          dataKey={y}
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={{ r: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function renderGridAndAxes({
  x,
  y,
  scatter
}: {
  x: string
  y: string
  scatter: boolean
}): React.JSX.Element {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis
        dataKey={x}
        type={scatter ? 'number' : undefined}
        tick={{ fontSize: 11 }}
        stroke="var(--muted-foreground)"
      />
      <YAxis
        dataKey={y}
        type="number"
        tick={{ fontSize: 11 }}
        stroke="var(--muted-foreground)"
        width={44}
      />
      <Tooltip />
    </>
  )
}

function getChartValidationError(
  data: ChartDatum[],
  x: string,
  y: string,
  type: DataChartType
): string | null {
  if (data.length === 0) {
    return 'Dataset is empty.'
  }

  const missingX = data.findIndex((row) => !(x in row))
  const missingY = data.findIndex((row) => !(y in row))

  if (missingX >= 0) {
    return `Field "${x}" is missing from row ${missingX + 1}.`
  }

  if (missingY >= 0) {
    return `Field "${y}" is missing from row ${missingY + 1}.`
  }

  const nonNumericY = data.findIndex((row) => typeof row[y] !== 'number')

  if (nonNumericY >= 0) {
    return `Field "${y}" must be numeric for chart rendering. Row ${nonNumericY + 1} is not numeric.`
  }

  if (type === 'scatter') {
    const nonNumericX = data.findIndex((row) => typeof row[x] !== 'number')

    if (nonNumericX >= 0) {
      return `Field "${x}" must be numeric for scatter charts. Row ${nonNumericX + 1} is not numeric.`
    }
  }

  return null
}

function resolveDatasetPath(selectedPath: string | null, sourcePath: string): string {
  const normalizedSource = sourcePath.trim().replaceAll('\\', '/')

  if (!normalizedSource) {
    throw new Error('Dataset src cannot be empty')
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedSource) || normalizedSource.startsWith('/')) {
    throw new Error('Dataset src must be a vault-relative path')
  }

  const sourceSegments =
    normalizedSource.startsWith('.') && selectedPath
      ? [...selectedPath.split('/').slice(0, -1), ...normalizedSource.split('/')]
      : normalizedSource.split('/')

  const resolvedSegments: string[] = []

  for (const segment of sourceSegments) {
    if (!segment || segment === '.') {
      continue
    }

    if (segment === '..') {
      if (resolvedSegments.length === 0) {
        resolvedSegments.push('..')
      } else {
        resolvedSegments.pop()
      }
      continue
    }

    resolvedSegments.push(segment)
  }

  return resolvedSegments.join('/')
}

function resolveDatasetPathSafely(
  selectedPath: string | null,
  sourcePath: string | undefined
): DatasetResolution {
  if (!sourcePath) {
    return {
      status: 'none'
    }
  }

  try {
    return {
      status: 'ready',
      path: resolveDatasetPath(selectedPath, sourcePath)
    }
  } catch (error) {
    return {
      status: 'error',
      message: formatError(error)
    }
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
