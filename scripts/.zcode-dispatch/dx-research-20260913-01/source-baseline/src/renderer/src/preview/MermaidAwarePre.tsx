import type { HTMLAttributes, ReactNode } from 'react'
import { Children, isValidElement } from 'react'

import { MermaidDiagram } from './MermaidDiagram'

export function MermaidAwarePre({
  children,
  ...props
}: HTMLAttributes<HTMLPreElement>): React.JSX.Element {
  const chart = readMermaidChart(children)

  if (chart) {
    return <MermaidDiagram chart={chart} />
  }

  return <pre {...props}>{children}</pre>
}

function readMermaidChart(children: ReactNode): string | null {
  const childArray = Children.toArray(children)

  if (childArray.length !== 1) {
    return null
  }

  const child = childArray[0]

  if (!isValidElement(child) || child.type !== 'code') {
    return null
  }

  const props = child.props as { className?: unknown; children?: ReactNode }
  const className = typeof props.className === 'string' ? props.className : ''

  if (!/\blanguage-mermaid\b/.test(className)) {
    return null
  }

  const chart = extractText(props.children).trim()

  return chart ? chart : null
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }

  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children)
  }

  return ''
}
