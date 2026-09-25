import { javascriptLanguage } from '@codemirror/lang-javascript'
import { syntaxTree } from '@codemirror/language'
import { type Diagnostic, linter } from '@codemirror/lint'
import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import { classHighlighter, highlightTree } from '@lezer/highlight'
import { EditorAnalysisClient } from './editor-analysis-client'

export { diagnoseMdxSource, type MdxSourceIssue } from './mdx-source-diagnostics'

const MAX_EXPRESSION_HIGHLIGHT_LENGTH = 20_000
const mdxExpressionParser = javascriptLanguage.parser.configure({ top: 'SingleExpression' })

const diagnosticWorker = ViewPlugin.fromClass(
  class {
    client = new EditorAnalysisClient('diagnostics')
    destroy(): void {
      this.client.dispose()
    }
  }
)

export const mdxSyntaxDiagnosticsExtension = [
  diagnosticWorker,
  linter(
    async (view): Promise<readonly Diagnostic[]> => {
      const doc = view.state.doc
      if (view.composing) return []
      const result = await view.plugin(diagnosticWorker)?.client.analyze(doc.toString())
      if (!result || view.state.doc !== doc) return []
      return result.issues.map((issue) => {
        const from = Math.min(view.state.doc.length, Math.max(0, issue.offset))
        const to = Math.min(view.state.doc.length, from + 1)
        return {
          from,
          to,
          severity: 'error',
          source: 'MDX',
          message: issue.message
        }
      })
    },
    { delay: 650 }
  )
]

/** Highlight JavaScript inside MDX brace expressions with the real Lezer JS parser. */
export const mdxExpressionHighlightExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildExpressionHighlights(view)
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildExpressionHighlights(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

function buildExpressionHighlights(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const visited = new Set<number>()

  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        if (node.name !== 'MDXBrace' || visited.has(node.from)) {
          return
        }
        visited.add(node.from)

        const from = node.from + 1
        const to = node.to - 1
        const length = to - from
        if (length <= 0 || length > MAX_EXPRESSION_HIGHLIGHT_LENGTH) {
          return false
        }

        const expression = view.state.doc.sliceString(from, to)
        const tree = mdxExpressionParser.parse(expression)
        highlightTree(tree, classHighlighter, (tokenFrom, tokenTo, classes) => {
          if (tokenFrom < tokenTo) {
            builder.add(from + tokenFrom, from + tokenTo, Decoration.mark({ class: classes }))
          }
        })
        return false
      }
    })
  }

  return builder.finish()
}
