import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { snippetCompletion } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'
import { EditorView, hoverTooltip, type Tooltip } from '@codemirror/view'
import type { MdxRegistryComponentMetadata } from '@/preview/registry/types'

export type { MdxRegistryComponentMetadata } from '@/preview/registry/types'

export interface MdxRegistryCompletion {
  kind: 'component' | 'property'
  from: number
  to: number
  label: string
  detail: string
  description: string | null
}

export interface MdxRegistryHover {
  from: number
  to: number
  title: string
  detail: string
  description: string | null
}

export function createMdxRegistryCompletionSource(
  components: readonly MdxRegistryComponentMetadata[]
): (context: CompletionContext) => CompletionResult | null {
  return (context) => {
    const result = getMdxRegistryCompletions(context.state.doc.toString(), context.pos, components)
    if (result.length === 0) {
      return null
    }
    const first = result[0]
    if (!first) {
      return null
    }
    return {
      from: first.from,
      to: first.to,
      validFor: /^[\w-]*$/,
      options: result.map((completion) =>
        completion.kind === 'component'
          ? snippetCompletion(`${completion.label} \${0}/>`, {
              label: completion.label,
              type: 'class',
              detail: completion.detail,
              info: completion.description ?? undefined,
              boost: 30
            })
          : snippetCompletion(`${completion.label}=\\{\${1:value}\\}`, {
              label: completion.label,
              type: 'property',
              detail: completion.detail,
              info: completion.description ?? undefined,
              boost: 20
            })
      )
    }
  }
}

export function createMdxRegistryHoverExtension(
  components: readonly MdxRegistryComponentMetadata[]
): Extension {
  return hoverTooltip((view, position) => {
    const hover = getMdxRegistryHover(view.state.doc.toString(), position, components)
    return hover ? createRegistryTooltip(hover) : null
  })
}

export function getMdxRegistryCompletions(
  source: string,
  position: number,
  components: readonly MdxRegistryComponentMetadata[]
): MdxRegistryCompletion[] {
  const cursor = clamp(position, 0, source.length)
  const prefix = source.slice(Math.max(0, cursor - 4096), cursor)
  const tagMatch = /<([A-Z][A-Za-z\d]*)?$/.exec(prefix)
  if (tagMatch) {
    const typed = tagMatch[1] ?? ''
    return components
      .filter((component) => startsWithFolded(component.name, typed))
      .map((component) => ({
        kind: 'component',
        from: cursor - typed.length,
        to: cursor,
        label: component.name,
        detail: component.category,
        description: component.description
      }))
  }

  const opening = findActiveOpeningTag(prefix)
  if (!opening || opening.valueState !== 'none') {
    return []
  }
  const component = components.find((candidate) => candidate.name === opening.componentName)
  if (!component) {
    return []
  }
  const typedProperty = /([A-Za-z_][\w-]*)$/.exec(opening.text)?.[1] ?? ''
  const characterBefore = opening.text.at(-(typedProperty.length + 1))
  if (characterBefore && !/\s/.test(characterBefore)) {
    return []
  }
  const used = new Set(
    [...opening.text.matchAll(/\s+([A-Za-z_:][\w:.-]*)\s*(?==|\s|$)/g)].map((match) => match[1])
  )
  return component.props
    .filter((prop) => !used.has(prop.name) && startsWithFolded(prop.name, typedProperty))
    .map((prop) => ({
      kind: 'property',
      from: cursor - typedProperty.length,
      to: cursor,
      label: prop.name,
      detail: `<${component.name}> prop`,
      description: prop.description
    }))
}

export function getMdxRegistryHover(
  source: string,
  position: number,
  components: readonly MdxRegistryComponentMetadata[]
): MdxRegistryHover | null {
  const cursor = clamp(position, 0, source.length)
  const range = wordRangeAt(source, cursor)
  if (!range) {
    return null
  }
  const openingStart = source.lastIndexOf('<', range.from)
  const closingBefore = source.lastIndexOf('>', range.from)
  const closingAfter = source.indexOf('>', range.to)
  if (openingStart <= closingBefore || closingAfter === -1) {
    return null
  }
  const opening = source.slice(openingStart, closingAfter + 1)
  const componentName = /^<([A-Z][A-Za-z\d]*)/.exec(opening)?.[1]
  const component = components.find((candidate) => candidate.name === componentName)
  if (!component) {
    return null
  }
  const word = source.slice(range.from, range.to)
  if (word === component.name && range.from === openingStart + 1) {
    return {
      ...range,
      title: `<${component.name}>`,
      detail: component.category,
      description: component.description
    }
  }
  const prop = component.props.find((candidate) => candidate.name === word)
  if (!prop) {
    return null
  }
  return {
    ...range,
    title: prop.name,
    detail: `<${component.name}> prop`,
    description: prop.description
  }
}

function findActiveOpeningTag(prefix: string): {
  componentName: string
  text: string
  valueState: 'none' | 'quote' | 'expression'
} | null {
  const openingIndex = prefix.lastIndexOf('<')
  if (openingIndex === -1 || prefix.lastIndexOf('>') > openingIndex) {
    return null
  }
  const text = prefix.slice(openingIndex)
  const componentName = /^<([A-Z][A-Za-z\d]*)\s/.exec(text)?.[1]
  if (!componentName) {
    return null
  }
  let quote: 'single' | 'double' | null = null
  let expressionDepth = 0
  for (const character of text.slice(componentName.length + 1)) {
    if (character === "'" && quote !== 'double' && expressionDepth === 0) {
      quote = quote === 'single' ? null : 'single'
    } else if (character === '"' && quote !== 'single' && expressionDepth === 0) {
      quote = quote === 'double' ? null : 'double'
    } else if (!quote && character === '{') {
      expressionDepth += 1
    } else if (!quote && character === '}') {
      expressionDepth = Math.max(0, expressionDepth - 1)
    }
  }
  return {
    componentName,
    text,
    valueState: quote ? 'quote' : expressionDepth > 0 ? 'expression' : 'none'
  }
}

function wordRangeAt(source: string, position: number): { from: number; to: number } | null {
  let from = position
  let to = position
  while (from > 0 && /[\w-]/.test(source[from - 1] ?? '')) {
    from -= 1
  }
  while (to < source.length && /[\w-]/.test(source[to] ?? '')) {
    to += 1
  }
  return from === to ? null : { from, to }
}

function createRegistryTooltip(hover: MdxRegistryHover): Tooltip {
  return {
    pos: hover.from,
    end: hover.to,
    above: true,
    create() {
      const dom = document.createElement('div')
      dom.className = 'cm-mdx-registry-hover'
      const title = document.createElement('code')
      title.textContent = hover.title
      const detail = document.createElement('span')
      detail.textContent = hover.detail
      dom.append(title, detail)
      if (hover.description) {
        const description = document.createElement('p')
        description.textContent = hover.description
        dom.append(description)
      }
      return { dom }
    }
  }
}

export const mdxRegistryIntelligenceTheme = EditorView.baseTheme({
  '.cm-mdx-registry-hover': {
    display: 'grid',
    gap: '0.25rem',
    maxWidth: '28rem',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    background: 'var(--background)',
    color: 'var(--foreground)',
    padding: '0.625rem',
    boxShadow: '0 8px 22px color-mix(in srgb, var(--foreground) 16%, transparent)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px'
  },
  '.cm-mdx-registry-hover span': {
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--font-sans)'
  },
  '.cm-mdx-registry-hover p': { margin: '0', color: 'var(--muted-foreground)' }
})

function startsWithFolded(value: string, query: string): boolean {
  return value.toLocaleLowerCase().startsWith(query.toLocaleLowerCase())
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
