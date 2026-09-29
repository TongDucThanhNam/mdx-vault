import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { createRegistryComponents } from '../src/renderer/src/preview/registry'

describe('GOAL-34 stable preview component map', () => {
  test('retains island component identity while reading the current rendered source', () => {
    let source = '# First'
    const components = createRegistryComponents({ source: () => source })
    const Counter = components.Counter as (props: Record<string, unknown>) => ReactElement
    const first = Counter({})

    source = '# Updated'
    const second = Counter({})

    expect(components.Counter).toBe(Counter)
    expect(first.type).toBe(second.type)
    expect(first.props.source).toBe('# First')
    expect(second.props.source).toBe('# Updated')
  })
})
