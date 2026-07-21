import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export const editorTheme = EditorView.theme({
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

/** Shared source-editor palette for Markdown and programming language tokens. */
export const editorHighlightStyle = HighlightStyle.define([
  { tag: t.meta, color: 'var(--muted-foreground)' },
  { tag: t.heading, color: 'var(--editorial-red)', fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.keyword, t.modifier, t.operatorKeyword], color: 'var(--editorial-red)' },
  {
    tag: [t.atom, t.bool, t.number, t.contentSeparator],
    color: 'var(--chart-3)'
  },
  { tag: [t.literal, t.url], color: 'var(--chart-5)' },
  { tag: t.string, color: 'var(--editorial-blue)' },
  { tag: [t.regexp, t.escape, t.special(t.string)], color: 'var(--chart-5)' },
  { tag: t.definition(t.variableName), color: 'var(--editorial-blue)' },
  { tag: t.local(t.variableName), color: 'var(--chart-3)' },
  { tag: [t.typeName, t.namespace], color: 'var(--chart-5)', fontWeight: '700' },
  { tag: t.className, color: 'var(--editorial-blue)', fontWeight: '700' },
  { tag: [t.special(t.variableName), t.macroName], color: 'var(--chart-3)' },
  { tag: t.definition(t.propertyName), color: 'var(--editorial-blue)' },
  { tag: t.propertyName, color: 'var(--chart-3)' },
  { tag: t.operator, color: 'var(--editorial-red)' },
  { tag: t.comment, color: 'var(--muted-foreground)', fontStyle: 'italic' },
  {
    tag: t.invalid,
    color: 'var(--destructive)',
    textDecoration: 'underline wavy'
  },
  { tag: t.tagName, color: 'var(--editorial-red)', fontWeight: '700' },
  { tag: t.attributeName, color: 'var(--chart-3)' },
  { tag: t.angleBracket, color: 'var(--muted-foreground)' },
  { tag: t.brace, color: 'var(--editorial-red)' },
  { tag: t.regexp, color: 'var(--chart-5)', fontWeight: '700' },
  { tag: t.processingInstruction, color: 'var(--editorial-red)', fontWeight: '700' },
  {
    tag: t.inserted,
    backgroundColor: 'color-mix(in srgb, var(--chart-5) 22%, transparent)',
    color: 'var(--foreground)'
  },
  {
    tag: t.link,
    color: 'var(--editorial-blue)',
    fontWeight: '700',
    textDecoration: 'underline'
  },
  { tag: t.labelName, color: 'var(--chart-5)', fontWeight: '700' },
  { tag: [t.punctuation, t.squareBracket], color: 'var(--muted-foreground)' }
])
