import { indentUnit } from '@codemirror/language'
import { EditorState, type Extension, RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  highlightWhitespace,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import type { SourceEditorPreferences } from './editor-preferences-context'

export type SourceDocumentKind = 'note' | 'code'

/** Raw MDX is a code buffer; only Live mode keeps prose-oriented wrapping. */
export function sourceDocumentKindForMdxDisplayMode(
  displayMode: 'source' | 'live'
): SourceDocumentKind {
  return displayMode === 'source' ? 'code' : 'note'
}

export function createSourceEditorPreferenceExtensions(
  kind: SourceDocumentKind,
  preferences: SourceEditorPreferences
): Extension {
  const wrap = kind === 'note' ? preferences.noteWordWrap : preferences.codeWordWrap
  const classes = [
    `cm-source-${kind}`,
    `cm-wrap-${wrap}`,
    preferences.showRuler ? 'cm-show-ruler' : '',
    preferences.ligatures ? 'cm-use-ligatures' : 'cm-no-ligatures'
  ]
    .filter(Boolean)
    .join(' ')

  return [
    EditorState.tabSize.of(preferences.tabSize),
    indentUnit.of(' '.repeat(preferences.tabSize)),
    EditorView.editorAttributes.of({
      class: classes,
      'data-source-kind': kind,
      'data-word-wrap': wrap
    }),
    wrap === 'off' ? [] : EditorView.lineWrapping,
    preferences.showWhitespace ? highlightWhitespace() : [],
    preferences.indentGuides ? indentationGuides : []
  ]
}

const indentationGuides = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildIndentationGuides(view)
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildIndentationGuides(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

function buildIndentationGuides(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  let previousLineNumber = 0

  for (const range of view.visibleRanges) {
    let line = view.state.doc.lineAt(range.from)
    while (line.from <= range.to) {
      if (line.number > previousLineNumber) {
        previousLineNumber = line.number
        const indentation = /^[\t ]+/.exec(line.text)?.[0] ?? ''
        if (indentation.length > 0 && indentation.length < line.text.length) {
          builder.add(
            line.from,
            line.from + indentation.length,
            Decoration.mark({ class: 'cm-indentation-guides' })
          )
        }
      }

      if (line.to >= range.to || line.number >= view.state.doc.lines) {
        break
      }
      line = view.state.doc.line(line.number + 1)
    }
  }

  return builder.finish()
}
