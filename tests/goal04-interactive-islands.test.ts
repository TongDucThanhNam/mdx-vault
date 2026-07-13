import { readFile } from 'fs/promises'
import { join } from 'path'

import { createAlgorithmSteps } from '../src/renderer/src/preview/islands/AlgorithmVisualizer'
import { parseChartDataSource } from '../src/renderer/src/preview/islands/chart-data'
import { componentRegistry, getRegistryInsertTemplates } from '../src/renderer/src/preview/registry'

const goalComponents = ['QuizBlock', 'EquationSlider', 'DataChart', 'AlgorithmVisualizer']

describe('GOAL-04 interactive islands', () => {
  test('registers every island once with a valid insertion template', () => {
    const entries = componentRegistry.filter((entry) => goalComponents.includes(entry.name))
    const templates = getRegistryInsertTemplates().filter((entry) =>
      goalComponents.includes(entry.name)
    )

    expect(entries.map((entry) => entry.name)).toEqual(goalComponents)
    expect(new Set(entries.map((entry) => entry.name)).size).toBe(goalComponents.length)
    expect(templates.map((entry) => entry.name)).toEqual(goalComponents)

    for (const template of templates) {
      expect(template.snippet).toContain(`<${template.name}`)
      expect(template.snippet).toContain('/>')
    }
  })

  test('rejects invalid quiz, data chart, and binary search props', () => {
    const entry = (name: string): (typeof componentRegistry)[number] =>
      componentRegistry.find((item) => item.name === name)!

    expect(
      entry('QuizBlock').propsSchema.safeParse({
        question: 'Broken',
        options: ['Only one'],
        answerIndex: 3
      }).success
    ).toBe(false)
    expect(entry('DataChart').propsSchema.safeParse({ type: 'line', x: 'x', y: 'y' }).success).toBe(
      false
    )
    expect(
      entry('DataChart').propsSchema.safeParse({
        type: 'line',
        data: [{ x: 1, y: 2 }],
        src: 'assets/data.csv',
        x: 'x',
        y: 'y'
      }).success
    ).toBe(false)
    expect(
      entry('AlgorithmVisualizer').propsSchema.safeParse({
        algorithm: 'binary-search',
        data: [1, 2, 3]
      }).success
    ).toBe(false)
  })

  test('parses the restored CSV demo dataset', async () => {
    const sourcePath = join(process.cwd(), 'example-vault', 'assets', 'datasets', 'sample.csv')
    const data = parseChartDataSource(await readFile(sourcePath, 'utf8'), sourcePath)

    expect(data).toHaveLength(10)
    expect(data[0]).toEqual({ x: 1, y: 2 })
    expect(data[9]).toEqual({ x: 10, y: 35 })
  })

  test('produces correct binary-search pointer transitions and terminal states', () => {
    const found = createAlgorithmSteps({
      algorithm: 'binary-search',
      data: [1, 3, 4, 8, 12, 15, 20],
      target: 12
    })
    const missing = createAlgorithmSteps({
      algorithm: 'binary-search',
      data: [1, 3, 4, 8],
      target: 7
    })

    expect(found.map((step) => step.algorithm === 'binary-search' && step.status)).toEqual([
      'start',
      'compare',
      'move-low',
      'compare',
      'move-high',
      'compare',
      'found'
    ])
    expect(found[2]).toMatchObject({ low: 4, high: 6, mid: 3 })
    expect(found.at(-1)).toMatchObject({ status: 'found', mid: 4 })
    expect(missing.at(-1)).toMatchObject({ status: 'not-found', low: 3, high: 2 })
  })

  test('finishes bubble sort with an ordered list', () => {
    const steps = createAlgorithmSteps({ algorithm: 'bubble-sort', data: [5, 1, 4, 2, 8] })

    expect(steps.at(-1)).toMatchObject({ values: [1, 2, 4, 5, 8], sortedFrom: 0 })
    expect(steps.some((step) => step.algorithm === 'bubble-sort' && step.swapped)).toBe(true)
  })
})
