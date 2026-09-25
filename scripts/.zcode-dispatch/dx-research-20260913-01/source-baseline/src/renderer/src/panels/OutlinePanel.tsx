import { BookmarkPlus, ListTree } from 'lucide-react'
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  buildOutlineConnectorPath,
  getOutlineLineOffset,
  type OutlineConnectorPoint
} from '@/components/layout/living-outline'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/useI18n'
import { cn } from '@/lib/utils'
import type { NoteHeadingResult } from '@/vault/types'

interface OutlinePanelProps {
  headings: readonly NoteHeadingResult[]
  activeHeadingId: string | null
  selectedPath: string | null
  onSelectHeading: (heading: NoteHeadingResult) => void
  onBookmarkHeading?: (heading: NoteHeadingResult) => void
}

// Buffer/cursor updates must not rebuild every heading row on each keystroke.
export const OutlinePanel = memo(function OutlinePanel({
  headings,
  activeHeadingId,
  selectedPath,
  onSelectHeading,
  onBookmarkHeading
}: OutlinePanelProps): React.JSX.Element {
  const { t } = useI18n()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const itemRefs = useRef(new Map<string, HTMLLIElement>())
  const activeClipId = useId()
  const [connector, setConnector] = useState<{
    height: number
    width: number
    path: string
    activeBottom: number
  } | null>(null)
  const minimumDepth = useMemo(
    () => headings.reduce((minimum, heading) => Math.min(minimum, heading.depth), 6),
    [headings]
  )

  useEffect(() => {
    const list = listRef.current
    if (!list || headings.length === 0) {
      setConnector(null)
      return
    }

    const measure = (): void => {
      const listRect = list.getBoundingClientRect()
      const points = headings.flatMap<OutlineConnectorPoint & { id: string }>((heading) => {
        const item = itemRefs.current.get(heading.id)
        if (!item) return []
        const itemRect = item.getBoundingClientRect()
        return [
          {
            id: heading.id,
            depth: heading.depth,
            top: itemRect.top - listRect.top + itemRect.height / 2
          }
        ]
      })
      const activePoint = points.find((point) => point.id === activeHeadingId) ?? points[0]
      const maximumDepth = headings.reduce(
        (maximum, heading) => Math.max(maximum, heading.depth),
        minimumDepth
      )

      setConnector({
        height: Math.max(list.scrollHeight, 1),
        width: getOutlineLineOffset(maximumDepth, minimumDepth) + 8,
        path: buildOutlineConnectorPath(points, minimumDepth),
        activeBottom: activePoint?.top ?? 0
      })
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(list)
    for (const item of itemRefs.current.values()) resizeObserver.observe(item)
    return () => resizeObserver.disconnect()
  }, [activeHeadingId, headings, minimumDepth])

  useEffect(() => {
    if (!activeHeadingId) return
    const scrollArea = scrollAreaRef.current
    const item = itemRefs.current.get(activeHeadingId)
    if (!scrollArea || !item) return

    const areaRect = scrollArea.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    const topGuard = areaRect.top + 8
    const bottomGuard = areaRect.bottom - 8
    let nextScrollTop: number | null = null

    if (itemRect.top < topGuard) {
      nextScrollTop = scrollArea.scrollTop + itemRect.top - topGuard
    } else if (itemRect.bottom > bottomGuard) {
      nextScrollTop = scrollArea.scrollTop + itemRect.bottom - bottomGuard
    }

    if (nextScrollTop !== null) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      scrollArea.scrollTo({ top: nextScrollTop, behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }, [activeHeadingId])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2 font-sans text-xs font-semibold text-muted-foreground">
          <ListTree className="size-3.5" aria-hidden="true" />
          {t('outline.title')}
        </div>
        <div className="font-mono text-xs tabular-nums text-muted-foreground">
          <span className="sr-only">{t('outline.count', { count: headings.length })}</span>
          <span aria-hidden="true">{headings.length}</span>
        </div>
      </div>

      <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {!selectedPath ? (
          <div className="px-2 py-6 text-center font-sans text-xs text-muted-foreground">
            {t('outline.selectNote')}
          </div>
        ) : headings.length === 0 ? (
          <div className="px-2 py-6 text-center font-sans text-xs text-muted-foreground">
            {t('outline.noHeadings')}
          </div>
        ) : (
          <ol ref={listRef} className="relative isolate m-0 list-none space-y-1 p-0">
            {connector?.path ? (
              <svg
                className="pointer-events-none absolute inset-x-0 top-0 z-10 text-border"
                width={connector.width}
                height={connector.height}
                viewBox={`0 0 ${connector.width} ${connector.height}`}
                fill="none"
                aria-hidden="true"
              >
                <defs>
                  <clipPath id={activeClipId}>
                    <rect x="0" y="0" width={connector.width} height={connector.activeBottom} />
                  </clipPath>
                </defs>
                <path d={connector.path} stroke="currentColor" strokeWidth="1" />
                <path
                  d={connector.path}
                  stroke="var(--instrument-blue)"
                  strokeWidth="2"
                  clipPath={`url(#${activeClipId})`}
                />
              </svg>
            ) : null}
            {headings.map((heading) => (
              <li
                key={heading.id}
                ref={(element) => {
                  if (element) itemRefs.current.set(heading.id, element)
                  else itemRefs.current.delete(heading.id)
                }}
                className={cn(
                  'group flex min-h-8 w-full items-center transition-colors hover:bg-muted/60',
                  heading.id === activeHeadingId
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground'
                )}
                style={{ paddingLeft: `${28 + Math.max(0, heading.depth - minimumDepth) * 10}px` }}
              >
                <button
                  type="button"
                  className="grid min-h-8 min-w-0 flex-1 grid-cols-[2rem_minmax(0,1fr)] items-center text-left focus-visible:ring-2 focus-visible:ring-instrument-blue focus-visible:outline-none"
                  title={heading.text}
                  aria-label={t('outline.heading', {
                    level: heading.depth,
                    title: heading.text
                  })}
                  aria-current={heading.id === activeHeadingId ? 'location' : undefined}
                  onClick={() => onSelectHeading(heading)}
                >
                  <span className="font-mono text-xs font-medium tabular-nums opacity-70">
                    H{heading.depth}
                  </span>
                  <span className="truncate text-sm font-medium">{heading.text}</span>
                </button>
                {onBookmarkHeading ? (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    title={t('outline.bookmark', { title: heading.text })}
                    aria-label={t('outline.bookmark', { title: heading.text })}
                    onClick={() => onBookmarkHeading(heading)}
                  >
                    <BookmarkPlus className="size-3" aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
})
