import { createElement, Fragment, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'

import { componentRegistry } from '../../renderer/src/preview/registry'
import type {
  ComponentRegistryEntry,
  RegistryStaticExportPolicy
} from '../../renderer/src/preview/registry/types'
import type {
  ExportIrComponentNode,
  ExportIrDocument,
  ExportIrElementNode,
  ExportIrNode,
  ExportJsonValue
} from './export-ir'

export interface ComposedRenderInput {
  ir: ExportIrDocument
  mode: 'static' | 'interactive'
  sandboxFallbacks?: Map<string, string>
}

export interface ComposedRenderResult {
  bodyHtml: string
  hydrationRoots: ExportIrNode[]
}

const registryByName = new Map(componentRegistry.map((entry) => [entry.name, entry]))

export class StaticSnapshotRenderer {
  renderDocument({
    ir,
    mode,
    sandboxFallbacks = new Map()
  }: ComposedRenderInput): ComposedRenderResult {
    const hydrationRoots: ExportIrNode[] = []
    const bodyHtml = ir.children
      .map((node) => {
        if (mode === 'interactive' && containsTrustedComponent(node)) {
          hydrationRoots.push(node)
          const prefix = hydrationPrefix(node.id)
          const markup = renderToString(createInteractiveNode(node, sandboxFallbacks), {
            identifierPrefix: prefix
          })
          return `<div class="mdx-vault-trusted-root" data-export-root-id="${escapeAttribute(node.id)}">${markup}</div>`
        }

        const reactNode =
          mode === 'static'
            ? createStaticNode(node, sandboxFallbacks)
            : createInteractiveNode(node, sandboxFallbacks)
        return renderToStaticMarkup(createElement(Fragment, null, reactNode))
      })
      .join('')

    return { bodyHtml, hydrationRoots }
  }
}

function createInteractiveNode(
  node: ExportIrNode,
  sandboxFallbacks: Map<string, string>
): ReactNode {
  if (node.type === 'text') return node.value
  if (node.type === 'element') {
    return createIntrinsicElement(node, (child) => createInteractiveNode(child, sandboxFallbacks))
  }
  if (node.type === 'sandbox') {
    return createSandboxSlot(node.id, node.src, sandboxFallbacks.get(node.id))
  }

  const entry = requireRegistryEntry(node.name)
  const children = createChildren(node.children, (child) =>
    createInteractiveNode(child, sandboxFallbacks)
  )
  const props = validateRegistryProps(entry, node.props, children, node.children.length > 0)
  return createElement(entry.component, { ...props, key: node.id })
}

function createStaticNode(node: ExportIrNode, sandboxFallbacks: Map<string, string>): ReactNode {
  if (node.type === 'text') return node.value
  if (node.type === 'element') {
    return createIntrinsicElement(node, (child) => createStaticNode(child, sandboxFallbacks))
  }
  if (node.type === 'sandbox') {
    const fallback = sandboxFallbacks.get(node.id)
    return createElement('div', {
      key: node.id,
      className: 'mdx-vault-sandbox-fallback-slot',
      'data-sandbox-node-id': node.id,
      ...(fallback
        ? { dangerouslySetInnerHTML: { __html: fallback } }
        : {
            children: createElement(
              'div',
              { className: 'mdx-vault-snapshot-placeholder' },
              `Interactive island ${node.src} is unavailable in this static export.`
            )
          })
    })
  }

  const entry = requireRegistryEntry(node.name)
  const children = createChildren(node.children, (child) =>
    createStaticNode(child, sandboxFallbacks)
  )
  const props = validateRegistryProps(entry, node.props, children, node.children.length > 0)
  return createStaticPolicyElement(entry.exportPolicy.static, node, props, children)
}

function createStaticPolicyElement(
  policy: RegistryStaticExportPolicy,
  node: ExportIrComponentNode,
  props: Record<string, unknown>,
  children: ReactNode
): ReactElement {
  if (policy === 'render') {
    const entry = requireRegistryEntry(node.name)
    return createElement(entry.component, { ...props, key: node.id })
  }

  if (policy === 'counter-summary') {
    return createElement(
      'figure',
      { className: 'mdx-vault-static-control-summary', key: node.id },
      createElement('figcaption', null, 'Counter — static initial state'),
      createElement('output', null, String(props.initial ?? 0))
    )
  }

  if (policy === 'quiz-disclosure') {
    const options = Array.isArray(props.options) ? props.options : []
    const answerIndex = typeof props.answerIndex === 'number' ? props.answerIndex : -1
    return createElement(
      'section',
      { className: 'mdx-vault-static-quiz', key: node.id, 'aria-label': 'Quiz' },
      createElement('p', null, createElement('strong', null, String(props.question ?? 'Quiz'))),
      createElement(
        'ol',
        null,
        ...options.map((option, index) =>
          createElement('li', { key: `${String(option)}-${index}` }, String(option))
        )
      ),
      createElement(
        'details',
        null,
        createElement('summary', null, 'Reveal answer'),
        createElement('p', null, String(options[answerIndex] ?? 'No answer supplied')),
        props.explanation ? createElement('p', null, String(props.explanation)) : null
      )
    )
  }

  if (policy === 'equation-summary') {
    const variables = isRecord(props.variables) ? props.variables : {}
    return createElement(
      'figure',
      { className: 'mdx-vault-static-data-summary', key: node.id },
      createElement('figcaption', null, String(props.formula ?? 'Equation')),
      createElement(
        'table',
        null,
        createElement(
          'thead',
          null,
          createElement(
            'tr',
            null,
            ...['Variable', 'Minimum', 'Maximum', 'Initial', 'Step'].map((label) =>
              createElement('th', { key: label, scope: 'col' }, label)
            )
          )
        ),
        createElement(
          'tbody',
          null,
          ...Object.entries(variables).map(([name, value]) => {
            const config = isRecord(value) ? value : {}
            return createElement(
              'tr',
              { key: name },
              createElement('th', { scope: 'row' }, name),
              ...['min', 'max', 'default', 'step'].map((key) =>
                createElement('td', { key }, String(config[key] ?? '—'))
              )
            )
          })
        )
      )
    )
  }

  if (policy === 'data-table') {
    const data = Array.isArray(props.data) ? props.data.filter(isRecord) : []
    const columns = [...new Set(data.flatMap((row) => Object.keys(row)))]
    return createElement(
      'figure',
      { className: 'mdx-vault-static-data-summary', key: node.id },
      createElement('figcaption', null, String(props.title ?? 'Chart data')),
      data.length > 0
        ? createElement(
            'table',
            null,
            createElement(
              'thead',
              null,
              createElement(
                'tr',
                null,
                ...columns.map((column) =>
                  createElement('th', { key: column, scope: 'col' }, column)
                )
              )
            ),
            createElement(
              'tbody',
              null,
              ...data.map((row, index) =>
                createElement(
                  'tr',
                  { key: `row-${index}` },
                  ...columns.map((column) =>
                    createElement('td', { key: column }, String(row[column] ?? ''))
                  )
                )
              )
            )
          )
        : createElement('p', null, `Dataset: ${String(props.src ?? 'unavailable')}`)
    )
  }

  if (policy === 'algorithm-summary') {
    const data = Array.isArray(props.data) ? props.data.join(', ') : ''
    return createElement(
      'figure',
      { className: 'mdx-vault-static-data-summary', key: node.id },
      createElement('figcaption', null, `Algorithm: ${String(props.algorithm ?? '')}`),
      createElement('p', null, `Initial data: ${data}`),
      props.target === undefined
        ? null
        : createElement('p', null, `Target: ${String(props.target)}`)
    )
  }

  if (policy === 'widget-frame') {
    return createElement(
      'section',
      { className: 'in-widget', key: node.id, 'aria-label': String(props.title) },
      createElement(
        'header',
        { className: 'in-widget-head' },
        createElement('span', null, String(props.title)),
        createElement('span', { className: 'in-widget-status' }, 'STATIC')
      ),
      props.misconception
        ? createElement(
            'div',
            { className: 'in-widget-misconception' },
            'Misconception targeted: ',
            createElement('strong', null, String(props.misconception))
          )
        : null,
      createElement('div', { className: 'in-widget-body' }, children)
    )
  }

  if (policy === 'prediction-disclosure') {
    const options = Array.isArray(props.options) ? props.options : []
    return createElement(
      'section',
      { className: 'in-gate', key: node.id, 'aria-label': 'Prediction gate' },
      createElement(
        'div',
        { className: 'in-gate-question' },
        createElement('strong', null, 'Predict first: '),
        String(props.question)
      ),
      createElement(
        'ul',
        { className: 'mdx-vault-static-options' },
        ...options.map((option, index) =>
          createElement('li', { key: `${String(option)}-${index}` }, String(option))
        )
      ),
      createElement(
        'details',
        { className: 'in-gate-verdict' },
        createElement('summary', null, 'Reveal answer and explanation'),
        props.answer
          ? createElement('p', null, createElement('strong', null, String(props.answer)))
          : null,
        props.explain ? createElement('p', null, String(props.explain)) : null
      )
    )
  }

  return createElement(
    'article',
    { className: 'in-question', key: node.id },
    createElement(
      'div',
      { className: 'in-question-head' },
      createElement('span', { className: 'in-question-level' }, `Level ${String(props.level)}`),
      createElement('span', null, String(props.question))
    ),
    createElement(
      'details',
      { className: 'in-question-answer' },
      createElement('summary', null, 'Reveal answer'),
      children
    )
  )
}

function createIntrinsicElement(
  node: ExportIrElementNode,
  createChild: (node: ExportIrNode) => ReactNode
): ReactElement {
  const properties = toReactProperties(node.properties)
  const children = createChildren(node.children, createChild)
  return createElement(node.tagName, { ...properties, key: node.id }, children)
}

function createChildren(
  nodes: ExportIrNode[],
  createChild: (node: ExportIrNode) => ReactNode
): ReactNode {
  if (nodes.length === 0) return undefined
  return nodes.map((node) => createElement(Fragment, { key: node.id }, createChild(node)))
}

function createSandboxSlot(nodeId: string, src: string, fallback?: string): ReactElement {
  return createElement('div', {
    key: nodeId,
    className: 'mdx-vault-sandbox',
    'data-sandbox-node-id': nodeId,
    'aria-label': `Interactive island ${src}`,
    ...(fallback ? { dangerouslySetInnerHTML: { __html: fallback } } : {})
  })
}

function validateRegistryProps(
  entry: ComponentRegistryEntry,
  authoredProps: Record<string, ExportJsonValue>,
  children: ReactNode,
  hasChildren: boolean
): Record<string, unknown> {
  const rawProps: Record<string, unknown> = {
    ...entry.defaultProps,
    ...authoredProps
  }
  if (hasChildren) rawProps.children = children
  const result = entry.propsSchema.safeParse(rawProps)
  if (!result.success) {
    throw new ExportTreeRenderError(
      entry.name,
      result.error.issues.map((issue) => `${issue.path.join('.') || 'props'}: ${issue.message}`)
    )
  }
  return result.data as Record<string, unknown>
}

function requireRegistryEntry(name: string): ComponentRegistryEntry {
  const entry = registryByName.get(name)
  if (!entry) throw new ExportTreeRenderError(name, ['component is not registered'])
  return entry
}

function containsTrustedComponent(node: ExportIrNode): boolean {
  if (node.type === 'component') return true
  if (node.type !== 'element') return false
  return node.children.some(containsTrustedComponent)
}

function toReactProperties(properties: Record<string, ExportJsonValue>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'style' && typeof value === 'string') {
      output.style = parseStyleAttribute(value)
      continue
    }
    if (key === 'className' && Array.isArray(value)) {
      output.className = value.join(' ')
      continue
    }
    if (key.startsWith('aria') && key.length > 4) {
      output[`aria-${camelToKebab(key.slice(4))}`] = value
      continue
    }
    if (key.startsWith('data') && key.length > 4) {
      output[`data-${camelToKebab(key.slice(4))}`] = value
      continue
    }
    output[key] = value
  }
  return output
}

function parseStyleAttribute(value: string): Record<string, string> {
  const styles: Record<string, string> = {}
  for (const declaration of value.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator < 1) continue
    const property = declaration.slice(0, separator).trim()
    const propertyValue = declaration.slice(separator + 1).trim()
    if (!property || !propertyValue) continue
    const reactProperty = property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
    styles[reactProperty] = propertyValue
  }
  return styles
}

function camelToKebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function hydrationPrefix(nodeId: string): string {
  return `export-${nodeId}-`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export class ExportTreeRenderError extends Error {
  constructor(
    readonly componentName: string,
    readonly issues: string[]
  ) {
    super(`Cannot render ${componentName}: ${issues.join('; ')}`)
    this.name = 'ExportTreeRenderError'
  }
}

export const __internalTesting = {
  containsTrustedComponent,
  toReactProperties,
  hydrationPrefix
}
