import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { HighlightStyle, LanguageDescription, syntaxHighlighting } from '@codemirror/language'
import { search } from '@codemirror/search'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { basicSetup } from 'codemirror'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ComponentInsertPalette } from './ComponentInsertPalette'
import { InlineFormatToolbar } from './InlineFormatToolbar'
import { mdxBlockHighlightExtension, mdxHighlightExtension } from './mdx-highlight'
import { getNoteLinkKeys } from '../../../shared/wikilinks'
import { getScoredNotes } from '@/lib/fuzzy-match'
import { getRegistryInsertTemplates, type RegistryInsertTemplate } from '@/preview/registry'
import type { IndexedNoteSummary } from '@/vault/types'

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
  /** Indexed notes used as the source for `[[` wikilink autocomplete. */
  notes?: IndexedNoteSummary[]
  revealLineRequest?: RevealLineRequest | null
  onSelectionChange?: (snapshot: EditorSelectionSnapshot) => void
  /**
   * Called when the user pastes or drops an image. The handler should persist
   * the image under `<vault>/assets/` and return the vault-relative path so
   * the editor can insert a `![](assets/...)` reference.
   */
  onSaveImage?: (file: File) => Promise<string | null>
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
  // Editor = "writing voice": Courier Prime mono. Khác với preview serif.
  '.cm-scroller': {
    fontFamily: '"Courier Prime", "Courier New", ui-monospace, monospace',
    fontSize: '13.5px',
    lineHeight: '1.7'
  },
  '.cm-content': {
    padding: '20px 0',
    caretColor: 'var(--editorial-red)'
  },
  '.cm-line': {
    padding: '0 20px'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--muted)',
    borderRight: '2px solid var(--foreground)',
    color: 'var(--muted-foreground)',
    fontFamily: '"Courier Prime", "Courier New", ui-monospace, monospace',
    fontSize: '11px'
  },
  '.cm-activeLineGutter, .cm-activeLine': {
    backgroundColor: 'var(--secondary)'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--editorial-red) 22%, transparent) !important'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--editorial-red)',
    borderLeftWidth: '2px'
  },
  '.cm-mdx-math-block': {
    backgroundColor: 'color-mix(in srgb, var(--editorial-blue) 8%, transparent)'
  },
  '.cm-mdx-math-delimiter': {
    color: 'var(--editorial-blue)',
    fontWeight: '700'
  },
  '.cm-mdx-mermaid-block': {
    backgroundColor: 'color-mix(in srgb, var(--chart-5) 10%, transparent)'
  },
  '.cm-mdx-mermaid-fence': {
    color: 'var(--chart-5)',
    fontWeight: '700'
  },
  '.cm-mdx-callout-marker': {
    fontWeight: '700'
  },
  '.cm-mdx-callout-note': {
    color: 'var(--foreground)'
  },
  '.cm-mdx-callout-info': {
    color: 'var(--muted-foreground)'
  },
  '.cm-mdx-callout-tip': {
    color: 'var(--editorial-blue)'
  },
  '.cm-mdx-callout-warning': {
    color: 'var(--chart-5)'
  },
  '.cm-mdx-callout-danger': {
    color: 'var(--editorial-red)'
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
 *
 * Editorial palette: red = JSX tag/brace (the "live" markup), blue = string
 * value (the data), muted = punctuation.
 */
const mdxHighlightStyle = HighlightStyle.define([
  // JSX tag name (e.g. the `QuizBlock` in `<QuizBlock />`).
  { tag: t.tagName, color: 'var(--editorial-red)', fontWeight: '700' },
  // JSX attribute name (e.g. `bar` in `bar="x"`).
  { tag: t.attributeName, color: 'var(--chart-3)' },
  // JSX attribute string value (e.g. `"x"` in `bar="x"`).
  { tag: t.string, color: 'var(--editorial-blue)' },
  // JSX angle brackets, `/`, `=`, etc.
  { tag: t.angleBracket, color: 'var(--muted-foreground)' },
  // MDX brace expression marks (`{` and `}`).
  { tag: t.brace, color: 'var(--editorial-red)' },
  // Math spans (`$...$` / `$$...$$`) stay source text but read as math.
  { tag: t.regexp, color: 'var(--chart-5)', fontWeight: '700' },
  // Callout and math delimiters.
  { tag: t.processingInstruction, color: 'var(--editorial-red)', fontWeight: '700' },
  // Obsidian-style mark syntax (`==text==`).
  {
    tag: t.inserted,
    backgroundColor: 'color-mix(in srgb, var(--chart-5) 22%, transparent)',
    color: 'var(--foreground)'
  },
  // Wikilinks (`[[Note]]`) and tags (`#project`).
  { tag: t.link, color: 'var(--editorial-blue)', fontWeight: '700' },
  { tag: t.labelName, color: 'var(--chart-5)', fontWeight: '700' },
  { tag: t.squareBracket, color: 'var(--muted-foreground)' }
])

export function MdxEditor({
  value,
  onChange,
  notes,
  revealLineRequest,
  onSelectionChange,
  onSaveImage
}: MdxEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [liveView, setLiveView] = useState<EditorView | null>(null)
  const initialValueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onSaveImageRef = useRef(onSaveImage)
  const insertTemplates = useMemo(() => getRegistryInsertTemplates(), [])
  const [insertPaletteOpen, setInsertPaletteOpen] = useState(false)
  const [hasInlineSelection, setHasInlineSelection] = useState(false)
  const [inlineDocLength, setInlineDocLength] = useState(0)

  // Keep a ref of the latest notes so the wikilink completion source (created
  // once at editor mount) can read fresh data without recreating the extension
  // on every notes-array identity change.
  const notesRef = useRef<IndexedNoteSummary[]>(notes ?? [])
  useEffect(() => {
    notesRef.current = notes ?? []
  }, [notes])

  useEffect(() => {
    onSaveImageRef.current = onSaveImage
  }, [onSaveImage])

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

    // Closure-based completion source — reads notesRef lazily so the source
    // stays valid for the lifetime of the editor without being rebuilt when
    // notes change. Built here (inside the mount effect) to avoid the
    // react-compiler "no refs during render" rule.
    const wikilinkCompletions = (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(/\[\[[^\]\n]*/)
      if (!word || word.text.length < 2) {
        return null
      }

      const query = word.text.slice(2) // strip leading `[[`
      const notes = notesRef.current

      if (notes.length === 0) {
        return null
      }

      const scored = getScoredNotes(notes, query, 25)

      if (scored.length === 0) {
        return null
      }

      const titleCounts = new Map<string, number>()
      for (const note of notes) {
        titleCounts.set(note.title, (titleCounts.get(note.title) ?? 0) + 1)
      }

      return {
        from: word.from + 2,
        to: word.to,
        validFor: /^\[[^\]\n]*$/,
        options: scored.map(({ note }) => {
          const label = (titleCounts.get(note.title) ?? 1) > 1 ? note.relativePath : note.title
          const aliases = getNoteLinkKeys(note).filter((alias) => alias !== note.title)
          const detail =
            aliases.length > 0 ? `alias: ${aliases.slice(0, 2).join(', ')}` : note.relativePath

          return {
            label,
            detail,
            type: 'text',
            apply: (view, _completion, from, to) => {
              const insert = `${label}]]`
              view.dispatch({ changes: { from, to, insert } })
              view.focus()
            }
          }
        })
      }
    }

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          basicSetup,
          markdown({ codeLanguages, extensions: mdxHighlightExtension }),
          syntaxHighlighting(mdxHighlightStyle),
          mdxBlockHighlightExtension,
          search({ top: true }),
          autocompletion({
            override: [wikilinkCompletions],
            activateOnTyping: true
          }),
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
          EditorView.domEventHandlers({
            paste: (event) => {
              const handler = onSaveImageRef.current
              if (!handler) {
                return false
              }
              const file = pickImageFileFromDataTransfer(event.clipboardData)
              if (!file) {
                return false
              }
              void insertImageReference(event.target, file, handler)
              // Returning true lets CM skip the default (which would otherwise
              // paste the file as text/filename). We've queued the asset save
              // and will insert the markdown link when it resolves.
              return true
            },
            drop: (event) => {
              const handler = onSaveImageRef.current
              if (!handler) {
                return false
              }
              const file = pickImageFileFromDataTransfer(event.dataTransfer)
              if (!file) {
                return false
              }
              // Allow CM to first position the caret at the drop coords.
              event.preventDefault()
              void insertImageReference(event.target, file, handler)
              return true
            }
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
            if (update.selectionSet || update.docChanged) {
              const callback = onSelectionChangeRef.current
              if (callback) {
                callback(buildSelectionSnapshot(update.view))
              }
              // Track non-empty selection for the inline format toolbar.
              const main = update.state.selection.main
              setHasInlineSelection(!main.empty)
              setInlineDocLength(update.state.doc.length)
            }
          }),
          editorTheme
        ]
      })
    })

    viewRef.current = view
    setLiveView(view)

    return () => {
      view.destroy()
      viewRef.current = null
      setLiveView(null)
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
      <InlineFormatToolbar
        view={liveView}
        hasSelection={hasInlineSelection}
        docLength={inlineDocLength}
      />
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

const IMAGE_MIME_PREFIX = 'image/'
const IMAGE_MIME_ALLOWLIST = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml'
])

/**
 * Pick the first image-type File from a clipboard/drag DataTransfer. Returns
 * null if the transfer has no image file (so the editor falls through to
 * default text paste). We restrict by MIME to avoid persisting arbitrary
 * dropped binaries.
 */
function pickImageFileFromDataTransfer(transfer: DataTransfer | null): File | null {
  if (!transfer) {
    return null
  }

  // Prefer explicit file items (drag-drop). Fallback to items API for paste.
  if (transfer.files && transfer.files.length > 0) {
    for (const file of Array.from(transfer.files)) {
      if (isAllowedImageFile(file)) {
        return file
      }
    }
  }

  if (transfer.items && transfer.items.length > 0) {
    for (const item of Array.from(transfer.items)) {
      if (item.kind === 'file' && IMAGE_MIME_ALLOWLIST.has(item.type)) {
        const file = item.getAsFile()
        if (file) {
          return file
        }
      }
    }
  }

  return null
}

function isAllowedImageFile(file: File): boolean {
  if (!file.type.startsWith(IMAGE_MIME_PREFIX)) {
    return false
  }
  return IMAGE_MIME_ALLOWLIST.has(file.type)
}

/**
 * Persist an image via the parent's `onSaveImage` callback and insert a
 * markdown image reference at the editor's caret. The editor view is
 * retrieved from the DOM target (CM wraps content in `.cm-content`); we
 * dispatch the markdown insert only after the asset is saved so the link
 * points at a real file.
 */
async function insertImageReference(
  target: EventTarget | null,
  file: File,
  saveImage: (file: File) => Promise<string | null>
): Promise<void> {
  let relativePath: string | null = null
  try {
    relativePath = await saveImage(file)
  } catch {
    relativePath = null
  }

  if (!relativePath) {
    return
  }

  const editor = findEditorViewFromTarget(target)
  if (!editor) {
    return
  }

  const markdown = `![](${relativePath})`
  const selection = editor.state.selection.main
  editor.dispatch({
    changes: { from: selection.from, to: selection.to, insert: markdown },
    selection: { anchor: selection.from + markdown.length }
  })
  editor.focus()
}

function findEditorViewFromTarget(target: EventTarget | null): EditorView | null {
  if (!(target instanceof HTMLElement)) {
    return null
  }
  const root = target.closest('.cm-editor')
  if (!root) {
    return EditorView.findFromDOM(target)
  }
  // closest() returns Element; EditorView.findFromDOM accepts HTMLElement but
  // the .cm-editor root is always an HTMLElement in practice.
  return EditorView.findFromDOM(root as HTMLElement) ?? null
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
