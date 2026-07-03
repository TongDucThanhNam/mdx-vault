import type { MDXComponents } from 'mdx/types'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { Counter } from './Counter'
import { cn } from '@/lib/utils'
import type { IndexedNoteSummary } from '@/vault/types'
import { parseWikilinkUrl, resolveWikilinkTarget } from '../../../shared/wikilinks'

interface CreateMdxComponentsOptions {
  notes: IndexedNoteSummary[]
  onNavigate: (relativePath: string) => void
}

export function createMdxComponents({
  notes,
  onNavigate
}: CreateMdxComponentsOptions): MDXComponents {
  function WikilinkAwareAnchor({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>): ReactNode {
    const target = parseWikilinkUrl(href)

    if (!target) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    }

    const resolvedNote = resolveWikilinkTarget(notes, target)

    return (
      <button
        type="button"
        className={cn(
          'inline cursor-pointer rounded-sm border-0 bg-transparent p-0 align-baseline font-medium underline underline-offset-3 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          resolvedNote
            ? 'text-primary decoration-primary/40 hover:decoration-primary'
            : 'text-muted-foreground decoration-dashed decoration-muted-foreground/50'
        )}
        title={resolvedNote ? resolvedNote.relativePath : `Unresolved: ${target}`}
        aria-label={resolvedNote ? `Open ${target}` : `Unresolved link ${target}`}
        onClick={() => {
          if (resolvedNote) {
            onNavigate(resolvedNote.relativePath)
          }
        }}
      >
        {children}
      </button>
    )
  }

  return {
    Counter,
    a: WikilinkAwareAnchor
  }
}
