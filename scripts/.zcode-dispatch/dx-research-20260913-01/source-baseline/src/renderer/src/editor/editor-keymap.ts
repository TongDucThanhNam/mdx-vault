import { acceptCompletion, completionStatus } from '@codemirror/autocomplete'
import { indentLess, indentMore } from '@codemirror/commands'
import { getIndentUnit } from '@codemirror/language'
import { countColumn, EditorSelection, Prec } from '@codemirror/state'
import { type EditorView, keymap } from '@codemirror/view'

/** Snippet fields retain CodeMirror's highest precedence, then completion, then Tab stops. */
export const editorTabKeymap = Prec.high(
  keymap.of([{ key: 'Tab', run: handleEditorTab, shift: indentLess }])
)

export function handleEditorTab(view: EditorView): boolean {
  if (view.state.readOnly) return false
  if (completionStatus(view.state) === 'active') {
    // Consume an early Tab during CodeMirror's interaction guard too: never
    // indent the document while the user is trying to accept a visible item.
    acceptCompletion(view)
    return true
  }
  return insertSoftTab(view)
}

export function insertSoftTab({
  state,
  dispatch
}: Pick<EditorView, 'state' | 'dispatch'>): boolean {
  if (state.readOnly) return false
  if (state.selection.ranges.some((range) => !range.empty)) {
    return indentMore({ state, dispatch })
  }
  const unit = getIndentUnit(state)
  dispatch(
    state.update(
      state.changeByRange((range) => {
        const line = state.doc.lineAt(range.head)
        const column = countColumn(line.text.slice(0, range.head - line.from), state.tabSize)
        const insert = ' '.repeat(unit - (column % unit))
        return {
          changes: { from: range.head, insert },
          range: EditorSelection.cursor(range.head + insert.length)
        }
      }),
      { scrollIntoView: true, userEvent: 'input.indent' }
    )
  )
  return true
}
