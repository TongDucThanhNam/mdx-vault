import { ExternalLink, FileQuestion, Image as ImageIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { PreviewImageCache } from '@/preview/preview-image'

interface ImageDimensions {
  width: number
  height: number
}

interface VaultImagePreviewProps {
  relativePath: string
  onDimensionsChange: (dimensions: ImageDimensions) => void
  onRevealInExplorer: () => void
}

type ImageLoadState =
  | { status: 'loading' }
  | { status: 'ready'; objectUrl: string }
  | { status: 'error'; message: string }

export function VaultImagePreview({
  relativePath,
  onDimensionsChange,
  onRevealInExplorer
}: VaultImagePreviewProps): React.JSX.Element {
  const imageCache = useMemo(() => new PreviewImageCache(), [])
  const [loadState, setLoadState] = useState<ImageLoadState>({ status: 'loading' })
  const fileName = getFileName(relativePath)

  useEffect(() => {
    let cancelled = false

    void imageCache.load(relativePath).then(
      (objectUrl) => {
        if (!cancelled) {
          setLoadState({ status: 'ready', objectUrl })
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setLoadState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load image'
          })
        }
      }
    )

    return () => {
      cancelled = true
      imageCache.dispose()
    }
  }, [imageCache, relativePath])

  if (loadState.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--paper-dark)] p-8">
        <div className="flex min-h-40 w-full max-w-xl items-center justify-center border-2 border-dashed border-[var(--line)] bg-background font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Loading image…
        </div>
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <EmptyState
        icon={<ImageIcon className="size-5" aria-hidden="true" />}
        title="Image unavailable"
        description={`${fileName} · ${loadState.message}`}
        action={
          <Button type="button" size="sm" variant="outline" onClick={onRevealInExplorer}>
            <ExternalLink className="size-4" aria-hidden="true" />
            Reveal in Explorer
          </Button>
        }
      />
    )
  }

  return (
    <div className="h-full overflow-auto bg-[var(--paper-dark)] p-6 sm:p-10">
      <figure className="mx-auto flex min-h-full w-fit max-w-full flex-col items-center justify-center gap-3">
        <img
          src={loadState.objectUrl}
          alt={fileName}
          className="block max-h-[calc(100vh-12rem)] max-w-full border-2 border-foreground bg-background object-contain shadow-[5px_5px_0_0_var(--foreground)]"
          onLoad={(event) => {
            onDimensionsChange({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight
            })
          }}
        />
        <figcaption className="max-w-full truncate font-mono text-[10px] tracking-wide text-muted-foreground">
          {relativePath}
        </figcaption>
      </figure>
    </div>
  )
}

export function NoVaultFilePreview({
  relativePath,
  onRevealInExplorer
}: {
  relativePath: string
  onRevealInExplorer: () => void
}): React.JSX.Element {
  return (
    <EmptyState
      icon={<FileQuestion className="size-5" aria-hidden="true" />}
      title="No preview available"
      description={relativePath}
      action={
        <Button type="button" size="sm" variant="outline" onClick={onRevealInExplorer}>
          <ExternalLink className="size-4" aria-hidden="true" />
          Reveal in Explorer
        </Button>
      }
    />
  )
}

function getFileName(relativePath: string): string {
  return relativePath.replaceAll('\\', '/').split('/').at(-1) ?? relativePath
}
