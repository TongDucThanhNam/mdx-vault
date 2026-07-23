import type { Root } from 'mdast'
import { createElement, Fragment, type ReactNode } from 'react'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

import { remarkCallouts } from '../../../shared/remark-callouts'
import { remarkMarks } from '../../../shared/remark-mark'
import { remarkWikilink } from '../../../shared/remark-wikilink'
import { resolveWikilinkHeading, type WikilinkSubpath } from '../../../shared/wikilinks'

export const MAX_HOVER_PREVIEW_SOURCE_LENGTH = 250_000

interface PreviewMdastNode {
  type: string
  value?: string
  depth?: number
  ordered?: boolean
  start?: number | null
  checked?: boolean | null
  url?: string
  title?: string | null
  alt?: string | null
  lang?: string | null
  name?: string | null
  children?: PreviewMdastNode[]
  data?: {
    hName?: string
    hProperties?: Record<string, unknown>
  }
}

interface HoverPreviewHeading {
  node: PreviewMdastNode
  depth: number
  text: string
}

const hoverPreviewProcessor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkFrontmatter)
  .use(remarkWikilink)
  .use(remarkMarks)
  .use(remarkCallouts)

export function SafeHoverPreviewDocument({
  source,
  subpath = null
}: {
  source: string
  subpath?: WikilinkSubpath | null
}): React.JSX.Element {
  const document = parseHoverPreviewDocument(source)
  const headings = collectHeadings(document)
  const targetHeading = resolveWikilinkHeading(headings, subpath)?.node ?? null

  return <>{renderChildren(document.children, targetHeading)}</>
}

function parseHoverPreviewDocument(source: string): PreviewMdastNode {
  if (source.length > MAX_HOVER_PREVIEW_SOURCE_LENGTH) {
    throw new Error('This note is too large for an inline preview.')
  }

  const tree = hoverPreviewProcessor.runSync(hoverPreviewProcessor.parse(source)) as Root
  return tree as PreviewMdastNode
}

function renderChildren(
  children: PreviewMdastNode[] | undefined,
  targetHeading: PreviewMdastNode | null
): ReactNode[] {
  return (children ?? []).map((child, index) => renderNode(child, index, targetHeading))
}

function renderNode(
  node: PreviewMdastNode,
  key: number,
  targetHeading: PreviewMdastNode | null
): ReactNode {
  const children = renderChildren(node.children, targetHeading)

  switch (node.type) {
    case 'root':
      return <Fragment key={key}>{children}</Fragment>
    case 'text':
      return node.value ?? ''
    case 'paragraph':
      return node.data?.hName === 'div' ? (
        <div key={key} className="mdx-callout-title">
          {children}
        </div>
      ) : (
        <p key={key}>{children}</p>
      )
    case 'heading': {
      const depth = clampHeadingDepth(node.depth)
      return createElement(
        `h${depth}`,
        {
          key,
          'data-hover-preview-target': node === targetHeading ? 'true' : undefined
        },
        children
      )
    }
    case 'strong':
      return <strong key={key}>{children}</strong>
    case 'emphasis':
      return node.data?.hName === 'mark' ? (
        <mark key={key}>{children}</mark>
      ) : (
        <em key={key}>{children}</em>
      )
    case 'delete':
      return <del key={key}>{children}</del>
    case 'inlineCode':
      return <code key={key}>{node.value ?? ''}</code>
    case 'code':
      return (
        <pre key={key}>
          <code data-language={node.lang ?? undefined}>{node.value ?? ''}</code>
        </pre>
      )
    case 'blockquote':
      return node.data?.hName === 'aside' ? (
        <aside
          key={key}
          className="mdx-callout"
          data-callout={readCalloutType(node.data.hProperties)}
        >
          {children}
        </aside>
      ) : (
        <blockquote key={key}>{children}</blockquote>
      )
    case 'list':
      return node.ordered ? (
        <ol key={key} start={node.start ?? undefined}>
          {children}
        </ol>
      ) : (
        <ul key={key}>{children}</ul>
      )
    case 'listItem':
      return (
        <li key={key}>
          {typeof node.checked === 'boolean' ? (
            <input
              type="checkbox"
              checked={node.checked}
              readOnly
              tabIndex={-1}
              aria-hidden="true"
            />
          ) : null}
          {children}
        </li>
      )
    case 'link':
    case 'linkReference':
      return (
        <span key={key} className="hover-preview-link">
          {children}
        </span>
      )
    case 'image':
    case 'imageReference':
      return (
        <span key={key} className="hover-preview-media" role="img" aria-label={node.alt || 'Image'}>
          <span aria-hidden="true">IMAGE</span>
          {node.alt ? ` · ${node.alt}` : ''}
        </span>
      )
    case 'break':
      return <br key={key} />
    case 'thematicBreak':
      return <hr key={key} />
    case 'table':
      return (
        <div key={key} className="overflow-x-auto">
          <table>{children}</table>
        </div>
      )
    case 'tableRow':
      return <tr key={key}>{children}</tr>
    case 'tableCell':
      return <td key={key}>{children}</td>
    case 'math':
      return (
        <pre key={key}>
          <code data-language="math">{node.value ?? ''}</code>
        </pre>
      )
    case 'inlineMath':
      return <code key={key}>{node.value ?? ''}</code>
    case 'mdxJsxFlowElement':
      return (
        <div key={key} className="hover-preview-island">
          <span>{formatEmbeddedLabel(node.name)}</span>
          {children.length > 0 ? <div>{children}</div> : null}
        </div>
      )
    case 'mdxJsxTextElement':
      return (
        <span key={key} className="hover-preview-inline-island">
          {formatEmbeddedLabel(node.name)}
          {children.length > 0 ? <> · {children}</> : null}
        </span>
      )
    case 'mdxFlowExpression':
      return (
        <div key={key} className="hover-preview-island">
          Dynamic content hidden in page preview
        </div>
      )
    case 'mdxTextExpression':
      return (
        <span key={key} className="hover-preview-inline-island">
          Dynamic content
        </span>
      )
    case 'html':
      return (
        <span key={key} className="hover-preview-inline-island">
          HTML content hidden
        </span>
      )
    case 'yaml':
    case 'toml':
    case 'definition':
    case 'footnoteDefinition':
    case 'mdxjsEsm':
      return null
    case 'footnoteReference':
      return <sup key={key}>Footnote</sup>
    default:
      return children.length > 0 ? <Fragment key={key}>{children}</Fragment> : null
  }
}

function collectHeadings(document: PreviewMdastNode): HoverPreviewHeading[] {
  const headings: HoverPreviewHeading[] = []

  const visitNode = (node: PreviewMdastNode): void => {
    if (node.type === 'heading') {
      headings.push({
        node,
        depth: clampHeadingDepth(node.depth),
        text: extractText(node)
      })
    }

    for (const child of node.children ?? []) {
      visitNode(child)
    }
  }

  visitNode(document)
  return headings
}

function extractText(node: PreviewMdastNode): string {
  if (typeof node.value === 'string') {
    return node.value
  }

  return (node.children ?? []).map(extractText).join('')
}

function clampHeadingDepth(depth: number | undefined): number {
  if (!depth || !Number.isFinite(depth)) {
    return 2
  }

  return Math.min(6, Math.max(1, Math.round(depth)))
}

function readCalloutType(properties: Record<string, unknown> | undefined): string | undefined {
  const value = properties?.dataCallout
  return typeof value === 'string' ? value : undefined
}

function formatEmbeddedLabel(name: string | null | undefined): string {
  return name ? `Interactive · ${name}` : 'Embedded content'
}
