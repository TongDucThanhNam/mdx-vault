import type { MDXComponents } from 'mdx/types'
import {
  type AnchorHTMLAttributes,
  type ComponentType,
  type ImgHTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useState
} from 'react'

import { cn } from '@/lib/utils'
import type { IndexedNoteSummary } from '@/vault/types'
import { parseWikilinkUrl, resolveWikilinkTarget } from '../../../shared/wikilinks'
import { MermaidAwarePre } from './MermaidAwarePre'
import {
  type PreviewImageCache,
  type PreviewImageSource,
  resolvePreviewImageSource
} from './preview-image'
import { createRegistryComponents } from './registry'
import { UnknownComponentPlaceholder } from './registry/messages'
import { Interactive } from './sandbox/Interactive'
import { SandboxedHTML } from './sandbox/SandboxedHTML'

interface CreateMdxComponentsOptions {
  notes: IndexedNoteSummary[]
  onNavigate: (relativePath: string) => void
  selectedPath: string | null
  imageCache: PreviewImageCache
}

export function createMdxComponents({
  notes,
  onNavigate,
  selectedPath,
  imageCache
}: CreateMdxComponentsOptions): MDXComponents {
  const registryComponents = createRegistryComponents()
  const unknownComponents = new Map<string, ComponentType<Record<string, unknown>>>()
  const PreviewImage = createPreviewImageComponent(selectedPath, imageCache)

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
    img: PreviewImage,
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

interface ImageLoadState {
  path: string
  status: 'loading' | 'ready' | 'error'
  objectUrl?: string
  message?: string
}

function createPreviewImageComponent(
  selectedPath: string | null,
  imageCache: PreviewImageCache
): ComponentType<ImgHTMLAttributes<HTMLImageElement>> {
  function PreviewImage({
    src,
    alt = '',
    title,
    className,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement>): ReactNode {
    const resolution = useMemo(() => resolvePreviewImageSource(selectedPath, src), [src])
    const [loadState, setLoadState] = useState<ImageLoadState>({
      path: '',
      status: 'loading'
    })

    useEffect(() => {
      if (resolution.kind !== 'vault') {
        return
      }

      let active = true
      const path = resolution.relativePath
      setLoadState({ path, status: 'loading' })

      void imageCache
        .load(path)
        .then((objectUrl) => {
          if (active) {
            setLoadState({ path, status: 'ready', objectUrl })
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setLoadState({ path, status: 'error', message: formatImageError(error) })
          }
        })

      return () => {
        active = false
      }
    }, [resolution, imageCache])

    if (resolution.kind === 'passthrough') {
      return (
        <img
          {...props}
          src={resolution.src}
          alt={alt}
          title={title}
          className={cn('block h-auto max-w-full', className)}
        />
      )
    }

    if (resolution.kind === 'error') {
      return renderImageError({ alt, path: resolution.path, message: resolution.message })
    }

    const currentState = readCurrentImageState(resolution, loadState)
    if (currentState.status === 'ready' && currentState.objectUrl) {
      return (
        <img
          {...props}
          src={currentState.objectUrl}
          alt={alt}
          title={title}
          className={cn('block h-auto max-w-full', className)}
        />
      )
    }

    if (currentState.status === 'error') {
      return renderImageError({
        alt,
        path: resolution.relativePath,
        message: currentState.message ?? 'Image could not be loaded'
      })
    }

    return (
      <span
        role="status"
        className="inline-flex max-w-full items-center gap-2 border border-dashed border-[var(--line)] bg-[var(--paper-dark)] px-2 py-1 font-mono text-[10px] leading-tight text-muted-foreground"
      >
        <span className="size-1.5 shrink-0 bg-muted-foreground" aria-hidden="true" />
        <span className="truncate">Loading image · {alt || resolution.relativePath}</span>
      </span>
    )
  }

  PreviewImage.displayName = 'PreviewImage'
  return PreviewImage
}

function readCurrentImageState(
  resolution: Extract<PreviewImageSource, { kind: 'vault' }>,
  loadState: ImageLoadState
): ImageLoadState {
  return loadState.path === resolution.relativePath
    ? loadState
    : { path: resolution.relativePath, status: 'loading' }
}

function renderImageError({
  alt,
  path,
  message
}: {
  alt: string
  path: string
  message: string
}): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={`Image unavailable: ${alt || path}`}
      title={message}
      className="inline-flex max-w-full items-center gap-1.5 border border-dashed border-destructive/60 bg-destructive/5 px-2 py-1 font-mono text-[10px] leading-tight text-muted-foreground"
    >
      <span className="shrink-0 font-bold text-destructive" aria-hidden="true">
        ×
      </span>
      <span className="truncate">
        {alt || 'Image'} · {path || 'missing path'}
      </span>
    </span>
  )
}

function formatImageError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isComponentName(name: string): boolean {
  const firstCharacter = name.at(0)
  return firstCharacter !== undefined && firstCharacter === firstCharacter.toLocaleUpperCase()
}
