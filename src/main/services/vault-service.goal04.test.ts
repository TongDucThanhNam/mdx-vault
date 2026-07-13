import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { VaultService } from './vault-service'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
  rejects: { toThrow(): Promise<void> }
}

describe('GOAL-04 dataset access boundary', () => {
  test('reads supported datasets under assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal04-'))

    try {
      await mkdir(join(root, 'assets', 'datasets'), { recursive: true })
      await writeFile(join(root, 'assets', 'datasets', 'sample.csv'), 'x,y\n1,2\n', 'utf8')

      expect(await new VaultService(root).readAssetFile('assets/datasets/sample.csv')).toBe(
        'x,y\n1,2\n'
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects traversal, files outside assets, and unsupported extensions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal04-'))
    const vault = new VaultService(root)

    try {
      for (const path of ['../outside.csv', 'notes/data.csv', 'assets/data.txt']) {
        expect(vault.readAssetFile(path)).rejects.toThrow()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
