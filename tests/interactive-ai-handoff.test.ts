import { describe, expect, it } from 'bun:test'
import { completeInteractiveAiHandoff } from '../src/renderer/src/interactive/interactive-ai-handoff'
import type { PatchOperation } from '../src/shared/ai'

const componentDraft: PatchOperation = {
  kind: 'componentDraft',
  folderRelativePath: 'interactives/counter',
  componentSource: 'export default function Counter() { return null }',
  manifestJson: '{}',
  readmeMarkdown: '# Counter',
  provenance: {
    prompt: 'Create a counter',
    noteRelativePath: 'notes/source.mdx',
    modelName: 'fixture',
    generatedAt: '2026-07-26T00:00:00.000Z'
  }
}

describe('interactive AI handoff', () => {
  it('refreshes, reconciles the approved note, and opens the physical component file', async () => {
    const calls: string[] = []
    const result = await completeInteractiveAiHandoff(
      {
        noteRelativePath: 'notes/source.mdx',
        operations: [componentDraft],
        output: {
          writtenPaths: [
            'notes/source.mdx',
            'interactives/counter/component.tsx',
            'interactives/counter/manifest.json',
            'interactives/counter/README.md'
          ]
        }
      },
      {
        refreshVaultSnapshot: async () => {
          calls.push('refresh')
          return [
            {
              relativePath: 'interactives/counter/component.tsx',
              name: 'component.tsx',
              directory: 'interactives/counter',
              extension: '.tsx'
            }
          ]
        },
        getSelectedNotePath: () => 'notes/source.mdx',
        readFile: async (relativePath) => {
          calls.push(`read:${relativePath}`)
          return '# persisted\n\n<Interactive src="../interactives/counter" />\n'
        },
        restoreNoteBuffer: (relativePath) => calls.push(`restore:${relativePath}`),
        openOrActivate: async (relativePath, options) => {
          calls.push(`open:${relativePath}:${options.focus}:${options.knownFile?.name}`)
          return true
        }
      }
    )

    expect(result).toEqual({
      componentRelativePath: 'interactives/counter/component.tsx',
      noteBufferReconciled: true,
      componentOpened: true
    })
    expect(calls).toEqual([
      'refresh',
      'read:notes/source.mdx',
      'restore:notes/source.mdx',
      'open:interactives/counter/component.tsx:true:component.tsx'
    ])
  })

  it('does not clobber a note selected while approval was in flight or grant run consent', async () => {
    let restored = false
    let opened = false
    const consented = false

    const result = await completeInteractiveAiHandoff(
      {
        noteRelativePath: 'notes/original.mdx',
        operations: [componentDraft],
        output: {
          writtenPaths: ['notes/original.mdx', 'interactives/counter/component.tsx']
        }
      },
      {
        refreshVaultSnapshot: async () => [],
        getSelectedNotePath: () => 'notes/new-selection.mdx',
        readFile: async () => {
          throw new Error('must not read a background note')
        },
        restoreNoteBuffer: () => {
          restored = true
        },
        openOrActivate: async () => {
          opened = true
          return true
        }
      }
    )

    expect(restored).toBe(false)
    expect(opened).toBe(true)
    expect(consented).toBe(false)
    expect(result.noteBufferReconciled).toBe(false)
  })

  it('leaves ordinary text-only approvals on the existing note surface', async () => {
    let opened = false
    const result = await completeInteractiveAiHandoff(
      {
        noteRelativePath: 'notes/source.mdx',
        operations: [
          {
            kind: 'textPatch',
            from: 0,
            to: 0,
            replacement: '# Updated\n',
            expectedText: ''
          }
        ],
        output: { writtenPaths: ['notes/source.mdx'] }
      },
      {
        refreshVaultSnapshot: async () => [],
        getSelectedNotePath: () => null,
        readFile: async () => '',
        restoreNoteBuffer: () => {},
        openOrActivate: async () => {
          opened = true
          return true
        }
      }
    )

    expect(result.componentRelativePath).toBeNull()
    expect(opened).toBe(false)
  })
})
