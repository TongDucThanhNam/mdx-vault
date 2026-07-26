import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'crypto'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  InteractiveAuthoringService,
  type InteractiveCommitStage
} from '../src/main/services/interactive-authoring-service'
import { VaultService } from '../src/main/services/vault-service'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('GOAL-25 interactive create transaction', () => {
  test('commits the three app-owned files and exact note insertion together', async () => {
    const { root, noteContent } = await createVaultFixture()
    const service = createService(new VaultService(root))
    const result = await service.create({
      noteRelativePath: 'notes/deep/Lab.mdx',
      insertionOffset: noteContent.indexOf('Đặt'),
      expectedContentHash: sha256(noteContent),
      displayName: 'State Lab',
      slug: 'state-lab',
      starter: 'stateful-control'
    })

    expect(result.projectRoot).toBe('interactives/state-lab')
    expect(result.componentRelativePath).toBe('interactives/state-lab/component.tsx')
    expect(await readFile(join(root, result.componentRelativePath), 'utf8')).toContain('useState')
    expect(await readFile(join(root, 'interactives/state-lab/manifest.json'), 'utf8')).toContain(
      '"network": false'
    )
    expect(await readFile(join(root, 'interactives/state-lab/README.md'), 'utf8')).toContain(
      'created manually'
    )
    expect(await readFile(join(root, 'notes/deep/Lab.mdx'), 'utf8')).toBe(result.noteContent)
    expect(result.noteContent).toContain(
      '<Interactive src="../../interactives/state-lab" />\n\nĐặt proof ở đây.'
    )
  })

  test('rejects stale revisions before creating a destination', async () => {
    const { root, noteContent } = await createVaultFixture()
    const service = createService(new VaultService(root))

    await expect(
      service.create({
        noteRelativePath: 'notes/deep/Lab.mdx',
        insertionOffset: noteContent.length,
        expectedContentHash: '0'.repeat(64),
        displayName: 'Stale',
        slug: 'stale',
        starter: 'blank'
      })
    ).rejects.toMatchObject({ code: 'STALE_NOTE' })

    expect(await readFile(join(root, 'notes/deep/Lab.mdx'), 'utf8')).toBe(noteContent)
    expect(await exists(join(root, 'interactives/stale'))).toBe(false)
  })

  test('preserves an existing partial folder and rejects case-insensitive collisions', async () => {
    const { root, noteContent } = await createVaultFixture()
    await mkdir(join(root, 'interactives/Counter'), { recursive: true })
    await writeFile(join(root, 'interactives/Counter/manifest.json'), '{}', 'utf8')
    const service = createService(new VaultService(root))

    await expect(
      service.create({
        noteRelativePath: 'notes/deep/Lab.mdx',
        insertionOffset: noteContent.length,
        expectedContentHash: sha256(noteContent),
        displayName: 'Counter',
        slug: 'counter',
        starter: 'blank'
      })
    ).rejects.toMatchObject({ code: 'DESTINATION_EXISTS' })

    expect(await readFile(join(root, 'interactives/Counter/manifest.json'), 'utf8')).toBe('{}')
    expect(await readFile(join(root, 'notes/deep/Lab.mdx'), 'utf8')).toBe(noteContent)
  })

  test('rolls back the note, temp files, and empty folders after every commit-stage failure', async () => {
    const stages: InteractiveCommitStage[] = ['component', 'manifest', 'readme', 'note', 'finalize']

    for (const stage of stages) {
      const { root, noteContent } = await createVaultFixture()
      const service = createService(new VaultService(root), stage)

      await expect(
        service.create({
          noteRelativePath: 'notes/deep/Lab.mdx',
          insertionOffset: noteContent.length,
          expectedContentHash: sha256(noteContent),
          displayName: `Failure ${stage}`,
          slug: `failure-${stage}`,
          starter: 'blank'
        })
      ).rejects.toThrow(`Injected ${stage} failure`)

      expect(await readFile(join(root, 'notes/deep/Lab.mdx'), 'utf8')).toBe(noteContent)
      expect(await exists(join(root, `interactives/failure-${stage}`))).toBe(false)
    }
  })
})

async function createVaultFixture(): Promise<{ root: string; noteContent: string }> {
  const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal25-create-'))
  roots.push(root)
  const noteContent = '# Thử nghiệm 🧪\n\nĐặt proof ở đây.\n'
  await mkdir(join(root, 'notes/deep'), { recursive: true })
  await writeFile(join(root, 'notes/deep/Lab.mdx'), noteContent, 'utf8')
  return { root, noteContent }
}

function createService(
  vault: VaultService,
  failureStage?: InteractiveCommitStage
): InteractiveAuthoringService {
  return new InteractiveAuthoringService(vault, {
    validateDraft: async () => ({
      ok: true,
      contentHash: 'b'.repeat(64),
      script: 'validated'
    }),
    onCommitStage: async (stage) => {
      if (stage === failureStage) {
        throw new Error(`Injected ${stage} failure`)
      }
    }
  })
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
