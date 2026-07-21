import { ExternalLink, FileQuestion, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

interface ImageDimensions {
  width: number
  height: number
}

interface VaultImagePreviewProps {
  relativePath: string
  objectUrl: string
  onDimensionsChange: (dimensions: ImageDimensions) => void
  onRevealInExplorer: () => void
}

export function VaultImagePreview({
  relativePath,
  objectUrl,
  onDimensionsChange,
  onRevealInExplorer
}: VaultImagePreviewProps): React.JSX.Element {
  const [decodeFailed, setDecodeFailed] = useState(false)
  const fileName = getFileName(relativePath)

  if (decodeFailed) {
    return (
      <EmptyState
        icon={<ImageIcon className="size-5" aria-hidden="true" />}
        title="Image unavailable"
        description={`${fileName} · Image data could not be decoded`}
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
          src={objectUrl}
          alt={fileName}
          className="block max-h-[calc(100vh-12rem)] max-w-full border-2 border-foreground bg-background object-contain shadow-[5px_5px_0_0_var(--foreground)]"
          onError={() => {
            setDecodeFailed(true)
          }}
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
