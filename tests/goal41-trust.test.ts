import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { history, redo, undo } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { resolveActiveHeadingFromOffset } from '../src/renderer/src/components/layout/living-outline'
import { buildEditorSelectionSnapshot } from '../src/renderer/src/editor/editor-selection'
import { createMarkdownFormattingTransaction } from '../src/renderer/src/editor/markdown-formatting'
import {
  detectLineSeparator,
  editorOffsetToSource,
  MdxBufferSource,
  sourceOffsetToEditor,
  syncMdxSource
} from '../src/renderer/src/editor/mdx-buffer-source'
import { computeWordCount } from '../src/renderer/src/lib/word-count'

const lf = '---\ntitle: Note\n---\n# First\n\nOne two\n\n## Second\nEnd\n'

describe('GOAL-41 source boundary', () => {
  for (const separator of ['\n', '\r\n']) {
    test(`untouched mounts and view reconfiguration never sync or emit (${JSON.stringify(separator)})`, () => {
      const original = lf.replace(/\n/g, separator)
      const buffer = new MdxBufferSource(original)
      for (const _mode of ['source', 'live', 'reading', 'live', 'source', 'reading']) {
        const state = EditorState.create({ doc: original })
        expect(buffer.sync(original, state)).toBeNull()
        expect(buffer.source).toBe(original)
        expect(buffer.source !== original).toBe(false)
      }
    })

    test(`real formatting and multiline edits preserve separator (${JSON.stringify(separator)})`, () => {
      const buffer = new MdxBufferSource(lf.replace(/\n/g, separator))
      let state = EditorState.create({ doc: buffer.source, selection: { anchor: 0, head: 10 } })
      state = state.update(createMarkdownFormattingTransaction(state, 'bold')).state
      expect(buffer.edit(state)).not.toBe(lf.replace(/\n/g, separator))
      state = state.update({ changes: { from: state.doc.length, insert: 'new\r\nline\n' } }).state
      const edited = buffer.edit(state)
      expect(edited).toBe(state.doc.toString().replace(/\n/g, separator))
      if (separator === '\r\n') expect(edited).not.toMatch(/(?<!\r)\n/)
      expect(buffer.sync(edited, state)).toBeNull()
    })
  }

  test('external synchronization is annotated, not echoed as a user edit', () => {
    const buffer = new MdxBufferSource('old\r\ntext')
    const state = EditorState.create({ doc: buffer.source })
    const spec = buffer.sync('new\r\ntext', state)
    expect(spec).not.toBeNull()
    expect(state.update(spec!).annotation(syncMdxSource)).toBe('new\r\ntext')
  })

  test('undo and redo serialize as real CRLF edits without losing source coordinates', () => {
    const original = lf.replace(/\n/g, '\r\n')
    const buffer = new MdxBufferSource(original)
    let state = EditorState.create({ doc: original, extensions: [history()] })
    const dispatch = (transaction: import('@codemirror/state').Transaction) => {
      state = transaction.state
      buffer.edit(state)
    }
    dispatch(state.update({ changes: { from: state.doc.length, insert: '\nAdded' } }))
    const edited = buffer.source
    expect(edited).not.toBe(original)
    expect(undo({ state, dispatch })).toBe(true)
    expect(buffer.source).toBe(original)
    expect(redo({ state, dispatch })).toBe(true)
    expect(buffer.source).toBe(edited)
    expect(buffer.source).not.toMatch(/(?<!\r)\n/)
  })

  test('mixed EOL is untouched until an edit, then uses the dominant separator (CRLF wins ties)', () => {
    for (const source of ['a\r\nb\nc\r\n', 'a\nb\nc\r\n']) {
      const buffer = new MdxBufferSource(source)
      const state = EditorState.create({ doc: source })
      expect(buffer.sync(source, state)).toBeNull()
      expect(buffer.source).toBe(source)
      expect(buffer.edit(state.update({ changes: { from: 0, insert: 'x' } }).state)).toBe(
        `x${state.doc.toString().replace(/\n/g, detectLineSeparator(source))}`
      )
    }
    expect(detectLineSeparator('a\r\nb\n')).toBe('\r\n')
  })

  test('selection, source ranges, active outline and AI text agree on CRLF coordinates', () => {
    const source = lf.replace(/\n/g, '\r\n')
    const sourceFrom = source.indexOf('## Second')
    const offset = sourceOffsetToEditor(source, sourceFrom)
    const state = EditorState.create({
      doc: source,
      selection: { anchor: offset, head: offset + 3 }
    })
    const selection = buildEditorSelectionSnapshot({ state }, source)
    expect(selection.from).toBe(sourceFrom)
    expect(selection.headLine).toBe(8)
    expect(selection.headColumn).toBe(3)
    expect(selection.text).toBe('## ')
    expect(
      resolveActiveHeadingFromOffset(
        [
          {
            id: 'first',
            sourceFrom: 0,
            sourceTo: 10,
            text: 'First',
            slug: 'first',
            depth: 1,
            position: 0
          },
          {
            id: 'second',
            sourceFrom,
            sourceTo: sourceFrom + 9,
            text: 'Second',
            slug: 'second',
            depth: 2,
            position: 1
          }
        ],
        selection.head
      )
    ).toBe('second')
    for (let index = 0; index <= state.doc.length; index++) {
      expect(sourceOffsetToEditor(source, editorOffsetToSource(source, index))).toBe(index)
    }
    expect(computeWordCount(source)).toEqual(computeWordCount(lf))
  })

  test('cursor ownership is scoped to session/item and authoring forwards selection', () => {
    const hook = readFileSync('src/renderer/src/hooks/useEditorInteractions.ts', 'utf8')
    expect(hook).toContain('ownedSelection?.identity === documentIdentity')
    expect(hook).toContain('identity: documentIdentity, snapshot')
    const app = readFileSync('src/renderer/src/App.tsx', 'utf8')
    expect(app).toContain('editorTabs.state.sessionId')
    expect(app).toContain("editorTabs.activeId ?? ''")
    expect(
      readFileSync('src/renderer/src/interactive/InteractiveProofWorkbench.tsx', 'utf8')
    ).toContain('onSelectionChange={onSelectionChange}')
  })
})
