import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'

import { VaultService } from './vault-service'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
}

const TEXT_SIZE_LIMIT_BYTES = 5 * 1024 * 1024

describe('VaultService plain-text and vault image access', () => {
  test('blocks traversal, absolute paths, and .trash access on all three new methods', async () => {
    const base = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-paths-'))
    const root = join(base, 'vault')
    const vault = new VaultService(root)

    try {
      await writeFixture(base, 'outside.csv', 'outside')
      await writeFixture(base, 'outside.png', 'outside image')
      await writeFixture(root, '.trash/hidden.csv', 'hidden')
      await writeFixture(root, '.trash/hidden.png', 'hidden image')

      for (const relativePath of [
        '../outside.csv',
        join(base, 'outside.csv'),
        '.trash/hidden.csv'
      ]) {
        expect(await rejects(() => vault.readTextFile(relativePath))).toBe(true)
        expect(await rejects(() => vault.writeTextFile(relativePath, 'changed'))).toBe(true)
      }

      for (const relativePath of [
        '../outside.png',
        join(base, 'outside.png'),
        '.trash/hidden.png'
      ]) {
        expect(await rejects(() => vault.readImageFile(relativePath))).toBe(true)
      }
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  test('rejects direct access to every private or dependency directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-private-'))
    const vault = new VaultService(root)

    try {
      for (const directory of ['.app', '.git', 'node_modules']) {
        await writeFixture(root, `${directory}/hidden.json`, '{}')
        await writeFixture(root, `${directory}/hidden.png`, 'image')

        expect(await rejects(() => vault.readTextFile(`${directory}/hidden.json`))).toBe(true)
        expect(await rejects(() => vault.writeTextFile(`${directory}/hidden.json`, '{}'))).toBe(
          true
        )
        expect(await rejects(() => vault.readImageFile(`${directory}/hidden.png`))).toBe(true)
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects text and image access through a junction outside the vault', async () => {
    const base = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-junction-'))
    const root = join(base, 'vault')
    const outside = join(base, 'outside')
    const vault = new VaultService(root)

    try {
      await writeFixture(outside, 'secret.csv', 'secret,value\r\nleak,1\r\n')
      await writeFixture(outside, 'pixel.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      await writeFixture(outside, 'overwrite.txt', 'before')
      await mkdir(root, { recursive: true })
      await symlink(outside, join(root, 'linked'), 'junction')

      expect(await rejects(() => vault.readTextFile('linked/secret.csv'))).toBe(true)
      expect(await rejects(() => vault.readImageFile('linked/pixel.png'))).toBe(true)
      expect(await rejects(() => vault.writeTextFile('linked/overwrite.txt', 'after'))).toBe(true)
      expect(await readFile(join(outside, 'overwrite.txt'), 'utf8')).toBe('before')
    } finally {
      await rm(base, { recursive: true, force: true })
    }
  })

  test('rejects junction aliases to restricted directories inside the vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-private-junction-'))
    const vault = new VaultService(root)

    try {
      await writeFixture(root, '.app/private.json', '{}')
      await writeFixture(root, '.app/private.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      await symlink(join(root, '.app'), join(root, 'linked'), 'junction')

      expect(await rejects(() => vault.readTextFile('linked/private.json'))).toBe(true)
      expect(
        await rejects(() => vault.writeTextFile('linked/private.json', '{"changed":true}'))
      ).toBe(true)
      expect(await rejects(() => vault.readImageFile('linked/private.png'))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects text extensions outside the whitelist, including note extensions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-extension-'))
    const vault = new VaultService(root)

    try {
      await writeFixture(root, 'data.bin', 'plain text')
      await writeFixture(root, 'note.mdx', '# Note')

      expect(await rejects(() => vault.readTextFile('data.bin'))).toBe(true)
      expect(await rejects(() => vault.writeTextFile('data.bin', 'changed'))).toBe(true)
      expect(await rejects(() => vault.readTextFile('note.mdx'))).toBe(true)
      expect(await rejects(() => vault.writeTextFile('note.mdx', 'changed'))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects NUL bytes in text reads and writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-nul-'))
    const vault = new VaultService(root)

    try {
      await writeFixture(root, 'binary.csv', Buffer.from([0x61, 0x00, 0x62]))

      expect(await rejects(() => vault.readTextFile('binary.csv'))).toBe(true)
      expect(await rejects(() => vault.writeTextFile('binary.csv', 'a\0b'))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects text files and writes larger than five MiB', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-size-'))
    const vault = new VaultService(root)
    const oversized = Buffer.alloc(TEXT_SIZE_LIMIT_BYTES + 1, 0x61)

    try {
      await writeFixture(root, 'oversized.txt', oversized)

      expect(await rejects(() => vault.readTextFile('oversized.txt'))).toBe(true)
      expect(await rejects(() => vault.writeTextFile('oversized.txt', oversized.toString()))).toBe(
        true
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('preserves content including CRLF across read, atomic write, and read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-roundtrip-'))
    const vault = new VaultService(root)
    const initialContent = 'name,value\r\nalpha,1\r\n'
    const updatedContent = 'name,value\r\nalpha,1\r\nbeta,2\r\n'

    try {
      await writeFixture(root, 'datasets/sample.csv', initialContent)

      expect(await vault.readTextFile('datasets/sample.csv')).toBe(initialContent)
      await vault.writeTextFile('datasets/sample.csv', updatedContent)
      expect(await vault.readTextFile('datasets/sample.csv')).toBe(updatedContent)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('reads whitelisted images outside assets as base64', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal16-image-'))
    const vault = new VaultService(root)
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])

    try {
      await writeFixture(root, 'notes/pic.png', imageBytes)

      expect(await vault.readImageFile('notes/pic.png')).toBe(imageBytes.toString('base64'))
      expect(await rejects(() => vault.readImageFile('notes/pic.bmp'))).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

async function writeFixture(
  root: string,
  relativePath: string,
  contents: string | Uint8Array
): Promise<void> {
  const target = join(root, ...relativePath.split('/'))
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, contents)
}

async function rejects(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation()
    return false
  } catch {
    return true
  }
}
