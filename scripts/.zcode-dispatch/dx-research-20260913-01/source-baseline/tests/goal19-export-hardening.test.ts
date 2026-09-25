import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SandboxExportBridge } from '../src/main/services/export-sandbox-bridge'
import { ExportService } from '../src/main/services/export-service'
import { SandboxService } from '../src/main/services/sandbox-service'
import { VaultService } from '../src/main/services/vault-service'
import type { SandboxManifest } from '../src/shared/sandbox'

describe('GOAL-19 export asset and write hardening', () => {
  test('uses final encoded bytes for warnings and preserves the target on size failures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal19-size-'))
    const vaultRoot = join(root, 'vault')
    const destination = join(root, 'destination')
    const target = join(destination, 'artifact.html')

    try {
      await Promise.all([
        mkdir(join(vaultRoot, 'notes'), { recursive: true }),
        mkdir(join(vaultRoot, 'assets'), { recursive: true }),
        mkdir(destination, { recursive: true })
      ])
      await writeFile(join(vaultRoot, 'notes', 'large.mdx'), '![encoded](../assets/large.png)')
      await writeFile(join(vaultRoot, 'assets', 'large.png'), Buffer.alloc(3 * 1024 * 1024, 7))
      await writeFile(target, 'existing-target')

      const service = createService(vaultRoot)
      await expect(
        service.run(
          {
            noteRelativePath: 'notes/large.mdx',
            mode: 'static',
            target: { absolutePath: target }
          },
          () => undefined
        )
      ).rejects.toMatchObject({ code: 'EXPORT_SIZE_CONFIRMATION_REQUIRED' })
      expect(await readFile(target, 'utf8')).toBe('existing-target')
      expect(await readdir(destination)).toEqual(['artifact.html'])

      const result = await service.run(
        {
          noteRelativePath: 'notes/large.mdx',
          mode: 'static',
          target: { absolutePath: target },
          confirmedOversized: true
        },
        () => undefined
      )
      const finalBytes = (await readFile(target)).byteLength
      expect(result.size).toBe(finalBytes)
      expect(result.size).toBeGreaterThan(5 * 1024 * 1024)
      expect(result.warnings.some((warning) => warning.includes('5 MiB'))).toBe(true)

      await writeFile(join(vaultRoot, 'assets', 'large.png'), Buffer.alloc(19 * 1024 * 1024, 9))
      await writeFile(target, 'hard-limit-sentinel')
      await expect(
        service.run(
          {
            noteRelativePath: 'notes/large.mdx',
            mode: 'static',
            target: { absolutePath: target },
            confirmedOversized: true
          },
          () => undefined
        )
      ).rejects.toMatchObject({ code: 'EXPORT_TOO_LARGE' })
      expect(await readFile(target, 'utf8')).toBe('hard-limit-sentinel')
      expect(await readdir(destination)).toEqual(['artifact.html'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)

  test('blocks a junction escape and remote runtime image with typed diagnostics', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal19-path-'))
    const vaultRoot = join(root, 'vault')
    const outsideRoot = join(root, 'outside')

    try {
      await Promise.all([
        mkdir(join(vaultRoot, 'notes'), { recursive: true }),
        mkdir(join(vaultRoot, 'assets'), { recursive: true }),
        mkdir(outsideRoot, { recursive: true })
      ])
      await writeFile(join(outsideRoot, 'secret.png'), 'OUTSIDE_SECRET_SENTINEL')
      await symlink(outsideRoot, join(vaultRoot, 'assets', 'escape'), 'junction')
      await writeFile(
        join(vaultRoot, 'notes', 'escape.mdx'),
        '![escape](../assets/escape/secret.png)\n\n![remote](https://example.invalid/remote.png)'
      )

      const scan = await createService(vaultRoot).scan('notes/escape.mdx')
      expect(scan.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'LOCAL_ASSET_UNAVAILABLE', severity: 'blocking' }),
          expect.objectContaining({ code: 'REMOTE_RUNTIME_ASSET', severity: 'blocking' })
        ])
      )
      expect(JSON.stringify(scan)).not.toContain(outsideRoot)
      expect(JSON.stringify(scan)).not.toContain('OUTSIDE_SECRET_SENTINEL')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('resolves a static island fallback relative to the island directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal19-fallback-'))
    const vaultRoot = join(root, 'vault')
    const islandRoot = join(vaultRoot, 'interactives', 'nested-html')
    const target = join(root, 'static.html')
    const fallback =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>ISLAND_RELATIVE_FALLBACK</text></svg>'
    const manifest: SandboxManifest = {
      name: 'Nested fallback fixture',
      version: '1.0.0',
      runtime: 'html',
      permissions: { network: false, filesystem: false, dataPaths: [] },
      propsSchema: {},
      dependencies: {},
      fallback: './assets/fallback.svg'
    }

    try {
      await Promise.all([
        mkdir(join(vaultRoot, 'notes', 'deep'), { recursive: true }),
        mkdir(join(islandRoot, 'assets'), { recursive: true })
      ])
      await Promise.all([
        writeFile(
          join(vaultRoot, 'notes', 'deep', 'fallback.mdx'),
          '<SandboxedHTML src="../../interactives/nested-html/index.html" />'
        ),
        writeFile(join(islandRoot, 'manifest.json'), JSON.stringify(manifest)),
        writeFile(join(islandRoot, 'index.html'), '<strong>live island</strong>'),
        writeFile(join(islandRoot, 'assets', 'fallback.svg'), fallback)
      ])

      const vault = new VaultService(vaultRoot)
      const sandbox = new SandboxService(vault)
      const descriptor = await sandbox.describeHtml(
        '../../interactives/nested-html/index.html',
        'notes/deep/fallback.mdx'
      )
      await sandbox.setPermission({
        kind: 'html',
        src: '../../interactives/nested-html/index.html',
        notePath: 'notes/deep/fallback.mdx',
        contentHash: descriptor.contentHash,
        decision: 'allow'
      })
      const service = new ExportService(vault, new SandboxExportBridge(sandbox))
      const result = await service.run(
        {
          noteRelativePath: 'notes/deep/fallback.mdx',
          mode: 'static',
          target: { absolutePath: target },
          confirmedOversized: true
        },
        () => undefined
      )
      const html = await readFile(target, 'utf8')
      expect(html).toContain(Buffer.from(fallback).toString('base64'))
      expect(result.fallbacksUsed).toContain('Nested fallback fixture: static offline fallback')
      expect(html).not.toContain(vaultRoot)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

function createService(vaultRoot: string): ExportService {
  const vault = new VaultService(vaultRoot)
  return new ExportService(vault, new SandboxExportBridge(new SandboxService(vault)))
}
