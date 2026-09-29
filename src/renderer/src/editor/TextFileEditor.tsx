import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { yaml } from '@codemirror/lang-yaml'
import { syntaxHighlighting } from '@codemirror/language'
import { setDiagnostics } from '@codemirror/lint'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'
import {
  createInteractiveCodeIntelligenceExtensions,
  type InteractiveCodeIntelligence,
  mapInteractiveDiagnosticsForEditor
} from '@/interactive/interactive-code-intelligence'
import type { InteractiveDiagnostic } from '../../../shared/interactive-authoring'
import { registerActiveEditorView } from './active-editor-view'
import { readEditorDocument } from './editor-document'
import { useSourceEditorPreferences } from './editor-preferences-context'
import { buildEditorSelectionSnapshot, type EditorSelectionSnapshot } from './editor-selection'
import { editorHighlightStyle, editorTheme } from './editor-theme'
import { createSourceEditorPreferenceExtensions } from './source-editor-extensions'
import { sourceEditorSetup } from './source-editor-setup'

interface TextFileEditorProps {
  relativePath: string
  value: string
  onChange: (value: string) => void
  onSelectionChange?: (snapshot: EditorSelectionSnapshot) => void
  intelligence?: InteractiveCodeIntelligence | null
  diagnostics?: readonly InteractiveDiagnostic[]
  revealRequest?: TextFileRevealRequest | null
}

export interface TextFileRevealRequest {
  requestId: number
  from: number
  to: number
}

export function TextFileEditor({
  relativePath,
  value,
  onChange,
  onSelectionChange,
  intelligence = null,
  diagnostics = [],
  revealRequest = null
}: TextFileEditorProps): React.JSX.Element {
  const sourceEditorPreferences = useSourceEditorPreferences()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const initialPathRef = useRef(relativePath)
  const initialValueRef = useRef(value)
  const initialSourceEditorPreferencesRef = useRef(sourceEditorPreferences)
  const [sourceEditorPreferencesCompartment] = useState(() => new Compartment())
  const onChangeRef = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const intelligenceRef = useRef(intelligence)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange
  }, [onSelectionChange])

  useEffect(() => {
    intelligenceRef.current = intelligence
  }, [intelligence])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          sourceEditorSetup,
          EditorState.lineSeparator.of(initialValueRef.current.includes('\r\n') ? '\r\n' : '\n'),
          getLanguageExtension(initialPathRef.current),
          ...(isTypeScriptPath(initialPathRef.current)
            ? [createInteractiveCodeIntelligenceExtensions(() => intelligenceRef.current)]
            : []),
          syntaxHighlighting(editorHighlightStyle),
          sourceEditorPreferencesCompartment.of(
            createSourceEditorPreferenceExtensions(
              'code',
              initialSourceEditorPreferencesRef.current
            )
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(readEditorDocument(update.state))
            }
            if (update.selectionSet || update.docChanged) {
              onSelectionChangeRef.current?.(buildEditorSelectionSnapshot(update.view))
            }
          }),
          editorTheme
        ]
      })
    })

    viewRef.current = view
    const unregisterActiveView = registerActiveEditorView(view)
    onSelectionChangeRef.current?.(buildEditorSelectionSnapshot(view))

    return () => {
      unregisterActiveView()
      view.destroy()
      viewRef.current = null
    }
  }, [sourceEditorPreferencesCompartment])

  useEffect(() => {
    const view = viewRef.current
    if (!view) {
      return
    }
    view.dispatch({
      effects: sourceEditorPreferencesCompartment.reconfigure(
        createSourceEditorPreferenceExtensions('code', sourceEditorPreferences)
      )
    })
  }, [sourceEditorPreferences, sourceEditorPreferencesCompartment])

  useEffect(() => {
    const view = viewRef.current

    if (!view) {
      return
    }

    const currentValue = readEditorDocument(view.state)

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
    if (!view) {
      return
    }
    view.dispatch(
      setDiagnostics(
        view.state,
        mapInteractiveDiagnosticsForEditor(diagnostics, relativePath, view.state.doc.length)
      )
    )
  }, [diagnostics, relativePath])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !revealRequest) {
      return
    }
    const from = Math.min(view.state.doc.length, Math.max(0, revealRequest.from))
    const to = Math.min(view.state.doc.length, Math.max(from, revealRequest.to))
    view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: 'center' })
    })
    view.focus()
  }, [revealRequest])

  return <div ref={containerRef} className="h-full overflow-hidden" />
}

function getLanguageExtension(relativePath: string): Extension {
  const extension = relativePath.split('.').at(-1)?.toLowerCase()

  switch (extension) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascript()
    case 'jsx':
      return javascript({ jsx: true })
    case 'ts':
      return javascript({ typescript: true })
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'json':
    case 'jsonc':
      return json()
    case 'yaml':
    case 'yml':
      return yaml()
    case 'html':
    case 'xml':
      return html()
    case 'py':
      return python()
    default:
      return []
  }
}

function isTypeScriptPath(relativePath: string): boolean {
  const extension = relativePath.split('.').at(-1)?.toLowerCase()
  return extension === 'ts' || extension === 'tsx'
}
