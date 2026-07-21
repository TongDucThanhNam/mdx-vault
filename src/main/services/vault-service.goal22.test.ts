import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { VaultService } from './vault-service'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
}

describe('VaultService existing-file writes', () => {
  test('writes an existing note without widening create semantics', async () => {
    const root = await createVaultRoot()
    try {
      const notePath = join(root, 'notes', 'kept.mdx')
      await mkdir(join(root, 'notes'), { recursive: true })
      await writeFile(notePath, 'before', 'utf8')
      const vault = new VaultService(root)

      await vault.writeFile('notes/kept.mdx', 'after')

      expect(await readFile(notePath, 'utf8')).toBe('after')
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  test('does not recreate a note removed after it was opened', async () => {
    const root = await createVaultRoot()
    try {
      const notePath = join(root, 'removed.mdx')
      await writeFile(notePath, 'before', 'utf8')
      const vault = new VaultService(root)
      await rm(notePath)

      expect(await rejects(() => vault.writeFile('removed.mdx', 'unsaved changes'))).toBe(true)
      expect(await rejects(() => access(notePath))).toBe(true)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  test('does not recreate an editable text file removed after it was opened', async () => {
    const root = await createVaultRoot()
    try {
      const textPath = join(root, 'data.csv')
      await writeFile(textPath, 'before', 'utf8')
      const vault = new VaultService(root)
      await rm(textPath)

      expect(await rejects(() => vault.writeTextFile('data.csv', 'unsaved changes'))).toBe(true)
      expect(await rejects(() => access(textPath))).toBe(true)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })

  test('does not recreate a target removed after validation but before the write begins', async () => {
    const root = await createVaultRoot()
    try {
      const notePath = join(root, 'raced.mdx')
      await writeFile(notePath, 'before', 'utf8')
      const vault = new VaultService(root, {
        atomicWrite: async (target, _data, writeDefault) => {
          await rm(target)
          await writeDefault()
        }
      })

      expect(await rejects(() => vault.writeFile('raced.mdx', 'unsaved changes'))).toBe(true)
      expect(await rejects(() => access(notePath))).toBe(true)
    } finally {
      await rm(root, { force: true, recursive: true })
    }
  })
})

async function createVaultRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'mdx-vault-goal22-write-'))
}

async function rejects(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation()
    return false
  } catch {
    return true
  }
}
