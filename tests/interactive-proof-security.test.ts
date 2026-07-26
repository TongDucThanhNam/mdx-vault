import { afterEach, describe, expect, test } from 'bun:test'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SandboxService } from '../src/main/services/sandbox-service'
import { VaultService } from '../src/main/services/vault-service'
import { createInteractiveProjectSnapshot } from '../src/shared/interactive-authoring'
import { validateInteractivePreviewProps } from '../src/shared/interactive-proof'
import { hostToSandboxMessageSchema, sandboxToHostMessageSchema } from '../src/shared/sandbox'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('GOAL-25 zero-capability authoring proof', () => {
  test('compiles without permission-store mutation even when manifest requests capabilities', async () => {
    const root = await createProofFixture()
    const service = new SandboxService(new VaultService(root))

    const document = await service.loadAuthoringProof(
      'interactives/proof-security',
      'proof-instance',
      { label: 'Safe' }
    )

    expect(document.resolvedPath).toBe('interactives/proof-security')
    expect(document.srcDoc).toContain('default-src &#39;none&#39;')
    expect(document.srcDoc).toContain('connect-src &#39;none&#39;')
    expect(document.srcDoc).toContain('event.source !== window.parent')
    expect(document.srcDoc).toContain("type: 'runtimeError'")
    expect(await exists(join(root, '.app', 'sandbox-permissions.json'))).toBe(false)
  })

  test('keeps preview props bounded, session-only, and on the manifest contract', () => {
    const snapshot = createInteractiveProjectSnapshot({
      projectRoot: 'interactives/props-demo',
      version: 1,
      files: [
        { relativePath: 'component.tsx', content: 'export default () => null\n' },
        {
          relativePath: 'manifest.json',
          content: JSON.stringify({
            name: 'Props demo',
            version: '1.0.0',
            runtime: 'react',
            permissions: { network: false, filesystem: false, dataPaths: [] },
            propsSchema: { label: 'string', count: 'number' },
            dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }
          })
        }
      ]
    })

    expect(validateInteractivePreviewProps(snapshot, '{"label":"A","count":2}')).toMatchObject({
      ok: true,
      props: { label: 'A', count: 2 }
    })
    expect(validateInteractivePreviewProps(snapshot, '{"label":')).toMatchObject({
      ok: false,
      diagnostics: [expect.objectContaining({ code: 'PROPS_JSON_INVALID' })]
    })
    expect(validateInteractivePreviewProps(snapshot, '{"label":"A","count":"2"}')).toMatchObject({
      ok: false,
      diagnostics: [expect.objectContaining({ code: 'PROPS_SCHEMA_INVALID' })]
    })
  })

  test('validates bounded runtime messages and explicit authoring data denial', () => {
    expect(
      sandboxToHostMessageSchema.safeParse({
        channel: 'mdx-vault',
        instanceId: 'proof',
        type: 'runtimeError',
        kind: 'unhandledrejection',
        message: 'boom',
        stack: 'at component.tsx:4:2'
      }).success
    ).toBe(true)
    expect(
      sandboxToHostMessageSchema.safeParse({
        channel: 'mdx-vault',
        instanceId: 'proof',
        type: 'runtimeError',
        kind: 'error',
        message: 'x'.repeat(8193),
        stack: null
      }).success
    ).toBe(false)
    expect(
      hostToSandboxMessageSchema.parse({
        channel: 'mdx-vault',
        instanceId: 'proof',
        type: 'dataResponse',
        requestId: 'request',
        ok: false,
        error: 'Authoring proof cannot access vault data.'
      })
    ).toMatchObject({ ok: false })
  })

  test('the proof frame denies data locally and never calls the permission API', async () => {
    const source = await readFile(
      join(process.cwd(), 'src/renderer/src/interactive/InteractiveProofFrame.tsx'),
      'utf8'
    )

    expect(source).toContain('Authoring proof cannot access vault data.')
    expect(source).not.toContain('setPermission')
    expect(source).not.toContain('requestData(')
    expect(source).toContain('sandbox="allow-scripts"')
  })
})

async function createProofFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal25-proof-'))
  roots.push(root)
  const projectRoot = join(root, 'interactives', 'proof-security')
  await mkdir(projectRoot, { recursive: true })
  await writeFile(
    join(projectRoot, 'component.tsx'),
    `export interface ProofProps { label: string }
export default function Proof({ label }: ProofProps) {
  return <button type="button">{label}</button>
}
`,
    'utf8'
  )
  await writeFile(
    join(projectRoot, 'manifest.json'),
    JSON.stringify({
      name: 'Proof security',
      version: '1.0.0',
      runtime: 'react',
      permissions: {
        network: true,
        filesystem: true,
        dataPaths: ['assets/secret.csv']
      },
      propsSchema: { label: 'string' },
      dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }
    }),
    'utf8'
  )
  return root
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
