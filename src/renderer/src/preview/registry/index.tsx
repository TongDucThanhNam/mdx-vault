import type { MDXComponents } from 'mdx/types'
import type { ComponentType } from 'react'

import { algorithmVisualizerRegistryEntry } from './algorithm-visualizer'
import { counterRegistryEntry } from './counter'
import { dataChartRegistryEntry } from './data-chart'
import { equationSliderRegistryEntry } from './equation-slider'
import { comparisonBarsRegistryEntry } from './interactive-note/comparison-bars'
import { evidenceItemRegistryEntry } from './interactive-note/evidence-item'
import { evidenceLogRegistryEntry } from './interactive-note/evidence-log'
import { formulaLineRegistryEntry } from './interactive-note/formula-line'
import { highlightBoxRegistryEntry } from './interactive-note/highlight-box'
import { mentalModelRegistryEntry } from './interactive-note/mental-model'
import { mentalModelRowRegistryEntry } from './interactive-note/mental-model-row'
import { notePrimerRegistryEntry } from './interactive-note/note-primer'
import { predictionGateRegistryEntry } from './interactive-note/prediction-gate'
import { primerTermRegistryEntry } from './interactive-note/primer-term'
import { recapRegistryEntry } from './interactive-note/recap'
import { selfTestRegistryEntry } from './interactive-note/self-test'
import { selfTestItemRegistryEntry } from './interactive-note/self-test-item'
import { traceBlockRegistryEntry } from './interactive-note/trace-block'
import { widgetFrameRegistryEntry } from './interactive-note/widget-frame'
import { ComponentValidationWarning } from './messages'
import { quizBlockRegistryEntry } from './quiz-block'
import type { ComponentRegistryEntry } from './types'

export interface RegistryInsertTemplate {
  name: string
  description: string
  category: string
  snippet: string
}

const registryEntries = [
  counterRegistryEntry,
  quizBlockRegistryEntry,
  equationSliderRegistryEntry,
  dataChartRegistryEntry,
  algorithmVisualizerRegistryEntry,
  notePrimerRegistryEntry,
  primerTermRegistryEntry,
  highlightBoxRegistryEntry,
  formulaLineRegistryEntry,
  mentalModelRegistryEntry,
  mentalModelRowRegistryEntry,
  traceBlockRegistryEntry,
  widgetFrameRegistryEntry,
  predictionGateRegistryEntry,
  recapRegistryEntry,
  selfTestRegistryEntry,
  selfTestItemRegistryEntry,
  evidenceLogRegistryEntry,
  evidenceItemRegistryEntry,
  comparisonBarsRegistryEntry
]

export const componentRegistry = registryEntries as unknown as ComponentRegistryEntry[]

export function getRegistryInsertTemplates(): RegistryInsertTemplate[] {
  return componentRegistry.flatMap((entry) =>
    entry.insertSnippet
      ? [
          {
            name: entry.name,
            description: entry.description,
            category: entry.category,
            snippet: entry.insertSnippet
          }
        ]
      : []
  )
}

export function createRegistryComponents(): MDXComponents {
  return Object.fromEntries(
    componentRegistry.map((entry) => [entry.name, createValidatedComponent(entry)])
  ) as MDXComponents
}

function createValidatedComponent<TProps extends object>(
  entry: ComponentRegistryEntry<TProps>
): ComponentType<Record<string, unknown>> {
  function ValidatedRegistryComponent(rawProps: Record<string, unknown>): React.JSX.Element {
    const mergedProps = {
      ...entry.defaultProps,
      ...rawProps
    }
    const result = entry.propsSchema.safeParse(mergedProps)

    if (!result.success) {
      return <ComponentValidationWarning componentName={entry.name} issues={result.error.issues} />
    }

    const Component = entry.component as ComponentType<TProps>

    return <Component {...result.data} />
  }

  ValidatedRegistryComponent.displayName = `Validated${entry.name}`

  return ValidatedRegistryComponent
}
