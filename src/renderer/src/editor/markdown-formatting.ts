import {
  EditorSelection,
  type EditorState,
  type SelectionRange,
  type TransactionSpec
} from '@codemirror/state'
import { type Command, keymap } from '@codemirror/view'

export type MarkdownFormat = 'bold' | 'italic' | 'inline-code' | 'highlight'

interface MarkdownDelimiter {
  prefix: string
  suffix: string
}

const MARKDOWN_DELIMITERS: Readonly<Record<MarkdownFormat, MarkdownDelimiter>> = {
  bold: { prefix: '**', suffix: '**' },
  italic: { prefix: '*', suffix: '*' },
  'inline-code': { prefix: '`', suffix: '`' },
  highlight: { prefix: '==', suffix: '==' }
}

/** Keyboard-first Markdown formatting, scoped to the MDX editor only. */
export const markdownFormattingKeymap = keymap.of([
  { key: 'Mod-b', run: formatMarkdown('bold') },
  { key: 'Mod-i', run: formatMarkdown('italic') },
  { key: 'Mod-e', run: formatMarkdown('inline-code') },
  { key: 'Ctrl-Shift-h', run: formatMarkdown('highlight') }
])

export function createMarkdownFormattingTransaction(
  state: EditorState,
  format: MarkdownFormat
): TransactionSpec {
  const delimiter = MARKDOWN_DELIMITERS[format]
  return state.changeByRange((range) => formatRange(state, range, delimiter))
}

function formatMarkdown(format: MarkdownFormat): Command {
  return (view) => {
    view.dispatch(createMarkdownFormattingTransaction(view.state, format))
    return true
  }
}

function formatRange(
  state: EditorState,
  range: SelectionRange,
  delimiter: MarkdownDelimiter
): { changes: TransactionSpec['changes']; range: SelectionRange } {
  const { prefix, suffix } = delimiter
  const selected = state.sliceDoc(range.from, range.to)

  if (
    !range.empty &&
    selected.length >= prefix.length + suffix.length &&
    selected.startsWith(prefix) &&
    selected.endsWith(suffix)
  ) {
    const inner = selected.slice(prefix.length, selected.length - suffix.length)
    return {
      changes: { from: range.from, to: range.to, insert: inner },
      range: EditorSelection.range(range.from, range.from + inner.length)
    }
  }

  const prefixFrom = range.from - prefix.length
  const suffixTo = range.to + suffix.length
  if (
    !range.empty &&
    prefixFrom >= 0 &&
    suffixTo <= state.doc.length &&
    state.sliceDoc(prefixFrom, range.from) === prefix &&
    state.sliceDoc(range.to, suffixTo) === suffix &&
    !hasAmbiguousAdjacentDelimiter(state, prefixFrom, suffixTo, delimiter)
  ) {
    return {
      changes: [
        { from: prefixFrom, to: range.from },
        { from: range.to, to: suffixTo }
      ],
      range: EditorSelection.range(prefixFrom, range.to - prefix.length)
    }
  }

  const insert = `${prefix}${selected}${suffix}`
  const selectionFrom = range.from + prefix.length
  return {
    changes: { from: range.from, to: range.to, insert },
    range: range.empty
      ? EditorSelection.cursor(selectionFrom)
      : EditorSelection.range(selectionFrom, selectionFrom + selected.length)
  }
}

function hasAmbiguousAdjacentDelimiter(
  state: EditorState,
  prefixFrom: number,
  suffixTo: number,
  delimiter: MarkdownDelimiter
): boolean {
  if (delimiter.prefix !== delimiter.suffix || delimiter.prefix.length !== 1) {
    return false
  }

  const marker = delimiter.prefix
  return (
    (prefixFrom > 0 && state.sliceDoc(prefixFrom - 1, prefixFrom) === marker) ||
    (suffixTo < state.doc.length && state.sliceDoc(suffixTo, suffixTo + 1) === marker)
  )
}
