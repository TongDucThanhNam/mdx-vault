import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { applyPropertyRename, planPropertyRename } from '../src/main/services/property-service'
import type { VaultIndexRuntime } from '../src/main/services/vault-index-runtime'
import { VaultService } from '../src/main/services/vault-service'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('GOAL-23 transactional property rename', () => {
  test('previews collisions and refuses an unsafe plan', async () => {
    const root = await fixtureVault({
      'notes/Alpha.mdx': '---\nstatus: draft\n---\nAlpha\n',
      'notes/Beta.mdx': '---\nstatus: final\nworkflow: existing\n---\nBeta\n'
    })
    const index = createIndex(['notes/Alpha.mdx', 'notes/Beta.mdx'])
    const plan = await planPropertyRename(
      new VaultService(root),
      index.runtime,
      'status',
      'workflow'
    )

    expect(plan.canApply).toBe(false)
    expect(
      plan.affectedFiles.map(({ relativePath, collision }) => [relativePath, collision])
    ).toEqual([
      ['notes/Alpha.mdx', false],
      ['notes/Beta.mdx', true]
    ])
  })

  test('restores byte-identical originals after an injected mid-write failure', async () => {
    const originals = {
      'notes/Alpha.mdx': '---\n# alpha\nstatus: draft\n---\nAlpha\n',
      'notes/Beta.mdx': '---\nstatus: final # beta\n---\nBeta\n'
    }
    const root = await fixtureVault(originals)
    let writeCount = 0
    const vault = new VaultService(root, {
      atomicWrite: async (_path, _data, writeDefault) => {
        writeCount += 1
        if (writeCount === 2) throw new Error('injected write failure')
        await writeDefault()
      }
    })
    const index = createIndex(Object.keys(originals))
    const plan = await planPropertyRename(vault, index.runtime, 'status', 'workflow')

    await expect(
      applyPropertyRename(vault, index.runtime, {
        oldName: 'status',
        newName: 'workflow',
        expectedFiles: plan.affectedFiles
      })
    ).rejects.toThrow(/injected write failure/i)

    for (const [relativePath, source] of Object.entries(originals)) {
      expect(await readFile(join(root, relativePath), 'utf8')).toBe(source)
    }
    expect(index.rebuildCount()).toBe(1)
  })

  test('rolls back every file and rebuilds after an injected reindex failure', async () => {
    const originals = {
      'notes/Alpha.mdx': '---\nstatus: draft\n---\nAlpha\n',
      'notes/Beta.mdx': '---\nstatus: final\n---\nBeta\n'
    }
    const root = await fixtureVault(originals)
    const vault = new VaultService(root)
    const index = createIndex(Object.keys(originals), { failIndex: true })
    const plan = await planPropertyRename(vault, index.runtime, 'status', 'workflow')

    await expect(
      applyPropertyRename(vault, index.runtime, {
        oldName: 'status',
        newName: 'workflow',
        expectedFiles: plan.affectedFiles
      })
    ).rejects.toThrow(/injected reindex failure/i)

    for (const [relativePath, source] of Object.entries(originals)) {
      expect(await readFile(join(root, relativePath), 'utf8')).toBe(source)
    }
    expect(index.rebuildCount()).toBe(1)
  })
})

async function fixtureVault(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal23-properties-'))
  roots.push(root)
  for (const [relativePath, source] of Object.entries(files)) {
    const absolutePath = join(root, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, source, 'utf8')
  }
  return root
}

function createIndex(
  paths: string[],
  options: { failIndex?: boolean } = {}
): { runtime: VaultIndexRuntime; rebuildCount: () => number } {
  let rebuilds = 0
  const runtime = {
    database: {
      listNotePathsWithProperty: () => paths
    },
    indexFile: async () => {
      if (options.failIndex) throw new Error('injected reindex failure')
      return true
    },
    notifyChanged: () => undefined,
    rebuild: async () => {
      rebuilds += 1
    }
  } as unknown as VaultIndexRuntime
  return { runtime, rebuildCount: () => rebuilds }
}
