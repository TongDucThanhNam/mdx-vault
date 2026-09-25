import { evaluate } from '@mdx-js/mdx'
import { createElement, Fragment } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'

import { createCellGroups } from '../src/renderer/src/preview/islands/interactive-note/cell-grid-groups'
import {
  componentRegistry,
  createRegistryComponents,
  getRegistryInsertTemplates
} from '../src/renderer/src/preview/registry'

const spatialComponents = ['CellGrid', 'FlowSequence']

describe('GOAL-21 spatial visual components', () => {
  test('registers both components with valid insert snippets', async () => {
    const entries = componentRegistry.filter((item) => spatialComponents.includes(item.name))
    const templates = getRegistryInsertTemplates().filter((item) =>
      spatialComponents.includes(item.name)
    )
    const components = createRegistryComponents()

    expect(entries.map((item) => item.name)).toEqual(spatialComponents)
    expect(templates.map((item) => item.name)).toEqual(spatialComponents)

    for (const template of templates) {
      expect(template.category).toBe('interactive-note')
      const module = await evaluate(template.snippet, { Fragment, jsx, jsxs })
      const html = renderToStaticMarkup(createElement(module.default, { components }))

      expect(html).not.toContain(`Invalid props for ${template.name}`)
    }
  })

  test('validates CellGrid props', () => {
    const schema = entry('CellGrid').propsSchema

    expect(
      schema.safeParse({
        columns: 4,
        cells: [
          { label: '0' },
          { label: '1', state: 'current' },
          { label: '2', state: 'hit' },
          { label: '3', state: 'cached' }
        ],
        groupSize: 4,
        groupLabels: ['LINE 0'],
        caption: 'One cache line'
      }).success
    ).toBe(true)
    expect(
      schema.safeParse({
        columns: 33,
        cells: [{ label: '0', state: 'unknown' }]
      }).success
    ).toBe(false)
  })

  test('validates FlowSequence props', () => {
    const schema = entry('FlowSequence').propsSchema

    expect(
      schema.safeParse({
        nodes: [
          { label: 'Client' },
          { label: 'Resolver', sublabel: 'recursive', accent: true },
          { label: 'Authority' }
        ],
        edgeLabels: ['query', 'answer'],
        direction: 'column',
        caption: 'Resolution path'
      }).success
    ).toBe(true)
    expect(
      schema.safeParse({
        nodes: [],
        edgeLabels: ['orphan edge'],
        direction: 'diagonal'
      }).success
    ).toBe(false)
  })

  test('groups CellGrid cells sequentially and preserves optional labels', () => {
    const cells = Array.from({ length: 5 }, (_, index) => ({ label: String(index) }))

    expect(createCellGroups(cells, 2, ['A', 'B'])).toEqual([
      { cells: [{ label: '0' }, { label: '1' }], label: 'A' },
      { cells: [{ label: '2' }, { label: '3' }], label: 'B' },
      { cells: [{ label: '4' }], label: undefined }
    ])
  })

  test('renders invalid props through ComponentValidationWarning', () => {
    const components = createRegistryComponents()
    const InvalidCellGrid = components.CellGrid!
    const html = renderToStaticMarkup(createElement(InvalidCellGrid, { columns: 0, cells: [] }))

    expect(html).toContain('Invalid props for CellGrid')
  })
})

function entry(name: string): (typeof componentRegistry)[number] {
  return componentRegistry.find((item) => item.name === name)!
}
