import { mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import type { SandboxManifest } from '../../shared/sandbox'
import { SandboxService } from './sandbox-service'
import { VaultService } from './vault-service'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
  toContain(expected: string): void
  rejects: { toThrow(expected?: string): Promise<void> }
}

const htmlManifest: SandboxManifest = {
  name: 'Safe HTML',
  version: '1.0.0',
  runtime: 'html',
  permissions: { network: false, filesystem: false, dataPaths: [] },
  propsSchema: {},
  dependencies: {}
}

describe('GOAL-05 sandbox security boundary', () => {
  test('binds approval to the content hash and emits a locked-down document', async () => {
    const root = await createHtmlFixture(htmlManifest)

    try {
      const service = new SandboxService(new VaultService(root))
      const first = await service.describeHtml('interactives/demo/index.html', null)
      expect(first.permissionStatus).toBe('prompt')

      await service.setPermission({
        kind: 'html',
        src: first.src,
        notePath: null,
        contentHash: first.contentHash,
        decision: 'allow'
      })
      const document = await service.loadHtml(first.src, null, first.contentHash, 'test-instance')
      expect(document.srcDoc).toContain('default-src &#39;none&#39;')
      expect(document.srcDoc).toContain('connect-src &#39;none&#39;')
      expect(document.srcDoc).toContain('event.source !== window.parent')

      await writeFile(join(root, 'interactives', 'demo', 'index.html'), '<button>Changed</button>')
      const changed = await service.describeHtml(first.src, null)
      expect(changed.permissionStatus).toBe('prompt')
      await expect(
        service.loadHtml(first.src, null, first.contentHash, 'stale-instance')
      ).rejects.toThrow('Sandbox content changed')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects traversal and invalid or missing manifests', async () => {
    const root = await createHtmlFixture(htmlManifest)
    const service = new SandboxService(new VaultService(root))

    try {
      await expect(service.describeHtml('../outside.html', null)).rejects.toThrow(
        'Sandbox path escapes the vault root'
      )
      await rm(join(root, 'interactives', 'demo', 'manifest.json'))
      await expect(service.describeHtml('interactives/demo/index.html', null)).rejects.toThrow(
        'manifest.json is required'
      )
      await writeFile(join(root, 'interactives', 'demo', 'manifest.json'), '{"runtime":"html"}')
      await expect(service.describeHtml('interactives/demo/index.html', null)).rejects.toThrow(
        'manifest.json failed schema validation'
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects undeclared and non-allowlisted dependencies during draft compilation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal05-'))
    const service = new SandboxService(new VaultService(root))
    const manifest: SandboxManifest = {
      ...htmlManifest,
      name: 'Draft',
      runtime: 'react',
      dependencies: {}
    }

    try {
      const result = await service.compileDraft(
        "import leftPad from 'left-pad'; export default () => leftPad('x', 2)",
        manifest
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors.join('; ')).toContain('dependency not allowed: left-pad')
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects dataset reads through a junction that escapes the vault', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'mdx-vault-outside-'))
    const manifest: SandboxManifest = {
      ...htmlManifest,
      permissions: {
        network: false,
        filesystem: true,
        dataPaths: ['assets/linked/secret.csv']
      }
    }
    const root = await createHtmlFixture(manifest)

    try {
      await writeFile(join(outside, 'secret.csv'), 'secret,value\nleak,1\n')
      await mkdir(join(root, 'assets'), { recursive: true })
      await symlink(outside, join(root, 'assets', 'linked'), 'junction')
      const service = new SandboxService(new VaultService(root))
      const descriptor = await service.describeHtml('interactives/demo/index.html', null)
      await service.setPermission({
        kind: 'html',
        src: descriptor.src,
        notePath: null,
        contentHash: descriptor.contentHash,
        decision: 'allow'
      })

      await expect(
        service.requestData({
          kind: 'html',
          src: descriptor.src,
          notePath: null,
          contentHash: descriptor.contentHash,
          path: 'assets/linked/secret.csv'
        })
      ).rejects.toThrow('Sandbox path resolves outside the vault root')
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })
})

async function createHtmlFixture(manifest: SandboxManifest): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal05-'))
  const interactiveRoot = join(root, 'interactives', 'demo')
  await mkdir(interactiveRoot, { recursive: true })
  await writeFile(join(interactiveRoot, 'index.html'), '<button type="button">Run</button>')
  await writeFile(join(interactiveRoot, 'manifest.json'), JSON.stringify(manifest))
  return root
}
