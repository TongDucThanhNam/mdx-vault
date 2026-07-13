import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import type { PatchOperation } from '../../shared/ai'
import { approveAiPatch } from './ai-approval-service'
import { applyAllOperations } from './ai-patch-engine'
import { VaultService } from './vault-service'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
  toContain(expected: string): void
  rejects: { toThrow(expected?: string): Promise<void> }
}

describe('GOAL-06 transactional AI approval', () => {
  test('preserves mixed note edits and component files in preview', () => {
    const result = applyAllOperations('before', [
      { kind: 'textPatch', start: 0, end: 6, replacement: 'after' },
      componentDraft()
    ])

    expect(result.text).toBe('after')
    expect(result.files.length).toBe(3)
    expect(result.files.find((file) => file.relativePath.endsWith('README.md'))!.content).toContain(
      '## AI provenance'
    )
  })

  test('atomically writes a reviewed mixed proposal with enforced provenance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-ai-approval-'))
    try {
      await mkdir(join(root, 'notes'), { recursive: true })
      await writeFile(join(root, 'notes', 'Note.mdx'), 'before')
      const result = await approveAiPatch(new VaultService(root), 'notes/Note.mdx', [
        { kind: 'textPatch', start: 0, end: 6, replacement: 'after' },
        componentDraft()
      ])

      expect(result.writtenPaths.length).toBe(4)
      expect(await readFile(join(root, 'notes', 'Note.mdx'), 'utf8')).toBe('after')
      expect(await readFile(join(root, 'interactives', 'demo', 'README.md'), 'utf8')).toContain(
        'Source note: notes/Note.mdx'
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('refuses overwrites before changing the note', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-ai-approval-'))
    try {
      await mkdir(join(root, 'notes'), { recursive: true })
      await mkdir(join(root, 'interactives', 'demo'), { recursive: true })
      await writeFile(join(root, 'notes', 'Note.mdx'), 'before')
      await writeFile(join(root, 'interactives', 'demo', 'README.md'), 'owned by user')

      await expect(
        approveAiPatch(new VaultService(root), 'notes/Note.mdx', [
          { kind: 'textPatch', start: 0, end: 6, replacement: 'after' },
          componentDraft()
        ])
      ).rejects.toThrow('refuses to overwrite')
      expect(await readFile(join(root, 'notes', 'Note.mdx'), 'utf8')).toBe('before')
      expect(await exists(join(root, 'interactives', 'demo', 'component.tsx'))).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

function componentDraft(): Extract<PatchOperation, { kind: 'componentDraft' }> {
  return {
    kind: 'componentDraft',
    folderRelativePath: 'interactives/demo',
    componentSource:
      "export default function Demo() { return <button type='button'>Demo</button> }",
    manifestJson: JSON.stringify({
      name: 'Demo',
      version: '1.0.0',
      runtime: 'react',
      permissions: { network: false, filesystem: false, dataPaths: [] },
      propsSchema: {},
      dependencies: { 'react-dom': '*' }
    }),
    readmeMarkdown: '# Demo',
    provenance: {
      prompt: 'Make this interactive',
      noteRelativePath: 'notes/Note.mdx',
      modelName: 'test-model',
      generatedAt: '2026-07-13T00:00:00.000Z'
    }
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
