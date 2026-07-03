import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { LanguageDescription } from '@codemirror/language'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ComponentInsertPalette } from './ComponentInsertPalette'
import { getRegistryInsertTemplates, type RegistryInsertTemplate } from '@/preview/registry'

export interface RevealLineRequest {
  line: number
  requestId: number
}

interface MdxEditorProps {
  value: string
  onChange: (value: string) => void
  revealLineRequest?: RevealLineRequest | null
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
    backgroundColor: 'var(--background)'
  },
  '.cm-scroller': {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '1.65'
  },
  '.cm-content': {
    padding: '18px 0',
    caretColor: 'var(--foreground)'
  },
  '.cm-line': {
    padding: '0 18px'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--muted)',
    borderRightColor: 'var(--border)'
  },
  '.cm-activeLineGutter, .cm-activeLine': {
    backgroundColor: 'var(--accent)'
  },
  '&.cm-focused': {
    outline: 'none'
  }
})

export function MdxEditor({
  value,
  onChange,
  revealLineRequest
}: MdxEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const initialValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
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
    if (!containerRef.current) {
      return
    }

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          basicSetup,
          markdown({ codeLanguages }),
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
