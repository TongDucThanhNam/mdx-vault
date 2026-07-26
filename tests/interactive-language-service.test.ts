import { describe, expect, test } from 'bun:test'
import { loadNodeInteractiveTypeLibraries } from '../src/main/services/interactive-type-libraries'
import { createInteractiveProjectSnapshot } from '../src/shared/interactive-authoring'
import { InteractiveLanguageProject } from '../src/shared/interactive-language'

const manifest = JSON.stringify({
  name: 'Counter',
  version: '1.0.0',
  runtime: 'react',
  permissions: {
    network: false,
    filesystem: false,
    dataPaths: []
  },
  propsSchema: {},
  dependencies: {
    react: '^19.0.0',
    'react-dom': '^19.0.0'
  }
})

describe('GOAL-25 offline TypeScript language service', () => {
  test('catches a semantic React state mismatch that esbuild can transpile', () => {
    const source = `import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  setCount('wrong type')
  return <button>{count}</button>
}
`
    const project = createProject({ 'component.tsx': source })

    const diagnostic = project.getDiagnostics().find((candidate) => candidate.code === 'TS2345')

    expect(diagnostic).toMatchObject({
      source: 'typescript',
      severity: 'error',
      code: 'TS2345',
      relativePath: 'interactives/counter/component.tsx',
      line: 5
    })
    expect(diagnostic?.message).toContain('SetStateAction<number>')
    expect(diagnostic?.from).toBe(source.indexOf("'wrong type'"))
    project.dispose()
  })

  test('accepts valid React and local imports without exposing app internals', () => {
    const project = createProject({
      'component.tsx': `import { useState } from 'react'
import { increment } from './math'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(increment(count))}>{count}</button>
}
`,
      'math.ts': `export function increment(value: number): number {
  return value + 1
}
`
    })

    expect(project.getDiagnostics()).toEqual([])
    project.dispose()
  })

  test('provides completion, safe React auto-import, hover, signature, and local definition', () => {
    const source = `import { increment } from './math'

export default function Counter() {
  const next = increment(1)
  useSta
  return <button>{next}</button>
}
`
    const project = createProject({
      'component.tsx': source,
      'math.ts': 'export function increment(value: number): number { return value + 1 }\n'
    })

    const completionPosition = source.indexOf('useSta') + 'useSta'.length
    const completion = project
      .getCompletions('component.tsx', completionPosition)
      .find((candidate) => candidate.name === 'useState')
    expect(completion?.source).toBe('react')

    const details = completion
      ? project.getCompletionDetails('component.tsx', completionPosition, completion)
      : null
    expect(details?.edits).toHaveLength(1)
    expect(details?.edits[0]?.insert).toContain("from 'react'")

    const hover = project.getHover('component.tsx', source.indexOf('increment(1)') + 2)
    expect(hover?.signature).toContain('increment(value: number): number')

    const signature = project.getSignatureHelp(
      'component.tsx',
      source.indexOf('increment(1)') + 'increment('.length
    )
    expect(signature?.signatures[0]?.parameters[0]?.label).toBe('value: number')

    const definition = project
      .getDefinitions('component.tsx', source.indexOf('increment(1)') + 2)
      .find((candidate) => candidate.kind === 'project')
    expect(definition?.relativePath).toBe('interactives/counter/math.ts')
    project.dispose()
  })

  test('rejects disallowed packages and relative escapes without network lookup', () => {
    const source = `import leftPad from 'left-pad'
import secret from '../outside'

export default function Counter() {
  return <p>{leftPad(secret, 2)}</p>
}
`
    const project = createProject({ 'component.tsx': source })
    const diagnostics = project.getDiagnostics()

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DEPENDENCY_NOT_ALLOWED',
          message: expect.stringContaining('left-pad')
        }),
        expect.objectContaining({
          code: 'IMPORT_OUTSIDE_PROJECT',
          message: expect.stringContaining('../outside')
        })
      ])
    )
    project.dispose()
  })

  test('updates unsaved buffers by monotonic project version', () => {
    const project = createProject({
      'component.tsx': 'const value: number = 1\nexport default value\n'
    })

    project.updateFile('component.tsx', "const value: number = 'bad'\nexport default value\n", 2)
    expect(project.projectVersion).toBe(2)
    expect(project.getDiagnostics().some((diagnostic) => diagnostic.code === 'TS2322')).toBe(true)
    expect(() => project.updateFile('component.tsx', 'export default 1\n', 2)).toThrow(
      'must increase'
    )
    project.dispose()
  })
})

function createProject(sources: Record<string, string>): InteractiveLanguageProject {
  const snapshot = createInteractiveProjectSnapshot({
    projectRoot: 'interactives/counter',
    version: 1,
    files: [
      ...Object.entries(sources).map(([relativePath, content]) => ({ relativePath, content })),
      { relativePath: 'manifest.json', content: manifest }
    ]
  })
  return new InteractiveLanguageProject(snapshot, loadNodeInteractiveTypeLibraries())
}
