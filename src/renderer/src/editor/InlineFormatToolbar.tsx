/**
 * Floating formatting toolbar that appears above a non-empty text selection
 * in the CodeMirror editor. Wraps the selection in markdown: Bold (**), Italic
 * (*), Code (`), or Link ([]()). The toolbar is purely presentational — it
 * dispatches edits through the live EditorView instance, no IPC writes, no
 * side effects.
 */
import { Bold, Code, Italic, Link as LinkIcon } from 'lucide-react'

import type { EditorView } from '@codemirror/view'

interface InlineFormatToolbarProps {
  /** Live CM view — passed down so the toolbar can dispatch wraps. */
  view: EditorView | null
  /**
   * Selection snapshot — when `hasSelection` is true and `head`/`anchor`
   * coordinates are valid, the toolbar is shown positioned at `coordsAtPos`.
   */
  hasSelection: boolean
  /** Document length, used to detect stale-position cache. */
  docLength: number
}

export function InlineFormatToolbar({
  view,
  hasSelection,
  docLength
}: InlineFormatToolbarProps): React.JSX.Element | null {
  // Derive position directly in render from the live view + selection. We
  // skip the effect/state dance because (a) we already control re-renders
  // from MdxEditor via `hasSelection`/`docLength` props, and (b) coordsAtPos
  // is a pure read against the current DOM, safe to call during render.
  let position: { top: number; left: number } | null = null
  if (view && hasSelection) {
    try {
      const selection = view.state.selection.main
      if (!selection.empty) {
        const coords = view.coordsAtPos(selection.head)
        if (coords) {
          const editorRect = view.scrollDOM.getBoundingClientRect()
          position = {
            top: coords.top - editorRect.top - 44,
            left: coords.left - editorRect.left
          }
        }
      }
    } catch {
      position = null
    }
  }

  // docLength is read to force a re-render when the doc changes; otherwise
  // we could compute stale coords after a keystroke. (No-op reference.)
  void docLength

  if (!view || !position) {
    return null
  }

  const buttons: Array<{
    key: string
    title: string
    icon: React.ReactNode
    onClick: () => void
  }> = [
    {
      key: 'bold',
      title: 'Bold (wrap selection in **)',
      icon: <Bold className="size-3.5" aria-hidden="true" />,
      onClick: () => wrapSelection(view, '**', '**')
    },
    {
      key: 'italic',
      title: 'Italic (wrap selection in *)',
      icon: <Italic className="size-3.5" aria-hidden="true" />,
      onClick: () => wrapSelection(view, '*', '*')
    },
    {
      key: 'code',
      title: 'Inline code (wrap selection in `)',
      icon: <Code className="size-3.5" aria-hidden="true" />,
      onClick: () => wrapSelection(view, '`', '`')
    },
    {
      key: 'link',
      title: 'Link (wrap selection as [text](url))',
      icon: <LinkIcon className="size-3.5" aria-hidden="true" />,
      onClick: () => wrapSelectionAsLink(view)
    }
  ]

  return (
    <div
      role="toolbar"
      aria-label="Format selection"
      className="pointer-events-auto absolute z-40 flex items-center gap-0.5 rounded-md border bg-popover p-0.5 text-popover-foreground shadow-md"
      style={{ top: position.top, left: position.left }}
      // Prevent the toolbar clicks from blurring the editor.
      onMouseDown={(event) => event.preventDefault()}
    >
      {buttons.map((button) => (
        <button
          key={button.key}
          type="button"
          title={button.title}
          aria-label={button.title}
          className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={button.onClick}
        >
          {button.icon}
        </button>
      ))}
    </div>
  )
}

/**
 * Wrap the current selection in `prefix` + `suffix`. If the selection is
 * already wrapped (idempotent), unwraps instead. After dispatch the caret
 * sits at the end of the wrapped range so the user can keep typing.
 */
function wrapSelection(view: EditorView, prefix: string, suffix: string): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)

  // Idempotent: strip an existing wrap.
  if (selected.startsWith(prefix) && selected.endsWith(suffix) && selected.length >= prefix.length + suffix.length) {
    const unwrapped = selected.slice(prefix.length, selected.length - suffix.length)
    view.dispatch({
      changes: { from, to, insert: unwrapped },
      selection: { anchor: from + unwrapped.length }
    })
    return
  }

  const insert = `${prefix}${selected}${suffix}`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + prefix.length + selected.length }
  })
  view.focus()
}

/**
 * Wrap the selection as a markdown link. Inserts `[selection]()` and leaves
 * the caret between the parens so the user can paste a URL.
 */
function wrapSelectionAsLink(view: EditorView): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const insert = `[${selected}]()`
  const urlStart = from + selected.length + 3 // `[`, label, `]`, `(`
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: urlStart }
  })
  view.focus()
}
