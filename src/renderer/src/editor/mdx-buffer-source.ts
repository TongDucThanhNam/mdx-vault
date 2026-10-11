import { Annotation, type EditorState, type TransactionSpec } from '@codemirror/state'

/** Load/sync is not an edit. Approved AI/formatting/history transactions are. */
export const syncMdxSource = Annotation.define<string>()

export function detectLineSeparator(source: string): '\r\n' | '\n' {
  const crlf = source.match(/\r\n/g)?.length ?? 0
  const lf = (source.match(/\n/g)?.length ?? 0) - crlf
  return crlf > 0 && crlf >= lf ? '\r\n' : '\n'
}

export function normalizeEditorSource(source: string): string {
  return source.replace(/\r\n?/g, '\n')
}

/**
 * Keep raw source outside CodeMirror's one-character line-break coordinates.
 * Mixed input is untouched on load; the first edit uses its dominant separator.
 * Keeping CM's default splitter also makes pasted LF and CRLF equally safe.
 */
export class MdxBufferSource {
  source: string
  readonly separator: '\r\n' | '\n'

  constructor(source: string) {
    this.source = source
    this.separator = detectLineSeparator(source)
  }

  sync(value: string, state: EditorState): TransactionSpec | null {
    this.source = value
    if (state.doc.toString() === normalizeEditorSource(value)) return null
    return {
      changes: { from: 0, to: state.doc.length, insert: value },
      annotations: syncMdxSource.of(value)
    }
  }

  edit(state: EditorState): string {
    this.source = state.doc.toString().replace(/\n/g, this.separator)
    return this.source
  }
}

export function editorOffsetToSource(source: string, offset: number): number {
  let position = 0
  for (let remaining = offset; remaining > 0 && position < source.length; remaining--) {
    if (source[position] === '\r' && source[position + 1] === '\n') position++
    position++
  }
  return position
}

export function sourceOffsetToEditor(source: string, offset: number): number {
  const end = Math.min(source.length, Math.max(0, offset))
  let result = 0
  for (let position = 0; position < end; position++) {
    if (source[position] === '\r' && source[position + 1] === '\n') position++
    result++
  }
  return result
}
