import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { GraphConfigService } from '../src/main/services/graph-config-service'
import { createDefaultGraphViewManifest, GRAPH_CONFIG_RELATIVE_PATH } from '../src/shared/graph'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('GOAL-24 vault graph configuration', () => {
  test('returns independent defaults when the manifest is missing', async () => {
    const service = await createService()
    const first = await service.load()
    first.manifest.global.query = 'transient mutation'
    const second = await service.load()

    expect(first.recovery).toBeNull()
    expect(second).toEqual({
      manifest: createDefaultGraphViewManifest(),
      recovery: null
    })
  })

  test('writes atomically and enforces exact optimistic revision advancement', async () => {
    const service = await createService()
    const manifest = createDefaultGraphViewManifest()
    manifest.revision = 1
    manifest.global.query = 'tag:graph'

    await expect(service.save(manifest, 0)).resolves.toMatchObject({
      manifest: { revision: 1, global: { query: 'tag:graph' } },
      recovery: null
    })
    await expect(service.save({ ...manifest, revision: 3 }, 1)).rejects.toThrow(/exactly one/i)
    await expect(service.save({ ...manifest, revision: 2 }, 0)).rejects.toThrow(
      /another operation/i
    )

    const loaded = await service.load()
    expect(loaded.manifest.revision).toBe(1)
    expect(loaded.manifest.global.query).toBe('tag:graph')
  })

  test('serializes concurrent writes so only one stale writer can win', async () => {
    const service = await createService()
    const first = createDefaultGraphViewManifest()
    first.revision = 1
    first.global.query = 'first'
    const second = createDefaultGraphViewManifest()
    second.revision = 1
    second.global.query = 'second'

    const settled = await Promise.allSettled([service.save(first, 0), service.save(second, 0)])

    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect((await service.load()).manifest.global.query).toBe('first')
  })

  test('preserves corrupt bytes and refuses to overwrite the recovery file', async () => {
    const { root, service } = await createServiceWithRoot()
    const filePath = join(root, GRAPH_CONFIG_RELATIVE_PATH)
    const corrupt = '{ "version": 1, "revision": nope }\r\n'
    await mkdir(join(root, '.app'), { recursive: true })
    await writeFile(filePath, corrupt, 'utf8')

    const loaded = await service.load()
    expect(loaded.recovery).toEqual({
      kind: 'corrupt',
      relativePath: GRAPH_CONFIG_RELATIVE_PATH
    })
    const replacement = createDefaultGraphViewManifest()
    replacement.revision = 1
    await expect(service.save(replacement, 0)).rejects.toThrow(/preserved/i)
    expect(await readFile(filePath, 'utf8')).toBe(corrupt)
  })

  test('preserves unsupported-version bytes and reports a relative recovery path', async () => {
    const { root, service } = await createServiceWithRoot()
    const filePath = join(root, GRAPH_CONFIG_RELATIVE_PATH)
    const unsupported = '{\n  "version": 99,\n  "revision": 4\n}\n'
    await mkdir(join(root, '.app'), { recursive: true })
    await writeFile(filePath, unsupported, 'utf8')

    expect(await service.load()).toMatchObject({
      manifest: { version: 1, revision: 0 },
      recovery: {
        kind: 'unsupported-version',
        relativePath: '.app/graph-view.json'
      }
    })
    expect(await readFile(filePath, 'utf8')).toBe(unsupported)
  })
})

async function createService(): Promise<GraphConfigService> {
  return (await createServiceWithRoot()).service
}

async function createServiceWithRoot(): Promise<{
  root: string
  service: GraphConfigService
}> {
  const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal24-graph-config-'))
  roots.push(root)
  return {
    root,
    service: new GraphConfigService(root)
  }
}
