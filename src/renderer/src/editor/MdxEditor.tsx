import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { HighlightStyle, LanguageDescription, syntaxHighlighting } from '@codemirror/language'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { basicSetup } from 'codemirror'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ComponentInsertPalette } from './ComponentInsertPalette'
import { mdxHighlightExtension } from './mdx-highlight'
import { getRegistryInsertTemplates, type RegistryInsertTemplate } from '@/preview/registry'

export interface RevealLineRequest {
  line: number
  requestId: number
}

export interface EditorSelectionSnapshot {
  /** True when the selection is non-empty. */
  hasSelection: boolean
  /** 1-based line where the selection starts. */
  startLine: number
  /** 0-based column where the selection starts. */
  startColumn: number
  /** 1-based line where the selection ends. */
  endLine: number
  /** 0-based column where the selection ends. */
  endColumn: number
  /** The exact text inside the selection (already trimmed at the boundary by CodeMirror). */
  text: string
}

interface MdxEditorProps {
  value: string
  onChange: (value: string) => void
  revealLineRequest?: RevealLineRequest | null
  onSelectionChange?: (snapshot: EditorSelectionSnapshot) => void
}

const codeLanguages = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'jsx', 'ts', 'tsx'],
    extensions: ['js', 'jsx', 'ts', 'tsx'],
    support: javascript({ jsx: true, typescript: true })
  }),
  LanguageDescription.of({
    name: 'HTML',
    alias: ['html'],
    extensions: ['html'],
    support: html()
  }),
  LanguageDescription.of({
    name: 'YAML',
    alias: ['yaml', 'yml'],
    extensions: ['yaml', 'yml'],
    support: yaml()
  })
]

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--card)'
  },
  '.cm-scroller': {
    fontFamily:
      '"JetBrains Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '13.5px',
    lineHeight: '1.7'
  },
  '.cm-content': {
    padding: '20px 0',
    caretColor: 'var(--viridian)'
  },
  '.cm-line': {
    padding: '0 20px'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--muted)',
    borderRightColor: 'var(--border)',
    color: 'var(--muted-foreground)',
    fontFamily:
      '"JetBrains Mono", "Cascadia Code", ui-monospace, monospace',
    fontSize: '11px'
  },
  '.cm-activeLineGutter, .cm-activeLine': {
    backgroundColor: 'var(--secondary)'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklch, var(--viridian) 20%, transparent) !important'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--viridian)'
  },
  '&.cm-focused': {
    outline: 'none'
  }
})

/**
 * Highlight style mapping the Lezer tags produced by `mdx-highlight.ts` (and
 * the standard markdown/JS tags already used by `@codemirror/lang-markdown`)
 * to actual editor colors. Without this, the parser tags the tokens but no
 * color is applied — JSX/braces render as plain prose. The CSS variables match
 * the design tokens defined in `globals.css` and adapt to light/dark themes.
 */
const mdxHighlightStyle = HighlightStyle.define([
  // JSX tag name (e.g. the `QuizBlock` in `<QuizBlock />`).
  { tag: t.tagName, color: 'var(--viridian)', fontWeight: '600' },
  // JSX attribute name (e.g. `bar` in `bar="x"`).
  { tag: t.attributeName, color: 'var(--chart-3)' },
  // JSX attribute string value (e.g. `"x"` in `bar="x"`).
  { tag: t.string, color: 'var(--chart-2)' },
  // JSX angle brackets, `/`, `=`, etc.
  { tag: t.angleBracket, color: 'var(--muted-foreground)' },
  // MDX brace expression marks (`{` and `}`).
  { tag: t.brace, color: 'var(--viridian)' }
])

export function MdxEditor({
  value,
  onChange,
  revealLineRequest,
  onSelectionChange
}: MdxEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const initialValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const insertTemplates = useMemo(() => getRegistryInsertTemplates(), [])
  const [insertPaletteOpen, setInsertPaletteOpen] = useState(false)

  const openInsertPalette = useCallback((view: EditorView): boolean => {
    viewRef.current = view
    setInsertPaletteOpen(true)
    return true
  }, [])

  const closeInsertPalette = useCallback(() => {
    setInsertPaletteOpen(false)
    viewRef.current?.focus()
  }, [])

  const insertTemplate = useCallback((template: RegistryInsertTemplate) => {
    const view = viewRef.current

    if (!view) {
      return
    }

    view.dispatch(view.state.replaceSelection(createSnippetInsertion(view, template.snippet)))
    setInsertPaletteOpen(false)
    view.focus()
  }, [])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          basicSetup,
          markdown({ codeLanguages, extensions: mdxHighlightExtension }),
          syntaxHighlighting(mdxHighlightStyle),
          Prec.highest(
            keymap.of([
              {
                key: 'Mod-k',
                run: openInsertPalette
              },
              {
                key: '/',
                run: (view) => {
                  if (!shouldOpenSlashCommand(view)) {
                    return false
                  }

                  return openInsertPalette(view)
                }
              }
            ])
          ),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
            if (update.selectionSet || update.docChanged) {
              const callback = onSelectionChangeRef.current
              if (callback) {
                callback(buildSelectionSnapshot(update.view))
              }
            }
          }),
          editorTheme
        ]
      })
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [openInsertPalette])

  useEffect(() => {
    const view = viewRef.current

    if (!view) {
      return
    }

    const currentValue = view.state.doc.toString()

    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value
        }
      })
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current

    if (!view || !revealLineRequest) {
      return
    }

    const lineNumber = Math.min(Math.max(1, revealLineRequest.line), view.state.doc.lines)
    const line = view.state.doc.line(lineNumber)

    view.dispatch({
      selection: {
        anchor: line.from
      },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' })
    })
    view.focus()
  }, [revealLineRequest])

  return (
    <div className="relative h-full overflow-hidden">
      <div ref={containerRef} className="h-full overflow-hidden" />
      {insertPaletteOpen ? (
        <ComponentInsertPalette
          templates={insertTemplates}
          onClose={closeInsertPalette}
          onSelect={insertTemplate}
        />
      ) : null}
    </div>
  )
}

function shouldOpenSlashCommand(view: EditorView): boolean {
  const selection = view.state.selection.main

  if (!selection.empty) {
    return false
  }

  const line = view.state.doc.lineAt(selection.from)
  const textBeforeCursor = view.state.doc.sliceString(line.from, selection.from)

  return textBeforeCursor.trim().length === 0
}

function buildSelectionSnapshot(view: EditorView): EditorSelectionSnapshot {
  const selection = view.state.selection.main
  const startLine = view.state.doc.lineAt(selection.from).number
  const endLine = view.state.doc.lineAt(selection.to).number
  const startLineInfo = view.state.doc.line(startLine)
  const endLineInfo = view.state.doc.line(endLine)
  const text = view.state.sliceDoc(selection.from, selection.to)

  return {
    hasSelection: !selection.empty,
    startLine,
    startColumn: Math.max(0, selection.from - startLineInfo.from),
    endLine,
    endColumn: Math.max(0, selection.to - endLineInfo.from),
    text
  }
}

function createSnippetInsertion(view: EditorView, snippet: string): string {
  const selection = view.state.selection.main

  if (!selection.empty) {
    return snippet
  }

  const characterBefore =
    selection.from > 0 ? view.state.doc.sliceString(selection.from - 1, selection.from) : '\n'
  const characterAfter =
    selection.to < view.state.doc.length
      ? view.state.doc.sliceString(selection.to, selection.to + 1)
      : '\n'
  const prefix = characterBefore === '\n' ? '' : '\n\n'
  const suffix = characterAfter === '\n' ? '' : '\n'

  return `${prefix}${snippet}${suffix}`
}
