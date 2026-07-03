import type { ComponentType } from 'react'
import type { MDXComponents } from 'mdx/types'

import { algorithmVisualizerRegistryEntry } from './algorithm-visualizer'
import { counterRegistryEntry } from './counter'
import { dataChartRegistryEntry } from './data-chart'
import { equationSliderRegistryEntry } from './equation-slider'
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
  algorithmVisualizerRegistryEntry
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
