import type { ComponentType } from 'react'
import type { MDXComponents } from 'mdx/types'

import { counterRegistryEntry } from './counter'
import { ComponentValidationWarning } from './messages'
import type { ComponentRegistryEntry } from './types'

export const componentRegistry = [counterRegistryEntry]

export function createRegistryComponents(): MDXComponents {
  return Object.fromEntries(
    componentRegistry.map((entry) => [entry.name, createValidatedComponent(entry)])
  ) as MDXComponents
}

function createValidatedComponent(
  entry: ComponentRegistryEntry
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

    const Component = entry.component as ComponentType<Record<string, unknown>>

    return <Component {...result.data} />
  }

  ValidatedRegistryComponent.displayName = `Validated${entry.name}`

  return ValidatedRegistryComponent
}
