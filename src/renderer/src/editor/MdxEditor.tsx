import {
  autocompletion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { LanguageDescription, syntaxHighlighting } from '@codemirror/language'
import { search } from '@codemirror/search'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { Strikethrough, Table } from '@lezer/markdown'
import { basicSetup } from 'codemirror'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CommandAction } from '@/commands/actions'
import { getScoredNotes } from '@/lib/fuzzy-match'
import { usePagePreviewController } from '@/preview/page-preview-context'
import { getRegistryInsertTemplates, type RegistryInsertTemplate } from '@/preview/registry'
import type { IndexedNoteSummary } from '@/vault/types'
import { getNoteLinkKeys, type WikilinkSubpath } from '../../../shared/wikilinks'
import { ComponentDefinitionPopover } from './ComponentDefinitionPopover'
import { ComponentInsertPalette } from './ComponentInsertPalette'
import { resolveEditorPreviewTarget } from './editor-page-preview'
import { editorHighlightStyle, editorTheme } from './editor-theme'
import {
  createGotoDefinitionExtension,
  type GotoDefinitionInvocation,
  type GotoDefinitionTarget,
  resolveGotoTarget
} from './goto-definition'
import { InlineFormatToolbar } from './InlineFormatToolbar'
import { createLivePreviewExtension, refreshLivePreviewEffect } from './live-preview'
import { mdxBlockHighlightExtension, mdxHighlightExtension } from './mdx-highlight'
import { SlashCommandPalette } from './SlashCommandPalette'

export interface RevealLineRequest {
  line: number
  requestId: number
}

export interface RevealSourceRangeRequest {
  from: number
  to: number
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

export interface EditorInsertRequest {
  requestId: number
  text: string
  placement: 'block' | 'inline'
}

interface MdxEditorProps {
  value: string
  onChange: (value: string) => void
  displayMode: 'source' | 'live'
  /** Indexed notes used as the source for `[[` wikilink autocomplete. */
  notes?: IndexedNoteSummary[]
  sourceRelativePath?: string
  commandActions?: CommandAction[]
  insertRequest?: EditorInsertRequest | null
  revealLineRequest?: RevealLineRequest | null
  revealSourceRangeRequest?: RevealSourceRangeRequest | null
  onSelectionChange?: (snapshot: EditorSelectionSnapshot) => void
  onCommandError?: (message: string) => void
  onNavigateToNote?: (relativePath: string, subpath?: WikilinkSubpath | null) => void
  onNavigateDefinition?: (target: GotoDefinitionTarget) => void
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
  }),
  LanguageDescription.of({
    name: 'Python',
    alias: ['python', 'py'],
    extensions: ['py'],
    load: () => import('@codemirror/lang-python').then(({ python }) => python())
  }),
  LanguageDescription.of({
    name: 'JSON',
    alias: ['json', 'jsonc'],
    extensions: ['json', 'jsonc'],
    load: () => import('@codemirror/lang-json').then(({ json }) => json())
  })
]

export function MdxEditor({
  value,
  onChange,
  displayMode,
  notes,
  sourceRelativePath,
  commandActions = [],
  insertRequest,
  revealLineRequest,
  revealSourceRangeRequest,
  onSelectionChange,
  onCommandError,
  onNavigateToNote,
  onNavigateDefinition,
  onSaveImage
}: MdxEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [liveView, setLiveView] = useState<EditorView | null>(null)
  const initialValueRef = useRef(value)
  const initialDisplayModeRef = useRef(displayMode)
  const [displayModeCompartment] = useState(() => new Compartment())
  const onChangeRef = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onCommandErrorRef = useRef(onCommandError)
  const onNavigateToNoteRef = useRef(onNavigateToNote)
  const onNavigateDefinitionRef = useRef(onNavigateDefinition)
  const onSaveImageRef = useRef(onSaveImage)
  const lastInsertRequestRef = useRef<number | null>(null)
  const insertTemplates = useMemo(() => getRegistryInsertTemplates(), [])
  const [insertPaletteOpen, setInsertPaletteOpen] = useState(false)
  const [slashTriggerRange, setSlashTriggerRange] = useState<{ from: number; to: number } | null>(
    null
  )
  const [hasInlineSelection, setHasInlineSelection] = useState(false)
  const [inlineDocLength, setInlineDocLength] = useState(0)
  const [componentDefinition, setComponentDefinition] = useState<{
    name: string
    position: { left: number; top: number }
  } | null>(null)
  const pagePreview = usePagePreviewController()

  // Keep a ref of the latest notes so the wikilink completion source (created
  // once at editor mount) can read fresh data without recreating the extension
  // on every notes-array identity change.
  const notesRef = useRef<IndexedNoteSummary[]>(notes ?? [])
  const sourceRelativePathRef = useRef(sourceRelativePath)
  useEffect(() => {
    notesRef.current = notes ?? []
    viewRef.current?.dispatch({ effects: refreshLivePreviewEffect.of(null) })
  }, [notes])

  useEffect(() => {
    sourceRelativePathRef.current = sourceRelativePath
  }, [sourceRelativePath])

  useEffect(() => {
    onNavigateToNoteRef.current = onNavigateToNote
  }, [onNavigateToNote])

  useEffect(() => {
    onNavigateDefinitionRef.current = onNavigateDefinition
  }, [onNavigateDefinition])

  useEffect(() => {
    onSaveImageRef.current = onSaveImage
  }, [onSaveImage])

  useEffect(() => {
    onCommandErrorRef.current = onCommandError
  }, [onCommandError])

  const openInsertPalette = useCallback((view: EditorView): boolean => {
    viewRef.current = view
    setInsertPaletteOpen(true)
    return true
  }, [])

  const closeInsertPalette = useCallback(() => {
    setInsertPaletteOpen(false)
    viewRef.current?.focus()
  }, [])

  const closeComponentDefinition = useCallback(() => {
    setComponentDefinition(null)
  }, [])

  const handleGotoDefinition = useCallback((invocation: GotoDefinitionInvocation): void => {
    if (invocation.target.type !== 'component') {
      setComponentDefinition(null)
      onNavigateDefinitionRef.current?.(invocation.target)
      return
    }

    const editorElement = containerRef.current
    if (!editorElement) {
      return
    }

    const editorBounds = editorElement.getBoundingClientRect()
    const pointerLeft = invocation.clientX - editorBounds.left
    const pointerTop = invocation.clientY - editorBounds.top
    const left = Math.max(8, Math.min(pointerLeft + 12, editorBounds.width - 360))
    const top =
      pointerTop + 420 <= editorBounds.height ? pointerTop + 12 : Math.max(8, pointerTop - 420)

    setComponentDefinition({
      name: invocation.target.value,
      position: { left, top }
    })
  }, [])

  const insertTemplate = useCallback((template: RegistryInsertTemplate) => {
    const view = viewRef.current

    if (!view) {
      return
    }

    view.dispatch(view.state.replaceSelection(createInsertion(view, template.snippet, 'block')))
    setInsertPaletteOpen(false)
    view.focus()
  }, [])

  const openSlashPalette = useCallback((view: EditorView): boolean => {
    if (!shouldOpenSlashCommand(view)) {
      return false
    }

    const selection = view.state.selection.main
    viewRef.current = view
    view.dispatch({
      changes: { from: selection.from, to: selection.from, insert: '/' },
      selection: { anchor: selection.from + 1 }
    })
    setSlashTriggerRange({ from: selection.from, to: selection.from + 1 })
    return true
  }, [])

  const closeSlashPalette = useCallback(() => {
    const view = viewRef.current
    const triggerRange = slashTriggerRange
    setSlashTriggerRange(null)

    if (view && triggerRange) {
      removeSlashTrigger(view, triggerRange)
      view.focus()
    }
  }, [slashTriggerRange])

  const insertSlashComponent = useCallback(
    (template: RegistryInsertTemplate) => {
      const view = viewRef.current
      const triggerRange = slashTriggerRange

      if (!view || !triggerRange) {
        return
      }

      replaceRangeWithInsertion(view, triggerRange, template.snippet, 'block')
      setSlashTriggerRange(null)
      view.focus()
    },
    [slashTriggerRange]
  )

  const runSlashCommand = useCallback(
    async (action: CommandAction): Promise<void> => {
      if (action.disabled) {
        return
      }

      const view = viewRef.current
      const triggerRange = slashTriggerRange
      setSlashTriggerRange(null)

      if (view && triggerRange) {
        removeSlashTrigger(view, triggerRange)
        view.focus()
      }

      try {
        await action.run()
      } catch (runError) {
        onCommandErrorRef.current?.(formatError(runError))
      }
    },
    [slashTriggerRange]
  )

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
          markdown({
            codeLanguages,
            extensions: [Strikethrough, Table, mdxHighlightExtension]
          }),
          syntaxHighlighting(editorHighlightStyle),
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
                run: openSlashPalette
              }
            ])
          ),
          EditorView.lineWrapping,
          createGotoDefinitionExtension(handleGotoDefinition),
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
          editorTheme,
          displayModeCompartment.of(
            initialDisplayModeRef.current === 'live'
              ? createLivePreviewExtension({
                  getNotes: () => notesRef.current,
                  getSourceRelativePath: () => sourceRelativePathRef.current,
                  getOnNavigateToNote: () => onNavigateToNoteRef.current
                })
              : []
          )
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
  }, [displayModeCompartment, handleGotoDefinition, openInsertPalette, openSlashPalette])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !pagePreview) return
    let activeKey: string | null = null

    const requestAtPosition = (
      position: number,
      anchor: HTMLElement,
      trigger: 'pointer' | 'focus',
      modifierKey: boolean
    ): void => {
      if (trigger === 'pointer' && !modifierKey) {
        if (activeKey) pagePreview.scheduleDismiss()
        activeKey = null
        return
      }
      const target = resolveGotoTarget(view.state.doc.toString(), position)
      const resolved = resolveEditorPreviewTarget(
        target,
        notesRef.current,
        sourceRelativePathRef.current
      )
      const key = resolved ? `${resolved.note.relativePath}:${target?.from}:${target?.to}` : null
      if (!resolved || !key) {
        if (activeKey) pagePreview.scheduleDismiss()
        activeKey = null
        return
      }
      if (key === activeKey) return
      activeKey = key
      pagePreview.requestPreview({
        note: resolved.note,
        subpath: resolved.subpath,
        anchor,
        trigger,
        modifierKey
      })
    }

    const onMouseMove = (event: MouseEvent): void => {
      const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (position === null) return
      const anchor = event.target instanceof HTMLElement ? event.target : view.dom
      requestAtPosition(position, anchor, 'pointer', event.ctrlKey || event.metaKey)
    }
    const onMouseLeave = (event: MouseEvent): void => {
      activeKey = null
      pagePreview.scheduleDismiss(event.relatedTarget)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Control' && event.key !== 'Meta') return
      const position = view.state.selection.main.head
      const rect = view.coordsAtPos(position)
      if (!rect) return
      requestAtPosition(position, createRectAnchor(rect), 'focus', true)
    }
    const onBlur = (event: FocusEvent): void => {
      activeKey = null
      pagePreview.scheduleDismiss(event.relatedTarget)
    }

    view.dom.addEventListener('mousemove', onMouseMove)
    view.dom.addEventListener('mouseleave', onMouseLeave)
    view.dom.addEventListener('keydown', onKeyDown)
    view.dom.addEventListener('focusout', onBlur)
    return () => {
      view.dom.removeEventListener('mousemove', onMouseMove)
      view.dom.removeEventListener('mouseleave', onMouseLeave)
      view.dom.removeEventListener('keydown', onKeyDown)
      view.dom.removeEventListener('focusout', onBlur)
    }
  }, [pagePreview])

  useEffect(() => {
    const view = viewRef.current

    if (!view) {
      return
    }

    view.dispatch({
      effects: displayModeCompartment.reconfigure(
        displayMode === 'live'
          ? createLivePreviewExtension({
              getNotes: () => notesRef.current,
              getSourceRelativePath: () => sourceRelativePathRef.current,
              getOnNavigateToNote: () => onNavigateToNoteRef.current
            })
          : []
      )
    })
  }, [displayMode, displayModeCompartment, sourceRelativePath])

  useEffect(() => {
    const view = viewRef.current

    if (!view || !insertRequest || lastInsertRequestRef.current === insertRequest.requestId) {
      return
    }

    lastInsertRequestRef.current = insertRequest.requestId
    view.dispatch(
      view.state.replaceSelection(
        createInsertion(view, insertRequest.text, insertRequest.placement)
      )
    )
    view.focus()
  }, [insertRequest])

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

  useEffect(() => {
    const view = viewRef.current
    if (!view || !revealSourceRangeRequest) return
    const from = Math.min(Math.max(0, revealSourceRangeRequest.from), view.state.doc.length)
    const to = Math.min(Math.max(from, revealSourceRangeRequest.to), view.state.doc.length)
    view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: 'center' })
    })
    view.focus()
  }, [revealSourceRangeRequest])

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
      {slashTriggerRange ? (
        <SlashCommandPalette
          commandActions={commandActions}
          componentTemplates={insertTemplates}
          onClose={closeSlashPalette}
          onInsertComponent={insertSlashComponent}
          onRunAction={(action) => {
            void runSlashCommand(action)
          }}
        />
      ) : null}
      {componentDefinition ? (
        <ComponentDefinitionPopover
          componentName={componentDefinition.name}
          position={componentDefinition.position}
          onClose={closeComponentDefinition}
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

function createInsertion(
  view: EditorView,
  snippet: string,
  placement: 'block' | 'inline',
  range?: { from: number; to: number }
): string {
  if (placement === 'inline') {
    return snippet
  }

  const selection = view.state.selection.main
  const from = range?.from ?? selection.from
  const to = range?.to ?? selection.to

  if (!range && !selection.empty) {
    return snippet
  }

  const line = view.state.doc.lineAt(from)
  const textBefore = view.state.doc.sliceString(line.from, from)
  const characterAfter = to < view.state.doc.length ? view.state.doc.sliceString(to, to + 1) : '\n'
  const prefix = textBefore.trim().length === 0 ? '' : '\n\n'
  const suffix = characterAfter === '\n' ? '' : '\n'

  return `${prefix}${snippet}${suffix}`
}

function replaceRangeWithInsertion(
  view: EditorView,
  range: { from: number; to: number },
  snippet: string,
  placement: 'block' | 'inline'
): void {
  const insert = createInsertion(view, snippet, placement, range)

  view.dispatch({
    changes: { from: range.from, to: Math.min(range.to, view.state.doc.length), insert },
    selection: { anchor: range.from + insert.length }
  })
}

function removeSlashTrigger(view: EditorView, range: { from: number; to: number }): void {
  const to = Math.min(range.to, view.state.doc.length)

  if (range.from >= to || view.state.doc.sliceString(range.from, to) !== '/') {
    return
  }

  view.dispatch({
    changes: { from: range.from, to, insert: '' },
    selection: { anchor: range.from }
  })
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function createRectAnchor(rect: {
  left: number
  right: number
  top: number
  bottom: number
}): HTMLElement {
  const domRect = new DOMRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top)
  return {
    getBoundingClientRect: () => domRect
  } as HTMLElement
}
