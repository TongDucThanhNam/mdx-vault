import { type Extension, StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { parseWikilinkParts } from '../../../shared/wikilinks'

export type GotoDefinitionTarget =
  | { type: 'wikilink'; value: string; from: number; to: number }
  | { type: 'path'; value: string; from: number; to: number }
  | { type: 'component'; value: string; from: number; to: number }

export interface GotoDefinitionInvocation {
  target: GotoDefinitionTarget
  clientX: number
  clientY: number
}

const WIKILINK_PATTERN = /\[\[([^\]\n]+)\]\]/gu
const ISLAND_TAG_PATTERN = /<(?:Interactive|SandboxedHTML)\b[^>\n]*>/gu
const SRC_ATTRIBUTE_PATTERN = /\bsrc\s*=\s*(["'])(.*?)\1/gu
const MARKDOWN_LINK_PATTERN = /!?\[[^\]\n]*\]\(\s*([^)\n]+?)\s*\)/gu
const COMPONENT_TAG_PATTERN = /<\/?([A-Z][A-Za-z\d]*)\b/gu
const gotoTargetDecoration = Decoration.mark({ class: 'cm-goto-definition-target' })
const setGotoTargetEffect = StateEffect.define<GotoDefinitionTarget | null>()
const gotoTargetField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let nextDecorations = decorations.map(transaction.changes)

    for (const effect of transaction.effects) {
      if (effect.is(setGotoTargetEffect)) {
        nextDecorations = effect.value
          ? Decoration.set([gotoTargetDecoration.range(effect.value.from, effect.value.to)])
          : Decoration.none
      }
    }

    return nextDecorations
  },
  provide: (field) => EditorView.decorations.from(field)
})
const gotoDefinitionTheme = EditorView.baseTheme({
  '.cm-goto-definition-target': {
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '2px'
  }
})

interface LineAtPosition {
  text: string
  from: number
  position: number
}

interface MarkdownDestination {
  value: string
  offset: number
}

/** Find the supported MDX navigation target under a document position. */
export function resolveGotoTarget(doc: string, pos: number): GotoDefinitionTarget | null {
  if (!Number.isInteger(pos) || pos < 0 || pos > doc.length) {
    return null
  }

  return resolveLineTarget(readLineAtPosition(doc, pos))
}

/**
 * Adds IDE-style modifier hover and go-to-definition handling to a CodeMirror
 * editor. Navigation remains outside the extension through the callback.
 */
export function createGotoDefinitionExtension(
  onNavigate: (invocation: GotoDefinitionInvocation) => void
): Extension {
  let activeTarget: GotoDefinitionTarget | null = null
  let lastPointer: { x: number; y: number } | null = null

  const clearTarget = (view: EditorView): void => {
    if (!activeTarget) {
      return
    }

    activeTarget = null
    view.dispatch({ effects: setGotoTargetEffect.of(null) })
  }

  const updateTarget = (view: EditorView, clientX: number, clientY: number): void => {
    lastPointer = { x: clientX, y: clientY }
    const pos = view.posAtCoords({ x: clientX, y: clientY })
    const target = pos === null ? null : resolveViewTarget(view, pos)

    if (areTargetsEqual(activeTarget, target)) {
      return
    }

    activeTarget = target
    view.dispatch({ effects: setGotoTargetEffect.of(target) })
  }

  return [
    gotoTargetField,
    gotoDefinitionTheme,
    EditorView.domEventHandlers({
      mousedown: (event, view) => {
        if (event.button !== 0 || (!event.ctrlKey && !event.metaKey)) {
          return false
        }

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        const target = pos === null ? null : resolveViewTarget(view, pos)
        if (!target) {
          return false
        }

        event.preventDefault()
        onNavigate({ target, clientX: event.clientX, clientY: event.clientY })
        return true
      },
      mousemove: (event, view) => {
        if (event.ctrlKey || event.metaKey) {
          updateTarget(view, event.clientX, event.clientY)
        } else {
          lastPointer = { x: event.clientX, y: event.clientY }
          clearTarget(view)
        }

        return false
      },
      mouseleave: (_event, view) => {
        lastPointer = null
        clearTarget(view)
        return false
      },
      keydown: (event, view) => {
        if ((event.key === 'Control' || event.key === 'Meta') && lastPointer) {
          updateTarget(view, lastPointer.x, lastPointer.y)
        }

        return false
      },
      keyup: (event, view) => {
        if (event.key === 'Control' || event.key === 'Meta') {
          clearTarget(view)
        }

        return false
      },
      blur: (_event, view) => {
        clearTarget(view)
        return false
      }
    })
  ]
}

function resolveViewTarget(view: EditorView, pos: number): GotoDefinitionTarget | null {
  const line = view.state.doc.lineAt(pos)
  return resolveLineTarget({ text: line.text, from: line.from, position: pos })
}

function resolveWikilink(line: LineAtPosition): GotoDefinitionTarget | null {
  for (const match of line.text.matchAll(WIKILINK_PATTERN)) {
    const rawValue = match[1]
    const matchFrom = match.index

    if (!rawValue || matchFrom === undefined) {
      continue
    }

    const from = line.from + matchFrom
    const to = from + match[0].length
    const parts = parseWikilinkParts(rawValue)

    if (parts && isPositionWithin(line.position, from, to)) {
      return { type: 'wikilink', value: parts.target, from, to }
    }
  }

  return null
}

function resolveIslandSource(line: LineAtPosition): GotoDefinitionTarget | null {
  for (const tagMatch of line.text.matchAll(ISLAND_TAG_PATTERN)) {
    const tagFrom = tagMatch.index
    if (tagFrom === undefined) {
      continue
    }

    for (const attributeMatch of tagMatch[0].matchAll(SRC_ATTRIBUTE_PATTERN)) {
      const quote = attributeMatch[1]
      const value = attributeMatch[2]
      const attributeFrom = attributeMatch.index

      if (!quote || !value || attributeFrom === undefined) {
        continue
      }

      const valueOffset = attributeMatch[0].indexOf(quote) + 1
      const from = line.from + tagFrom + attributeFrom + valueOffset
      const to = from + value.length

      if (isPositionWithin(line.position, from, to)) {
        return { type: 'path', value, from, to }
      }
    }
  }

  return null
}

function resolveMarkdownDestination(line: LineAtPosition): GotoDefinitionTarget | null {
  for (const match of line.text.matchAll(MARKDOWN_LINK_PATTERN)) {
    const rawDestination = match[1]
    const matchFrom = match.index

    if (!rawDestination || matchFrom === undefined) {
      continue
    }

    const destination = readMarkdownDestination(rawDestination)
    if (!destination) {
      continue
    }

    const rawOffset = match[0].indexOf(rawDestination)
    const from = line.from + matchFrom + rawOffset + destination.offset
    const to = from + destination.value.length

    if (isPositionWithin(line.position, from, to)) {
      return { type: 'path', value: destination.value, from, to }
    }
  }

  return null
}

function resolveComponentName(line: LineAtPosition): GotoDefinitionTarget | null {
  for (const match of line.text.matchAll(COMPONENT_TAG_PATTERN)) {
    const value = match[1]
    const matchFrom = match.index

    if (!value || matchFrom === undefined) {
      continue
    }

    const from = line.from + matchFrom + match[0].lastIndexOf(value)
    const to = from + value.length

    if (isPositionWithin(line.position, from, to)) {
      return { type: 'component', value, from, to }
    }
  }

  return null
}

function resolveLineTarget(line: LineAtPosition): GotoDefinitionTarget | null {
  return (
    resolveWikilink(line) ??
    resolveIslandSource(line) ??
    resolveMarkdownDestination(line) ??
    resolveComponentName(line)
  )
}

function readLineAtPosition(doc: string, pos: number): LineAtPosition {
  const from = doc.lastIndexOf('\n', Math.max(0, pos - 1)) + 1
  const nextLineBreak = doc.indexOf('\n', pos)
  const to = nextLineBreak === -1 ? doc.length : nextLineBreak

  return { text: doc.slice(from, to), from, position: pos }
}

function readMarkdownDestination(rawValue: string): MarkdownDestination | null {
  const leadingWhitespace = rawValue.length - rawValue.trimStart().length
  const value = rawValue.slice(leadingWhitespace)

  if (value.startsWith('<')) {
    const closingBracket = value.indexOf('>')
    const destination = value.slice(1, closingBracket)

    return closingBracket > 1 ? { value: destination, offset: leadingWhitespace + 1 } : null
  }

  const destination = value.match(/^[^\s]+/u)?.[0]
  return destination ? { value: destination, offset: leadingWhitespace } : null
}

function isPositionWithin(position: number, from: number, to: number): boolean {
  return position >= from && position <= to
}

function areTargetsEqual(
  left: GotoDefinitionTarget | null,
  right: GotoDefinitionTarget | null
): boolean {
  return (
    left?.type === right?.type &&
    left?.value === right?.value &&
    left?.from === right?.from &&
    left?.to === right?.to
  )
}
