import { describe, expect, test } from 'bun:test'
import { createWorkbenchItemForPath } from '../src/renderer/src/workbench/workbench-item'
import {
  createInteractiveProjectSnapshot,
  resolveInteractiveProjectPath
} from '../src/shared/interactive-authoring'

describe('GOAL-25 interactive project grammar', () => {
  test('resolves supported physical files to one canonical project root', () => {
    expect(resolveInteractiveProjectPath('interactives/react-counter/component.tsx')).toEqual({
      projectRoot: 'interactives/react-counter',
      projectName: 'react-counter',
      relativePath: 'interactives/react-counter/component.tsx',
      projectRelativePath: 'component.tsx',
      kind: 'source'
    })
    expect(
      resolveInteractiveProjectPath('interactives/react-counter/lib/math.ts')?.projectRoot
    ).toBe('interactives/react-counter')
    expect(resolveInteractiveProjectPath('interactives/react-counter/manifest.json')?.kind).toBe(
      'manifest'
    )
    expect(resolveInteractiveProjectPath('interactives/react-counter/README.md')?.kind).toBe(
      'readme'
    )
    expect(createWorkbenchItemForPath('interactives/react-counter/README.md', 'reading').kind).toBe(
      'text'
    )
  })

  test('rejects escapes, restricted directories, hidden roots, and unsupported files', () => {
    for (const path of [
      '../interactives/x/component.tsx',
      '/interactives/x/component.tsx',
      'interactives/.hidden/component.tsx',
      'interactives/x/../other/component.tsx',
      'interactives/x/node_modules/pkg/index.ts',
      'interactives/x/.git/config',
      'interactives/x/image.png',
      'notes/component.tsx'
    ]) {
      expect(resolveInteractiveProjectPath(path)).toBeNull()
    }
  })

  test('keeps a repairable project snapshot when manifest is missing or invalid', () => {
    const missing = createInteractiveProjectSnapshot({
      projectRoot: 'interactives/react-counter',
      version: 1,
      files: [{ relativePath: 'component.tsx', content: 'export default function Counter() {}' }]
    })
    expect(missing.projectRoot).toBe('interactives/react-counter')
    expect(missing.diagnostics[0]).toMatchObject({
      source: 'manifest',
      severity: 'error',
      code: 'MANIFEST_MISSING',
      relativePath: 'interactives/react-counter/manifest.json'
    })

    const invalid = createInteractiveProjectSnapshot({
      projectRoot: 'interactives/react-counter',
      version: 2,
      files: [
        { relativePath: 'component.tsx', content: 'export default function Counter() {}' },
        { relativePath: 'manifest.json', content: '{"runtime":"react"}' }
      ]
    })
    expect(invalid.diagnostics.some((diagnostic) => diagnostic.code === 'MANIFEST_INVALID')).toBe(
      true
    )
  })

  test('enforces source-file and total-byte snapshot limits', () => {
    expect(() =>
      createInteractiveProjectSnapshot({
        projectRoot: 'interactives/too-many',
        version: 1,
        files: Array.from({ length: 129 }, (_, index) => ({
          relativePath: `file-${index}.ts`,
          content: ''
        }))
      })
    ).toThrow('128')

    expect(() =>
      createInteractiveProjectSnapshot({
        projectRoot: 'interactives/too-large',
        version: 1,
        files: [
          { relativePath: 'component.tsx', content: 'x'.repeat(5 * 1024 * 1024) },
          { relativePath: 'helper.ts', content: 'x'.repeat(5 * 1024 * 1024) },
          { relativePath: 'extra.ts', content: 'x' }
        ]
      })
    ).toThrow('10 MiB')
  })
})
