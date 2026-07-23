import { describe, expect, test } from 'bun:test'

import { resolveEditorPreviewTarget } from '../src/renderer/src/editor/editor-page-preview'

const notes = [
  {
    id: 'systems',
    relativePath: 'notes/Systems.mdx',
    title: 'Systems',
    aliases: ['Architecture'],
    mtimeMs: 1,
    contentHash: 'hash'
  }
]

describe('editor page preview target resolution', () => {
  test('resolves wikilinks with subpaths and Markdown relative paths', () => {
    expect(
      resolveEditorPreviewTarget(
        { type: 'wikilink', value: 'Architecture#Caching', from: 0, to: 24 },
        notes,
        'notes/Current.mdx'
      )
    ).toEqual({
      note: notes[0],
      subpath: { kind: 'heading', segments: ['Caching'] }
    })

    expect(
      resolveEditorPreviewTarget(
        { type: 'path', value: './Systems.mdx#Memory', from: 0, to: 20 },
        notes,
        'notes/Current.mdx'
      )
    ).toEqual({
      note: notes[0],
      subpath: { kind: 'heading', segments: ['Memory'] }
    })
  })

  test('ignores component and non-note paths', () => {
    expect(
      resolveEditorPreviewTarget(
        { type: 'component', value: 'QuizBlock', from: 0, to: 9 },
        notes,
        'notes/Current.mdx'
      )
    ).toBeNull()
    expect(
      resolveEditorPreviewTarget(
        { type: 'path', value: '../assets/image.png', from: 0, to: 19 },
        notes,
        'notes/Current.mdx'
      )
    ).toBeNull()
  })
})
