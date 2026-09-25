import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export const SOURCE_EDITOR_FONT_FAMILY = 'var(--editor-font-family, var(--font-code))'
export const SOURCE_EDITOR_DEFAULT_FONT_SIZE = 'var(--editor-font-size, 15px)'
export const SOURCE_EDITOR_LINE_HEIGHT = 'var(--editor-line-height, 1.6)'

const syntaxSignal = 'color-mix(in srgb, var(--signal) 80%, var(--foreground))'
const syntaxBlue = 'color-mix(in srgb, var(--instrument-blue) 76%, var(--foreground))'
const syntaxEvidence = 'color-mix(in srgb, var(--evidence) 82%, var(--foreground))'
const syntaxViolet = 'color-mix(in srgb, var(--chart-5) 78%, var(--foreground))'
const syntaxMuted = 'color-mix(in srgb, var(--muted-foreground) 86%, var(--foreground))'
const activeLine = 'color-mix(in srgb, var(--instrument-blue) 3.5%, transparent)'
const quietRule = 'color-mix(in srgb, var(--border) 52%, transparent)'
const scrollbarThumb = 'color-mix(in srgb, var(--muted-foreground) 28%, transparent)'

export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--card)',
    color: 'var(--foreground)'
  },
  '.cm-scroller': {
    fontFamily: SOURCE_EDITOR_FONT_FAMILY,
    fontSize: SOURCE_EDITOR_DEFAULT_FONT_SIZE,
    fontWeight: 'var(--editor-font-weight, 400)',
    fontSynthesis: 'none',
    letterSpacing: '0',
    lineHeight: SOURCE_EDITOR_LINE_HEIGHT,
    scrollbarGutter: 'auto',
    scrollbarColor: `${scrollbarThumb} transparent`,
    scrollbarWidth: 'thin',
    overscrollBehavior: 'contain'
  },
  '.cm-scroller::-webkit-scrollbar': {
    width: '10px',
    height: '10px'
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: 'transparent'
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    minHeight: '32px',
    border: '3px solid transparent',
    borderRadius: '8px',
    backgroundColor: scrollbarThumb,
    backgroundClip: 'padding-box'
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'color-mix(in srgb, var(--muted-foreground) 48%, transparent)'
  },
  '&.cm-use-ligatures .cm-scroller': {
    fontFeatureSettings: '"calt" 1, "liga" 1',
    fontVariantLigatures: 'contextual common-ligatures'
  },
  '&.cm-no-ligatures .cm-scroller': {
    fontFeatureSettings: '"calt" 0, "liga" 0',
    fontVariantLigatures: 'none'
  },
  '.cm-content': {
    // CodeMirror's flex-grow fills the space remaining AFTER the gutter.
    // min-width:100% adds the gutter on top and forces horizontal overflow.
    minWidth: '0',
    padding: '16px 0 48px',
    caretColor: 'var(--instrument-blue)',
    tabSize: 'var(--editor-tab-size, 2)',
    position: 'relative'
  },
  '&.cm-wrap-bounded .cm-line': {
    maxWidth: 'calc(var(--editor-wrap-column, 88) * 1ch + 24px)'
  },
  '.cm-line': {
    padding: '0 12px'
  },
  '&.cm-show-ruler .cm-content::after': {
    content: '""',
    position: 'absolute',
    zIndex: '-1',
    top: '0',
    bottom: '0',
    left: 'calc(12px + var(--editor-wrap-column, 88) * 1ch)',
    borderLeft: `1px solid ${quietRule}`,
    pointerEvents: 'none'
  },
  '.cm-indentation-guides': {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(var(--editor-tab-size, 2) * 1ch - 1px), ${quietRule} calc(var(--editor-tab-size, 2) * 1ch - 1px), ${quietRule} calc(var(--editor-tab-size, 2) * 1ch))`
  },
  '.cm-gutters': {
    backgroundColor: 'var(--card)',
    borderRight: '0',
    color: 'var(--muted-foreground)',
    fontFamily: SOURCE_EDITOR_FONT_FAMILY,
    fontSize: SOURCE_EDITOR_DEFAULT_FONT_SIZE,
    fontWeight: '400',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0',
    lineHeight: SOURCE_EDITOR_LINE_HEIGHT,
    userSelect: 'none'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '3em',
    padding: '0 10px 0 8px'
  },
  '.cm-foldGutter .cm-gutterElement': {
    width: '15px',
    padding: '0',
    color: 'color-mix(in srgb, var(--muted-foreground) 72%, transparent)',
    textAlign: 'center'
  },
  '.cm-foldGutter .cm-gutterElement:hover': {
    color: 'var(--foreground)'
  },
  '.cm-activeLine': {
    backgroundColor: activeLine
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--foreground)'
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--instrument-blue) 16%, transparent) !important'
  },
  '.cm-selectionMatch': {
    backgroundColor: 'color-mix(in srgb, var(--signal) 15%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--signal) 38%, transparent)'
  },
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in srgb, var(--signal) 22%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--signal) 52%, transparent)'
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in srgb, var(--instrument-blue) 24%, transparent)',
    outlineColor: 'var(--instrument-blue)'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--instrument-blue)',
    borderLeftWidth: '2px'
  },
  '.cm-matchingBracket': {
    color: 'var(--foreground)',
    backgroundColor: 'color-mix(in srgb, var(--evidence) 18%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--evidence) 52%, transparent)'
  },
  '.cm-nonmatchingBracket': {
    color: 'var(--destructive)',
    backgroundColor: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    outline: '1px solid var(--destructive)'
  },
  '.cm-foldPlaceholder': {
    border: `1px solid ${quietRule}`,
    backgroundColor: 'var(--muted)',
    color: 'var(--muted-foreground)',
    borderRadius: '2px',
    margin: '0 3px',
    padding: '0 4px'
  },
  '.cm-panels': {
    backgroundColor: 'var(--chrome)',
    color: 'var(--foreground)'
  },
  '.cm-panels-top': {
    borderBottom: '1px solid var(--border)'
  },
  '.cm-panels-bottom': {
    borderTop: '1px solid var(--border)'
  },
  '.cm-panel': {
    padding: '6px 8px',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px'
  },
  '.cm-textfield': {
    border: '1px solid var(--input)',
    borderRadius: '2px',
    backgroundColor: 'var(--card)',
    color: 'var(--foreground)',
    fontFamily: SOURCE_EDITOR_FONT_FAMILY,
    fontSize: '12px',
    padding: '4px 7px'
  },
  '.cm-textfield:focus-visible': {
    borderColor: 'var(--instrument-blue)',
    outline: '2px solid color-mix(in srgb, var(--instrument-blue) 24%, transparent)',
    outlineOffset: '1px'
  },
  '.cm-button': {
    border: '1px solid var(--border)',
    borderRadius: '2px',
    backgroundImage: 'none',
    backgroundColor: 'var(--card)',
    color: 'var(--foreground)',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    padding: '3px 8px'
  },
  '.cm-button:hover': {
    borderColor: 'var(--input)',
    backgroundColor: 'var(--secondary)'
  },
  '.cm-tooltip': {
    border: '1px solid var(--border)',
    borderRadius: '3px',
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    boxShadow: '0 8px 24px color-mix(in srgb, var(--foreground) 14%, transparent)',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    overflow: 'hidden'
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: SOURCE_EDITOR_FONT_FAMILY,
    fontSize: 'var(--editor-font-size, 15px)',
    lineHeight: '1.5',
    minWidth: 'min(280px, 70vw)',
    maxWidth: 'min(480px, 80vw)',
    maxHeight: '280px'
  },
  '.cm-tooltip-autocomplete > ul > li': {
    minHeight: '30px',
    padding: '5px 10px'
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)'
  },
  '.cm-completionDetail': {
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    fontStyle: 'normal',
    marginLeft: '1em'
  },
  '.cm-diagnostic': {
    borderLeftColor: 'var(--input)',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    lineHeight: '1.45'
  },
  '.cm-diagnostic-error': {
    borderLeftColor: 'var(--destructive)'
  },
  '.cm-lintRange-error': {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3L3 0L6 3' fill='none' stroke='%23b42318'/%3E%3C/svg%3E\")"
  },
  '.cm-highlightSpace': {
    backgroundImage:
      'radial-gradient(circle at 50% 58%, color-mix(in srgb, var(--muted-foreground) 60%, transparent) 18%, transparent 20%)'
  },
  '.cm-highlightTab': {
    opacity: '0.52'
  },
  '.cm-mdx-math-block': {
    backgroundColor: 'color-mix(in srgb, var(--instrument-blue) 6%, transparent)'
  },
  '.cm-mdx-math-delimiter': {
    color: syntaxBlue,
    fontWeight: '500'
  },
  '.cm-mdx-mermaid-block': {
    backgroundColor: 'color-mix(in srgb, var(--chart-5) 7%, transparent)'
  },
  '&.cm-display-source .cm-mdx-math-block, &.cm-display-source .cm-mdx-mermaid-block': {
    backgroundColor: 'transparent'
  },
  '.cm-mdx-mermaid-fence, .cm-mdx-callout-marker': {
    fontWeight: '500'
  },
  '.cm-mdx-mermaid-fence': { color: syntaxViolet },
  '.cm-mdx-callout-note': { color: 'var(--foreground)' },
  '.cm-mdx-callout-info': { color: 'var(--muted-foreground)' },
  '.cm-mdx-callout-tip': { color: syntaxBlue },
  '.cm-mdx-callout-warning': { color: syntaxViolet },
  '.cm-mdx-callout-danger': { color: 'var(--destructive)' },
  '.tok-keyword, .tok-operator': { color: syntaxSignal },
  '.tok-string, .tok-variableName.tok-definition': { color: syntaxBlue },
  '.tok-number, .tok-bool, .tok-string2, .tok-typeName': { color: syntaxViolet },
  '.tok-propertyName, .tok-variableName.tok-local': { color: syntaxEvidence },
  '.tok-comment': { color: syntaxMuted, fontStyle: 'italic' },
  '.tok-punctuation': { color: syntaxMuted },
  '&.cm-focused': {
    outline: '1px solid transparent',
    outlineOffset: '-1px'
  }
})

/** Shared, restrained source palette for Markdown and programming-language tokens. */
export const editorHighlightStyle = HighlightStyle.define([
  { tag: t.meta, color: syntaxMuted },
  { tag: t.heading, color: syntaxSignal, fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.keyword, t.modifier, t.operatorKeyword], color: syntaxSignal },
  { tag: [t.atom, t.bool, t.number, t.contentSeparator], color: syntaxViolet },
  { tag: [t.literal, t.url], color: syntaxViolet },
  { tag: t.string, color: syntaxBlue },
  { tag: [t.regexp, t.escape, t.special(t.string)], color: syntaxViolet },
  { tag: t.definition(t.variableName), color: syntaxBlue },
  { tag: t.local(t.variableName), color: syntaxEvidence },
  { tag: [t.typeName, t.namespace], color: syntaxViolet, fontWeight: '500' },
  { tag: t.className, color: syntaxBlue, fontWeight: '500' },
  { tag: [t.special(t.variableName), t.macroName], color: syntaxEvidence },
  { tag: t.definition(t.propertyName), color: syntaxBlue },
  { tag: t.propertyName, color: syntaxEvidence },
  { tag: t.operator, color: syntaxSignal },
  { tag: t.comment, color: syntaxMuted, fontStyle: 'italic' },
  { tag: t.invalid, color: 'var(--destructive)', textDecoration: 'underline wavy' },
  { tag: t.tagName, color: syntaxSignal, fontWeight: '500' },
  { tag: t.attributeName, color: syntaxEvidence },
  { tag: t.angleBracket, color: syntaxMuted },
  { tag: t.brace, color: syntaxSignal },
  { tag: t.processingInstruction, color: syntaxSignal, fontWeight: '500' },
  {
    tag: t.inserted,
    backgroundColor: 'color-mix(in srgb, var(--chart-5) 16%, transparent)',
    color: 'var(--foreground)'
  },
  { tag: t.link, color: syntaxBlue, fontWeight: '500' },
  { tag: t.labelName, color: syntaxViolet, fontWeight: '500' },
  { tag: [t.punctuation, t.squareBracket], color: syntaxMuted }
])
