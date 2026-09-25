import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { buildRenamePlan } from './rename-plan'
import { VaultService } from './vault-service'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
}

describe('VaultService transactional rename', () => {
  test('restores every file byte-for-byte when the second rewrite fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-rename-'))

    try {
      const targetPath = 'Target Note.mdx'
      const sourceOnePath = 'Source One.mdx'
      const sourceTwoPath = 'Source Two.mdx'
      const target = '# Target Note\r\n'
      const sourceOne = 'Before [[Target Note|Alias]] after\r\n'
      const sourceTwo = '[Target](Target%20Note.mdx)\r\n'

      await mkdir(root, { recursive: true })
      await Promise.all([
        writeFile(join(root, targetPath), target, 'utf8'),
        writeFile(join(root, sourceOnePath), sourceOne, 'utf8'),
        writeFile(join(root, sourceTwoPath), sourceTwo, 'utf8')
      ])

      const plan = buildRenamePlan({
        oldRelativePath: targetPath,
        newRelativePath: 'moved/Renamed Target.mdx',
        notes: [
          { relativePath: targetPath, title: 'Target Note' },
          { relativePath: sourceOnePath, title: 'Source One' },
          { relativePath: sourceTwoPath, title: 'Source Two' }
        ],
        sources: [
          { relativePath: sourceOnePath, content: sourceOne },
          { relativePath: sourceTwoPath, content: sourceTwo }
        ]
      })
      let writeCount = 0
      const vault = new VaultService(root, {
        atomicWrite: async (_path, _data, writeDefault) => {
          writeCount += 1

          if (writeCount === 2) {
            throw new Error('Injected second-write failure')
          }

          await writeDefault()
        }
      })
      let didFail = false

      try {
        await vault.renameFile(targetPath, 'moved/Renamed Target.mdx', { plan })
      } catch (error) {
        didFail = error instanceof Error && error.message === 'Injected second-write failure'
      }

      expect(didFail).toBe(true)
      expect(await readFile(join(root, targetPath), 'utf8')).toBe(target)
      expect(await readFile(join(root, sourceOnePath), 'utf8')).toBe(sourceOne)
      expect(await readFile(join(root, sourceTwoPath), 'utf8')).toBe(sourceTwo)
      expect(await exists(join(root, 'moved/Renamed Target.mdx'))).toBe(false)
      expect(await exists(join(root, 'moved'))).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
