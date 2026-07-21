import { existsSync } from 'fs'
import { mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  configureDisposableUserData,
  resolveDisposableUserDataPath
} from '../src/main/services/test-user-data'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
}

describe('disposable Electron userData override', () => {
  test('accepts only a child directory of the OS temp root', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'mdx-vault-user-data-parent-'))
    const requested = join(parent, 'profile')

    try {
      await mkdir(requested)
      expect(resolveDisposableUserDataPath(requested)).toBe(requested)
      expect(
        await rejects(() => Promise.resolve(resolveDisposableUserDataPath(parent, parent)))
      ).toBe(true)
    } finally {
      await rm(parent, { force: true, recursive: true })
    }
  })

  test('is inactive for packaged builds', () => {
    let configuredPath: string | null = null

    const result = configureDisposableUserData(
      {
        isPackaged: true,
        setPath: (_name, path) => {
          configuredPath = path
        }
      },
      join(tmpdir(), 'mdx-vault-should-not-be-created')
    )

    expect(result).toBe(null)
    expect(configuredPath).toBe(null)
  })

  test('rejects relative overrides', async () => {
    expect(
      await rejects(() => Promise.resolve(resolveDisposableUserDataPath('relative-profile')))
    ).toBe(true)
  })

  test('rejects an absolute path outside the verified temp root without creating it', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'mdx-vault-user-data-boundary-'))
    const outside = `${parent}-outside`

    try {
      expect(
        await rejects(() => Promise.resolve(resolveDisposableUserDataPath(outside, parent)))
      ).toBe(true)
      expect(existsSync(outside)).toBe(false)
    } finally {
      await rm(parent, { force: true, recursive: true })
    }
  })
})

async function rejects(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation()
    return false
  } catch {
    return true
  }
}
