import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InteractiveCompileError, SandboxService } from '../src/main/services/sandbox-service'
import { VaultService } from '../src/main/services/vault-service'
import { navigateInteractiveProblem } from '../src/renderer/src/interactive/interactive-problem-navigation'
import {
  createInteractiveProjectSnapshot,
  getJsonErrorPosition,
  type InteractiveDiagnostic
} from '../src/shared/interactive-authoring'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('interactive structured diagnostics', () => {
  test('maps manifest schema issues onto a navigable JSON field range', () => {
    const manifest = `{
  "name": "Broken",
  "version": "1.0.0",
  "runtime": "invalid",
  "permissions": { "network": false, "filesystem": false, "dataPaths": [] }
}`
    const snapshot = createInteractiveProjectSnapshot({
      projectRoot: 'interactives/broken',
      version: 1,
      files: [
        { relativePath: 'component.tsx', content: 'export default () => null\n' },
        { relativePath: 'manifest.json', content: manifest }
      ]
    })
    const diagnostic = snapshot.diagnostics.find((item) => item.message.startsWith('runtime:'))

    expect(diagnostic).toMatchObject({
      source: 'manifest',
      code: 'MANIFEST_INVALID',
      relativePath: 'interactives/broken/manifest.json',
      line: 4,
      column: 3
    })
    expect(manifest.slice(diagnostic?.from ?? 0, diagnostic?.to ?? 0)).toBe('"runtime"')
    expect(getJsonErrorPosition('Unexpected token at position 18')).toBe(18)
  })

  test('opens cross-file problems and reveals exact UTF-16 ranges only after activation', async () => {
    const calls: unknown[] = []
    const diagnostic: InteractiveDiagnostic = {
      source: 'typescript',
      severity: 'error',
      code: 'TS2345',
      message: 'Mismatch',
      relativePath: 'interactives/counter/lib/math.ts',
      from: 12,
      to: 20,
      line: 2,
      column: 3
    }

    expect(
      await navigateInteractiveProblem(diagnostic, {
        openOrActivate: async (path) => {
          calls.push(['open', path])
          return true
        },
        reveal: (request) => calls.push(['reveal', request])
      })
    ).toBe(true)
    expect(calls).toEqual([
      ['open', 'interactives/counter/lib/math.ts'],
      ['reveal', { from: 12, to: 20 }]
    ])

    calls.length = 0
    expect(
      await navigateInteractiveProblem(diagnostic, {
        openOrActivate: async () => false,
        reveal: (request) => calls.push(request)
      })
    ).toBe(false)
    expect(calls).toEqual([])
  })

  test('main compile errors expose only vault-relative paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal25-diagnostics-'))
    roots.push(root)
    const project = join(root, 'interactives', 'diagnostic-fixture')
    await mkdir(project, { recursive: true })
    await writeFile(
      join(project, 'component.tsx'),
      `import { useState } from 'react'
export default function Fixture() {
  const [count, setCount] = useState(0)
  setCount('wrong')
  return <div>{count}</div>
}
`,
      'utf8'
    )
    await writeFile(
      join(project, 'manifest.json'),
      JSON.stringify({
        name: 'Diagnostic fixture',
        version: '1.0.0',
        runtime: 'react',
        permissions: { network: false, filesystem: false, dataPaths: [] },
        propsSchema: {},
        dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }
      }),
      'utf8'
    )

    let caught: unknown
    try {
      await new SandboxService(new VaultService(root)).loadAuthoringProof(
        'interactives/diagnostic-fixture',
        'fixture',
        {}
      )
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(InteractiveCompileError)
    const diagnostics = (caught as InteractiveCompileError).diagnostics
    expect(diagnostics).toEqual([
      expect.objectContaining({
        source: 'typescript',
        code: 'TS2345',
        relativePath: 'interactives/diagnostic-fixture/component.tsx',
        from: expect.any(Number),
        to: expect.any(Number),
        line: 4,
        column: expect.any(Number)
      })
    ])
    expect(JSON.stringify(diagnostics)).not.toContain(root)
    expect(JSON.stringify(diagnostics)).not.toContain(tmpdir())
  })
})
