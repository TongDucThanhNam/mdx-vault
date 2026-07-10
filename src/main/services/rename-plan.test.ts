import { applyRenameEdits, buildRenamePlan } from './rename-plan'
import { buildNoteIndex } from './index-service'

declare function describe(name: string, run: () => void): void
declare function test(name: string, run: () => void | Promise<void>): void
declare function expect<T>(actual: T): {
  toBe(expected: T): void
}

describe('transactional rename planner', () => {
  test('rewrites the F-01 five-link fixture without touching its controls', () => {
    const sourceOne = [
      '[[Target Note]]',
      '[[Target Note|Custom Alias]]',
      '[[folder/Target Note]]',
      '',
      '```md',
      '[[Target Note]]',
      '```',
      '',
      'Target Note is also a plain-text mention.'
    ].join('\n')
    const sourceTwo = '[Markdown target](../folder/Target%20Note.mdx)'
    const plan = buildRenamePlan({
      oldRelativePath: 'folder/Target Note.mdx',
      newRelativePath: 'archive/Renamed Target.mdx',
      notes: [
        { relativePath: 'folder/Target Note.mdx', title: 'Target Note' },
        { relativePath: 'sources/Source One.mdx', title: 'Source One' },
        { relativePath: 'sources/Source Two.mdx', title: 'Source Two' }
      ],
      sources: [
        { relativePath: 'sources/Source One.mdx', content: sourceOne },
        { relativePath: 'sources/Source Two.mdx', content: sourceTwo }
      ]
    })

    expect(plan.linkCount).toBe(4)
    expect(plan.noteCount).toBe(2)

    const rewrittenOne = applyRenameEdits(sourceOne, plan.files[0].edits)
    const rewrittenTwo = applyRenameEdits(sourceTwo, plan.files[1].edits)

    expect(rewrittenOne).toBe(
      [
        '[[Renamed Target]]',
        '[[Renamed Target|Custom Alias]]',
        '[[archive/Renamed Target]]',
        '',
        '```md',
        '[[Target Note]]',
        '```',
        '',
        'Target Note is also a plain-text mention.'
      ].join('\n')
    )
    expect(rewrittenTwo).toBe('[Markdown target](../archive/Renamed%20Target.mdx)')
  })

  test('does not rewrite a duplicate stem that resolves to another note', () => {
    const content = '[[Target Note]] and [[z/Target Note]]'
    const plan = buildRenamePlan({
      oldRelativePath: 'z/Target Note.mdx',
      newRelativePath: 'z/Renamed.mdx',
      notes: [
        { relativePath: 'a/Target Note.mdx', title: 'Target Note' },
        { relativePath: 'z/Target Note.mdx', title: 'Target Note' },
        { relativePath: 'Source.mdx', title: 'Source' }
      ],
      sources: [{ relativePath: 'Source.mdx', content }]
    })

    expect(plan.linkCount).toBe(1)
    expect(applyRenameEdits(content, plan.files[0].edits)).toBe('[[Target Note]] and [[z/Renamed]]')
  })

  test('leaves stem links unchanged for a folder-only move', () => {
    const content = '[[Target Note]] and [[folder/Target Note]]'
    const plan = buildRenamePlan({
      oldRelativePath: 'folder/Target Note.mdx',
      newRelativePath: 'archive/Target Note.mdx',
      notes: [
        { relativePath: 'folder/Target Note.mdx', title: 'Target Note' },
        { relativePath: 'Source.mdx', title: 'Source' }
      ],
      sources: [{ relativePath: 'Source.mdx', content }]
    })

    expect(plan.linkCount).toBe(1)
    expect(applyRenameEdits(content, plan.files[0].edits)).toBe(
      '[[Target Note]] and [[archive/Target Note]]'
    )
  })

  test('preserves literal and encoded Markdown destination styles', () => {
    const content = [
      '[encoded](folder/Target%20Note.mdx)',
      '[literal](<folder/Target Note.mdx>)'
    ].join('\r\n')
    const plan = buildRenamePlan({
      oldRelativePath: 'folder/Target Note.mdx',
      newRelativePath: 'archive/Renamed Target.mdx',
      notes: [
        { relativePath: 'folder/Target Note.mdx', title: 'Target Note' },
        { relativePath: 'Source.mdx', title: 'Source' }
      ],
      sources: [{ relativePath: 'Source.mdx', content }]
    })

    expect(applyRenameEdits(content, plan.files[0].edits)).toBe(
      ['[encoded](archive/Renamed%20Target.mdx)', '[literal](<archive/Renamed Target.mdx>)'].join(
        '\r\n'
      )
    )
  })

  test('indexes Markdown note links for candidate lookup', () => {
    const index = buildNoteIndex({
      relativePath: 'sources/Source.mdx',
      source: '[Target](../folder/Target%20Note.mdx#section) and [[Target Note]]',
      mtimeMs: 1
    })

    expect(index.wikilinks.length).toBe(2)
    expect(index.wikilinks[0].target).toBe('folder/Target Note.mdx')
    expect(index.wikilinks[0].targetNormalized).toBe('folder/target note')
    expect(index.wikilinks[1].target).toBe('Target Note')
  })
})
