import type { MDXComponents } from 'mdx/types'
import type { AnchorHTMLAttributes, ComponentType, ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { IndexedNoteSummary } from '@/vault/types'
import { parseWikilinkUrl, resolveWikilinkTarget } from '../../../shared/wikilinks'
import { MermaidAwarePre } from './MermaidAwarePre'
import { createRegistryComponents } from './registry'
import { UnknownComponentPlaceholder } from './registry/messages'
import { Interactive } from './sandbox/Interactive'
import { SandboxedHTML } from './sandbox/SandboxedHTML'

interface CreateMdxComponentsOptions {
  notes: IndexedNoteSummary[]
  onNavigate: (relativePath: string) => void
}

export function createMdxComponents({
  notes,
  onNavigate
}: CreateMdxComponentsOptions): MDXComponents {
  const registryComponents = createRegistryComponents()
  const unknownComponents = new Map<string, ComponentType<Record<string, unknown>>>()

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
          'inline cursor-pointer border-0 bg-transparent p-0 align-baseline font-semibold underline underline-offset-3 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          resolvedNote
            ? 'text-[var(--editorial-blue)] decoration-[color-mix(in_srgb,var(--editorial-blue)_40%,transparent)] hover:decoration-[var(--editorial-blue)]'
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

  const components: MDXComponents = {
    ...registryComponents,
    Interactive,
    SandboxedHTML,
    a: WikilinkAwareAnchor,
    pre: MermaidAwarePre
  }

  return new Proxy(components, {
    get(target, property, receiver) {
      if (typeof property !== 'string' || property in target || !isComponentName(property)) {
        return Reflect.get(target, property, receiver)
      }

      let UnknownComponent = unknownComponents.get(property)

      if (!UnknownComponent) {
        UnknownComponent = function UnknownMdxComponent(): React.JSX.Element {
          return <UnknownComponentPlaceholder componentName={property} />
        }
        UnknownComponent.displayName = `Unknown${property}`
        unknownComponents.set(property, UnknownComponent)
      }

      return UnknownComponent
    }
  }) as MDXComponents
}

function isComponentName(name: string): boolean {
  const firstCharacter = name.at(0)
  return firstCharacter !== undefined && firstCharacter === firstCharacter.toLocaleUpperCase()
}
