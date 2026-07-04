import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

import { Counter } from '../../renderer/src/preview/Counter'
import { QuizBlock } from '../../renderer/src/preview/islands/QuizBlock'
import { EquationSlider } from '../../renderer/src/preview/islands/EquationSlider'
import { DataChart } from '../../renderer/src/preview/islands/DataChart'
import { AlgorithmVisualizer } from '../../renderer/src/preview/islands/AlgorithmVisualizer'

/**
 * Trusted components that ship with the app — same set that the live renderer
 * uses. Mapping name → component + default props is duplicated here (the
 * authoritative source lives in the renderer registry) so that the main
 * process can produce a default-props snapshot without importing a React
 * tree that pulls in Tailwind / DOM globals at runtime.
 */
interface SnapshotEntry {
  component: React.ComponentType<Record<string, unknown>>
  defaultProps: Record<string, unknown>
  /** True when the component relies on browser-only APIs that
   *  `react-dom/server` cannot satisfy (e.g. chart measurement). When true,
   *  the snapshot is replaced by a placeholder box. */
  browserOnly: boolean
}

const SNAPSHOT_REGISTRY: Record<string, SnapshotEntry> = {
  Counter: {
    component: Counter as unknown as React.ComponentType<Record<string, unknown>>,
    defaultProps: { initial: 0 },
    browserOnly: false
  },
  QuizBlock: {
    component: QuizBlock as unknown as React.ComponentType<Record<string, unknown>>,
    defaultProps: {
      question: 'Which invariant makes binary search valid?',
      options: ['The input is sorted', 'The input is random', 'The array has no duplicates'],
      answerIndex: 0,
      explanation: 'Binary search can discard half of the search space only when ordering is known.'
    },
    browserOnly: false
  },
  EquationSlider: {
    component: EquationSlider as unknown as React.ComponentType<Record<string, unknown>>,
    defaultProps: {
      formula: 'y = m * x + b',
      compute: 'm * x + b',
      variables: {
        x: { min: -10, max: 10, default: 2, step: 0.5 },
        m: { min: -5, max: 5, default: 1.5, step: 0.1 },
        b: { min: -10, max: 10, default: 1, step: 0.5 }
      }
    },
    // Recharts' ResponsiveContainer emits an empty box in SSR. The snapshot
    // therefore shows the slider controls only; the chart is replaced by a
    // labelled placeholder.
    browserOnly: true
  },
  DataChart: {
    component: DataChart as unknown as React.ComponentType<Record<string, unknown>>,
    defaultProps: {
      type: 'line',
      data: [
        { x: 1, y: 3 },
        { x: 2, y: 5 },
        { x: 3, y: 2 },
        { x: 4, y: 8 },
        { x: 5, y: 6 }
      ],
      x: 'x',
      y: 'y',
      title: 'Sample dataset'
    },
    browserOnly: true
  },
  AlgorithmVisualizer: {
    component: AlgorithmVisualizer as unknown as React.ComponentType<Record<string, unknown>>,
    defaultProps: {
      algorithm: 'binary-search',
      data: [1, 3, 4, 8, 12, 15, 20],
      target: 12,
      speed: 700
    },
    browserOnly: false
  }
}

export interface SnapshotInput {
  componentName: string
  /** Caller-supplied props from the MDX file. If provided AND the component is
   *  purely-static, we render with them. Otherwise we fall back to defaults. */
  props?: Record<string, unknown>
}

export interface SnapshotResult {
  html: string
  mode: 'snapshot' | 'placeholder'
  warnings: string[]
}

export class StaticSnapshotRenderer {
  render({ componentName, props }: SnapshotInput): SnapshotResult {
    const entry = SNAPSHOT_REGISTRY[componentName]

    if (!entry) {
      return {
        html: renderUnknownPlaceholder(componentName),
        mode: 'placeholder',
        warnings: [`Unknown registry component "${componentName}" — emitted placeholder`]
      }
    }

    if (entry.browserOnly) {
      return {
        html: renderChartPlaceholder(componentName, entry.defaultProps),
        mode: 'placeholder',
        warnings: [
          `Component "${componentName}" relies on browser measurement; static snapshot shows a placeholder instead of the live chart.`
        ]
      }
    }

    const propsToUse = sanitizeProps(props ?? entry.defaultProps)
    try {
      const markup = renderToStaticMarkup(createElement(entry.component, propsToUse))
      return {
        html: `<div class="mdx-vault-snapshot mdx-vault-snapshot-${componentName.toLowerCase()}">${markup}</div>`,
        mode: 'snapshot',
        warnings: []
      }
    } catch (error) {
      return {
        html: renderErrorPlaceholder(componentName, error),
        mode: 'placeholder',
        warnings: [`Failed to render snapshot for ${componentName}: ${formatError(error)}`]
      }
    }
  }
}

function renderChartPlaceholder(
  componentName: string,
  defaultProps: Record<string, unknown>
): string {
  const title =
    typeof defaultProps.title === 'string'
      ? defaultProps.title
      : typeof defaultProps.formula === 'string'
        ? defaultProps.formula
        : componentName
  const escapedTitle = escapeHtml(title)
  return `<div class="mdx-vault-snapshot-placeholder"><div class="mdx-vault-snapshot-placeholder-title">${escapeHtml(componentName)}</div><div class="mdx-vault-snapshot-placeholder-body">Interactive preview unavailable in static export. Title: ${escapedTitle}.</div></div>`
}

function renderUnknownPlaceholder(componentName: string): string {
  return `<div class="mdx-vault-snapshot-placeholder"><div class="mdx-vault-snapshot-placeholder-title">Unknown component: ${escapeHtml(componentName)}</div><div class="mdx-vault-snapshot-placeholder-body">Register this component before exporting.</div></div>`
}

function renderErrorPlaceholder(componentName: string, error: unknown): string {
  return `<div class="mdx-vault-snapshot-placeholder"><div class="mdx-vault-snapshot-placeholder-title">${escapeHtml(componentName)}</div><div class="mdx-vault-snapshot-placeholder-body">${escapeHtml(formatError(error))}</div></div>`
}

/**
 * Filter out props that are objects/arrays whose values aren't JSON-safe — we
 * keep the snapshot predictable by relying on defaultProps for known
 * structures (the live renderer validates the same schema). Unknown keys
 * are dropped silently.
 */
function sanitizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (isJsonSafe(value)) {
      result[key] = value
    }
  }
  return result
}

function isJsonSafe(value: unknown): boolean {
  if (value === null) {
    return true
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  if (Array.isArray(value)) {
    return value.every(isJsonSafe)
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(isJsonSafe)
  }
  return false
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
