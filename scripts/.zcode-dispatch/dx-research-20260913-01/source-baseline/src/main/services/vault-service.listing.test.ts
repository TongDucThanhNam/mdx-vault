import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

import { VaultService } from './vault-service'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
}

describe('VaultService file inventories', () => {
  test('keeps the note listing Markdown-only while the tree listing includes every visible file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-listing-'))

    try {
      await writeFixture(root, 'README.md', '# Read me')
      await writeFixture(root, 'notes/Welcome.mdx', '# Welcome')
      await writeFixture(root, 'assets/sample.png', 'image')
      await writeFixture(root, 'exports/site.html', '<h1>Export</h1>')
      await writeFixture(root, 'scripts/build.ts', 'export {}')
      await writeFixture(root, 'data/records', 'extensionless')
      await writeFixture(root, '.env', 'LOCAL_ONLY=true')
      await writeFixture(root, '.agents/skills/private.md', '# Hidden')
      await writeFixture(root, 'notes/.drafts/Secret.mdx', '# Hidden note')
      await mkdir(join(root, 'empty-folder'), { recursive: true })

      await writeFixture(root, '.app/index.sqlite', 'private')
      await writeFixture(root, '.git/config', 'private')
      await writeFixture(root, '.trash/Deleted.mdx', '# deleted')
      await writeFixture(root, 'node_modules/package/index.js', 'private')

      const vault = new VaultService(root)
      const noteFiles = await vault.listFiles()
      const treeFiles = await vault.listTreeFiles()
      const notePaths = new Set(noteFiles.map((file) => file.relativePath))
      const treePaths = new Set(treeFiles.map((file) => file.relativePath))

      expect(noteFiles.length).toBe(2)
      expect(notePaths.has('README.md')).toBe(true)
      expect(notePaths.has('notes/Welcome.mdx')).toBe(true)
      expect(notePaths.has('assets/sample.png')).toBe(false)

      expect(treeFiles.length).toBe(6)
      for (const path of [
        'README.md',
        'assets/sample.png',
        'data/records',
        'exports/site.html',
        'notes/Welcome.mdx',
        'scripts/build.ts'
      ]) {
        expect(treePaths.has(path)).toBe(true)
      }

      for (const path of [
        '.env',
        '.agents/skills/private.md',
        '.app/index.sqlite',
        '.git/config',
        '.trash/Deleted.mdx',
        'node_modules/package/index.js',
        'notes/.drafts/Secret.mdx'
      ]) {
        expect(treePaths.has(path)).toBe(false)
      }

      const info = await vault.getInfo()
      expect(info.files.length).toBe(2)
      expect(info.treeFiles.length).toBe(6)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

async function writeFixture(root: string, relativePath: string, contents: string): Promise<void> {
  const target = join(root, ...relativePath.split('/'))
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, contents, 'utf8')
}
