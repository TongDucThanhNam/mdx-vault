import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { compile } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'
import ts from 'typescript'

import { __internalTesting as bundlerTesting } from '../src/main/services/export-bundler'
import { parseNoteToExportIr } from '../src/main/services/export-ir'
import { scopeRegistryStylesheet } from '../src/main/services/export-registry-style'
import { StaticSnapshotRenderer } from '../src/main/services/export-static-snapshot'
import { renderExportTemplate } from '../src/main/services/export-template'
import { componentRegistry } from '../src/renderer/src/preview/registry'

const entry = resolve('src/renderer/src/preview/export-registry.css')
const sources = [
  'src/renderer/src/preview/islands/QuizBlock.tsx',
  'src/renderer/src/preview/islands/DataChart.tsx',
  'src/renderer/src/preview/islands/EquationSlider.tsx',
  'src/renderer/src/preview/islands/AlgorithmVisualizer.tsx',
  'src/renderer/src/preview/Counter.tsx',
  'src/renderer/src/components/ui/button.tsx'
]

function classTokens(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const values: string[] = []
  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && node.name.text === 'className' && node.initializer) {
      const initializer = node.initializer
      if (ts.isStringLiteral(initializer)) values.push(initializer.text)
      if (ts.isJsxExpression(initializer) && initializer.expression) {
        const expression = initializer.expression
        if (ts.isStringLiteral(expression)) values.push(expression.text)
        if (ts.isCallExpression(expression) && expression.expression.getText(source) === 'cn') {
          function collectStrings(child: ts.Node): void {
            if (ts.isStringLiteral(child)) values.push(child.text)
            ts.forEachChild(child, collectStrings)
          }
          expression.arguments.forEach(collectStrings)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return [...new Set(values.flatMap((value) => value.split(/\s+/).filter(Boolean)))]
}

function escapeClass(value: string): string {
  return value.replace(/([^a-zA-Z0-9_-])/g, '\\$1')
}

function buttonClassTokens(): string[] {
  const file = sources[5]
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const values: string[] = []
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'cva') {
      function collect(child: ts.Node): void {
        if (
          ts.isStringLiteral(child) &&
          (child.text.includes(' ') || /^size-\d/.test(child.text))
        ) {
          values.push(child.text)
        }
        ts.forEachChild(child, collect)
      }
      node.arguments.forEach(collect)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return [...new Set(values.flatMap((value) => value.split(/\s+/).filter(Boolean)))]
}

describe('GOAL-36 bounded registry export CSS', () => {
  test('keeps an inline registry island after an ordinary Markdown table', () => {
    const source =
      '| Key | Value |\n| --- | --- |\n| A | B |\n\n<FormulaLine>ratio = 1</FormulaLine>'
    const parsed = parseNoteToExportIr(source, 'fixture.mdx', 'Fixture')
    expect(parsed.meta.usedComponents).toContain('FormulaLine')
    expect(
      parsed.ir.children.some((node) => node.type === 'component' && node.name === 'FormulaLine')
    ).toBe(true)
  })

  test('does not wrap adjacent PrimerTerm block islands in a paragraph', () => {
    const source =
      '<NotePrimer>\n  <PrimerTerm term="one">One</PrimerTerm>\n  <PrimerTerm term="two">Two</PrimerTerm>\n</NotePrimer>'
    const parsed = parseNoteToExportIr(source, 'fixture.mdx', 'Fixture')
    for (const mode of ['static', 'interactive'] as const) {
      const html = new StaticSnapshotRenderer().renderDocument({ ir: parsed.ir, mode }).bodyHtml
      expect(html).not.toContain('<p><div class="in-primer-row"')
      expect(html.match(/class="in-primer-row"/g)).toHaveLength(2)
    }
  })

  test('compiles every class used by the four legacy registry islands', async () => {
    const input = readFileSync(entry, 'utf8')
    const compiled = await compile(input, {
      base: dirname(entry),
      from: entry,
      onDependency: () => undefined
    })
    const scanner = new Scanner({ sources: compiled.sources })
    const candidates = scanner.scan()
    const css = compiled.build(candidates)
    const missing = sources
      .slice(0, 5)
      .flatMap((file) =>
        classTokens(file).filter((token) => !css.includes(`.${escapeClass(token)}`))
      )
    expect(missing).toEqual([])
    expect(buttonClassTokens().filter((token) => !css.includes(`.${escapeClass(token)}`))).toEqual(
      []
    )
    const scoped = scopeRegistryStylesheet(css)
    expect(scoped).toContain(':where(.mdx-vault-export) .h-72')
    expect(scoped).not.toContain('@scope')
    expect(scoped).not.toContain('{.h-72{')
    expect(scoped).toContain('@property --tw-border-style')
    expect(css).toContain('.h-56')
    expect(css).toMatch(/\.h-72\s*\{\s*height:\s*calc\(0\.25rem \* 72\)/)
    expect(Buffer.byteLength(css, 'utf8')).toBeLessThanOrEqual(60_000)
    expect(input).toContain("@source './islands';")
    expect(input).toContain("@source './Counter.tsx';")
    expect(input).toContain("@source '../components/ui/button.tsx';")
  })

  test('export CSS stays scoped and CSP remains exact', () => {
    const html = renderExportTemplate({
      title: 'Registry',
      bodyHtml: '<p>Prose</p>',
      generatedAt: '2026-09-29T00:00:00.000Z'
    })
    expect(html.includes('@scope')).toBe(false)
    expect(html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1]).toBe(
      "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'"
    )
    const interactive = renderExportTemplate({
      title: 'Registry',
      bodyHtml: '',
      registryBundle: 'void 0'
    })
    expect(
      interactive.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1]
    ).toBe(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'"
    )
  })

  test('prefixes nested utility selectors but keeps registrations at top level', () => {
    const css =
      '@layer utilities{.h-72{height:18rem}@media(min-width:64rem){.lg\\:grid{display:grid}}' +
      '@supports(color:red){.text-red,.bg-red{color:red}}}' +
      '@property --tw-border-style{syntax:"*";inherits:false;initial-value:solid}'
    const scoped = scopeRegistryStylesheet(css)
    expect(scoped).toContain(':where(.mdx-vault-export) .h-72{height:18rem}')
    expect(scoped).toContain('@media(min-width:64rem){:where(.mdx-vault-export) .lg\\:grid')
    expect(scoped).toContain(
      ':where(.mdx-vault-export) .text-red,:where(.mdx-vault-export) .bg-red'
    )
    expect(scoped).toMatch(/}@property --tw-border-style\{/)
  })

  test('keeps quoted CSS braces and selector commas intact', () => {
    const css = '@layer utilities{[data-value="a,b"],.comma{content:"}"}.next{height:4px}}'
    expect(scopeRegistryStylesheet(css)).toBe(
      '@layer utilities{:where(.mdx-vault-export) [data-value="a,b"],:where(.mdx-vault-export) .comma{content:"}"}:where(.mdx-vault-export) .next{height:4px}}'
    )
  })

  test('announces static islands once per document, not once per card', () => {
    const parsed = parseNoteToExportIr(
      '<Counter initial={2} />\n\n<QuizBlock question="Q" options={["A", "B"]} answerIndex={0} />',
      'fixture.mdx',
      'Fixture'
    )
    const bodyHtml = new StaticSnapshotRenderer().renderDocument({
      ir: parsed.ir,
      mode: 'static'
    }).bodyHtml
    const html = renderExportTemplate({ title: 'Fixture', bodyHtml })
    expect(html.match(/class="mdx-vault-static-island"/g)).toHaveLength(2)
    expect(html.match(/class="mdx-export-static-notice"/g)).toHaveLength(1)
    expect(html).not.toContain('mdx-vault-static-notice')
    expect(renderExportTemplate({ title: 'Plain', bodyHtml: '<p>Plain</p>' })).not.toContain(
      'class="mdx-export-static-notice"'
    )
  })

  test('export sandbox hydration uses the Reading reservation and guarded resize path', () => {
    const script = bundlerTesting.buildEntryStub([])
    expect(script).toContain("from '../src/renderer/src/preview/sandbox/sandbox-height'")
    expect(script).toContain('shouldApplySandboxHeight(frame.reportedHeight, message.height)')
    expect(script).toContain('frame.reservation.style.height = sandboxFrameHeight(message.height)')
    expect(script).toContain('frame.iframe.style.height = sandboxIframeHeight(message.height)')
    expect(script).toContain("reservation.style.height = sandboxFrameHeight(null) + 'px'")
    expect(script).toContain("iframe.style.height = sandboxIframeHeight(null) + 'px'")
  })

  test('every registry entry uses a covered stylesheet path', () => {
    const names = componentRegistry.map((entry) => entry.name)
    expect(names).toHaveLength(22)
    for (const name of [
      'QuizBlock',
      'DataChart',
      'EquationSlider',
      'AlgorithmVisualizer',
      'Counter'
    ]) {
      expect(names).toContain(name)
    }
    const theme = readFileSync('src/renderer/src/preview/interactive-note-theme.css', 'utf8')
    const islandDirectory = 'src/renderer/src/preview/islands/interactive-note'
    const missing = readdirSync(islandDirectory)
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) => {
        const source = readFileSync(resolve(islandDirectory, file), 'utf8')
        return [...new Set(source.match(/(?<![-\w])in-[a-z0-9-]+/g) ?? [])]
          .filter((className) => !className.endsWith('-') && !theme.includes(`.${className}`))
          .map((className) => `${file}: ${className}`)
      })
    expect(missing).toEqual([])
  })
})
