#!/usr/bin/env bun
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    focus: { type: 'string' },
    scope: { type: 'string', default: 'down' },
    layoutOnly: { type: 'boolean', default: false },
    output: { type: 'string' },
    src: { type: 'string', default: 'src/renderer/src' }
  },
  strict: true
})

if (!values.focus) {
  throw new Error('--focus <ComponentName> is required')
}

const projectRoot = process.cwd()
const sourceRoot = path.resolve(projectRoot, values.src ?? 'src/renderer/src')
const componentName = values.focus
const componentPattern = new RegExp(
  `(?:export\\s+default\\s+|export\\s+)?(?:function|const)\\s+${escapeRegExp(componentName)}\\b`
)
const glob = new Bun.Glob('**/*.{tsx,jsx}')
let match: { file: string; source: string } | null = null

for await (const file of glob.scan({ cwd: sourceRoot, absolute: true })) {
  const source = await Bun.file(file).text()
  if (componentPattern.test(source)) {
    match = { file, source }
    break
  }
}

if (!match) {
  throw new Error(`Component ${componentName} was not found below ${toProjectPath(sourceRoot)}`)
}

const relativePath = toProjectPath(match.file)
const lines = match.source.split(/\r?\n/u)
const outputLines = [
  `[${componentName}] ${relativePath} (full mapped source)`,
  `  [source] ${relativePath}`,
  `  [scope] ${values.scope ?? 'down'}${values.layoutOnly ? ' · layout signals only' : ''}`,
  '  [component inventory]'
]

for (const entry of collectComponentInventory(lines)) {
  outputLines.push(`    [component] ${entry.name} @ ${relativePath}:${entry.line}`)
}

outputLines.push('  [conditional and semantic hierarchy]')
for (const entry of collectSemanticLines(lines, values.layoutOnly ?? false)) {
  outputLines.push(`    [node line ${entry.line}] ${entry.text}`)
}

const rendered = `${outputLines.join('\n')}\n`
if (values.output) {
  const destination = path.resolve(projectRoot, values.output)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, rendered, 'utf8')
} else {
  process.stdout.write(rendered)
}

function collectComponentInventory(
  lines: readonly string[]
): Array<{ name: string; line: number }> {
  const inventory: Array<{ name: string; line: number }> = []
  const declarationPattern =
    /(?:export\s+default\s+|export\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9]*)\b/u

  lines.forEach((line, index) => {
    const declaration = line.match(declarationPattern)
    if (declaration) {
      inventory.push({ name: declaration[1], line: index + 1 })
    }
  })

  return inventory
}

function collectSemanticLines(
  lines: readonly string[],
  layoutOnly: boolean
): Array<{ text: string; line: number }> {
  const results: Array<{ text: string; line: number }> = []
  const semanticPattern =
    /<(?:[A-Z][\w.]*|main|nav|aside|header|footer|section|form|button|a|input|select|textarea|h[1-6]|p|ol|ul|li)\b|(?:\bif\s*\(|\bswitch\s*\(|\?\s*\(|:\s*\(|\breturn\s*\()/u
  const layoutPattern =
    /\b(?:className|style|role|aria-[\w-]+|hidden|open|disabled|data-state|orientation)\b/u

  lines.forEach((line, index) => {
    const normalized = line.replace(/\s+/gu, ' ').trim()
    if (!normalized || !semanticPattern.test(normalized)) {
      return
    }
    if (layoutOnly && normalized.startsWith('import ')) {
      return
    }

    const context = layoutPattern.test(normalized) ? normalized : normalized
    results.push({
      text: context.length > 260 ? `${context.slice(0, 259)}…` : context,
      line: index + 1
    })
  })

  return results
}

function toProjectPath(file: string): string {
  return path.relative(projectRoot, file).replaceAll('\\', '/')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
