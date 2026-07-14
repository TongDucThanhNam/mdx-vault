import { compile, evaluate } from '@mdx-js/mdx'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { createElement, Fragment } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'

import { VaultService } from '../src/main/services/vault-service'
import { commitPrediction } from '../src/renderer/src/preview/islands/interactive-note/prediction-state'
import { isInteractiveNoteTheme } from '../src/renderer/src/preview/preview-metadata'
import {
  componentRegistry,
  createRegistryComponents,
  getRegistryInsertTemplates
} from '../src/renderer/src/preview/registry'

const interactiveNoteComponents = [
  'NotePrimer',
  'PrimerTerm',
  'HighlightBox',
  'FormulaLine',
  'MentalModel',
  'MentalModelRow',
  'TraceBlock',
  'WidgetFrame',
  'PredictionGate',
  'Recap',
  'SelfTest',
  'SelfTestItem',
  'EvidenceLog',
  'EvidenceItem',
  'ComparisonBars'
]

describe('GOAL-17 interactive note kit', () => {
  test('commits the first prediction and ignores later candidates', () => {
    const firstCommit = commitPrediction(null, '100%')
    const attemptedChange = commitPrediction(firstCommit, '25%')

    expect(firstCommit).toBe('100%')
    expect(attemptedChange).toBe('100%')
  })

  test('activates the prose theme only for the exact frontmatter opt-in', () => {
    expect(isInteractiveNoteTheme({ theme: 'interactive-note' })).toBe(true)
    expect(isInteractiveNoteTheme({})).toBe(false)
    expect(isInteractiveNoteTheme({ theme: 'dark' })).toBe(false)
    expect(isInteractiveNoteTheme({ theme: ['interactive-note'] })).toBe(false)
  })

  test('registers every component once with an insertable snippet', () => {
    const entries = componentRegistry.filter((entry) =>
      interactiveNoteComponents.includes(entry.name)
    )
    const templates = getRegistryInsertTemplates().filter((entry) =>
      interactiveNoteComponents.includes(entry.name)
    )

    expect(entries.map((entry) => entry.name)).toEqual(interactiveNoteComponents)
    expect(new Set(entries.map((entry) => entry.name)).size).toBe(interactiveNoteComponents.length)
    expect(templates.map((entry) => entry.name)).toEqual(interactiveNoteComponents)

    for (const template of templates) {
      expect(template.category).toBe('interactive-note')
      expect(template.snippet).toContain(`<${template.name}`)
    }
  })

  test('compiles and renders every insert snippet with valid registry props', async () => {
    const templates = getRegistryInsertTemplates().filter((entry) =>
      interactiveNoteComponents.includes(entry.name)
    )
    const components = createRegistryComponents()

    for (const template of templates) {
      const module = await evaluate(template.snippet, { Fragment, jsx, jsxs })
      const html = renderToStaticMarkup(createElement(module.default, { components }))

      expect(html).not.toContain(`Invalid props for ${template.name}`)
    }
  })

  test('validates PredictionGate props and rejects inconsistent answers', () => {
    const schema = entry('PredictionGate').propsSchema

    expect(
      schema.safeParse({
        question: 'What is the miss ratio?',
        options: ['25%', '50%', '100%'],
        answer: '100%',
        explain: 'Every access touches a different line.'
      }).success
    ).toBe(true)
    expect(
      schema.safeParse({
        question: 'What is the miss ratio?',
        options: ['25%', '50%'],
        answer: '100%'
      }).success
    ).toBe(false)
  })

  test('validates WidgetFrame and SelfTestItem props', () => {
    expect(
      entry('WidgetFrame').propsSchema.safeParse({
        title: 'Stride explorer',
        misconception: 'Regular access is always cache-friendly.',
        children: 'Gate content'
      }).success
    ).toBe(true)
    expect(
      entry('WidgetFrame').propsSchema.safeParse({
        title: '',
        children: 'Gate content'
      }).success
    ).toBe(false)

    expect(
      entry('SelfTestItem').propsSchema.safeParse({
        level: 4,
        question: 'Where does the tradeoff reverse?',
        children: 'Answer'
      }).success
    ).toBe(true)
    expect(
      entry('SelfTestItem').propsSchema.safeParse({
        level: 2,
        question: 'Too easy',
        children: 'Answer'
      }).success
    ).toBe(false)
  })

  test('validates ComparisonBars values', () => {
    const schema = entry('ComparisonBars').propsSchema

    expect(
      schema.safeParse({
        items: [
          { label: 'Row-major', value: 4 },
          { label: 'Column-major', value: 16, display: '16 misses', bad: true }
        ],
        caption: 'Line fills'
      }).success
    ).toBe(true)
    expect(schema.safeParse({ items: [{ label: 'Impossible', value: -1 }] }).success).toBe(false)
  })

  test('renders the vault template and compiles the resulting MDX', async () => {
    const vault = new VaultService(join(process.cwd(), 'example-vault'))
    const templates = await vault.listTemplates()
    const rendered = await vault.renderTemplate('templates/interactive-note.mdx', 'Locality Notes')

    expect(templates).toContainEqual({
      relativePath: 'templates/interactive-note.mdx',
      name: 'interactive-note'
    })
    expect(rendered).toContain('title: Locality Notes')
    expect(rendered).toContain('# Locality Notes')
    expect(rendered).not.toContain('{{title}}')
    await expect(
      compile(rendered, { remarkPlugins: [remarkGfm, remarkFrontmatter] })
    ).resolves.toBeDefined()
  })

  test('compiles the full cache note with every source content section present', async () => {
    const notePath = join(process.cwd(), 'example-vault', 'notes', 'Cache Hierarchy & Locality.mdx')
    const source = await readFile(notePath, 'utf8')
    const requiredSections = [
      'One-liner [T]',
      'Mental Model [T]',
      'Mechanism [T]',
      'Row-major là gì — RAM không có 2 chiều [T]',
      'Row vs Col — cùng O(N²), khác số phận [W]',
      'Tradeoffs [T]',
      'Stride Explorer — locality chết ở stride nào? [W]',
      'Failure Modes [T]',
      'Evidence Log — máy của tôi [E]',
      'Self-test [Q]',
      'Links [T]'
    ]

    for (const section of requiredSections) {
      expect(source).toContain(section)
    }
    expect(source).toContain('<SandboxedHTML src="../interactives/cache-row-col/index.html" />')
    expect(source).toContain('<SandboxedHTML src="../interactives/cache-stride/index.html" />')
    await expect(
      compile(source, { remarkPlugins: [remarkGfm, remarkFrontmatter] })
    ).resolves.toBeDefined()
  })
})

function entry(name: string): (typeof componentRegistry)[number] {
  return componentRegistry.find((item) => item.name === name)!
}
