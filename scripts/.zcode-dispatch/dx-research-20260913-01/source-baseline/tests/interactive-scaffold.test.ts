import { describe, expect, test } from 'bun:test'
import {
  createInteractiveStarter,
  deriveInteractiveSlug,
  interactiveCreatePayloadSchema,
  planInteractiveNoteInsertion
} from '../src/shared/interactive-authoring'

describe('GOAL-25 interactive scaffold model', () => {
  test('derives a bounded lowercase kebab slug from a Unicode display name', () => {
    expect(deriveInteractiveSlug('  Điều khiển Trạng thái  ')).toBe('dieu-khien-trang-thai')
    expect(deriveInteractiveSlug('DNS TTL — Freshness')).toBe('dns-ttl-freshness')
  })

  test('validates the closed create payload without accepting renderer-owned source', () => {
    expect(
      interactiveCreatePayloadSchema.parse({
        noteRelativePath: 'notes/Lab.mdx',
        insertionOffset: 12,
        expectedContentHash: 'a'.repeat(64),
        displayName: 'Counter',
        slug: 'counter',
        starter: 'stateful-control'
      })
    ).toEqual({
      noteRelativePath: 'notes/Lab.mdx',
      insertionOffset: 12,
      expectedContentHash: 'a'.repeat(64),
      displayName: 'Counter',
      slug: 'counter',
      starter: 'stateful-control'
    })

    expect(() =>
      interactiveCreatePayloadSchema.parse({
        noteRelativePath: 'notes/Lab.mdx',
        insertionOffset: 12,
        expectedContentHash: 'a'.repeat(64),
        displayName: 'Counter',
        slug: '../counter',
        starter: 'custom',
        componentSource: 'arbitrary renderer source'
      })
    ).toThrow()
  })

  test('plans a nested-note POSIX src and preserves a UTF-16 caret after emoji', () => {
    const source = '# Thử nghiệm 🧪\n\nĐặt proof ở đây.'
    const insertionOffset = source.indexOf('Đặt')
    const plan = planInteractiveNoteInsertion({
      noteRelativePath: 'notes/deep/Lab.mdx',
      noteContent: source,
      insertionOffset,
      projectRoot: 'interactives/state-lab'
    })

    expect(plan.src).toBe('../../interactives/state-lab')
    expect(plan.tag).toBe('<Interactive src="../../interactives/state-lab" />')
    expect(plan.content).toBe(
      '# Thử nghiệm 🧪\n\n<Interactive src="../../interactives/state-lab" />\n\nĐặt proof ở đây.'
    )
  })

  test('rejects an insertion offset that splits a UTF-16 surrogate pair', () => {
    const source = 'A🧪B'
    expect(() =>
      planInteractiveNoteInsertion({
        noteRelativePath: 'Note.mdx',
        noteContent: source,
        insertionOffset: 2,
        projectRoot: 'interactives/test'
      })
    ).toThrow('UTF-16')
  })

  test('builds app-owned blank and stateful files with zero capabilities', () => {
    for (const starter of ['blank', 'stateful-control'] as const) {
      const files = createInteractiveStarter({
        displayName: 'State Lab',
        slug: 'state-lab',
        starter
      })
      const manifest = JSON.parse(files.manifest)

      expect(files.component).toContain('export default function')
      expect(files.readme).toContain('# State Lab')
      expect(files.readme).not.toContain('AI provenance')
      expect(manifest).toMatchObject({
        name: 'State Lab',
        runtime: 'react',
        permissions: {
          network: false,
          filesystem: false,
          dataPaths: []
        },
        propsSchema: {},
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0'
        }
      })
    }

    expect(
      createInteractiveStarter({
        displayName: 'State Lab',
        slug: 'state-lab',
        starter: 'stateful-control'
      }).component
    ).toContain('useState')
  })
})
