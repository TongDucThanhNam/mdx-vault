import {
  selectBlockForSourceOffset,
  selectTopVisibleBlock,
  sourceOffsetToLine
} from './preview-anchor'

interface ElementBlock {
  element: HTMLElement
  offset: number
  line: number | null
  top: number
}

function blocks(root: HTMLElement): ElementBlock[] {
  return [...root.querySelectorAll<HTMLElement>('[data-preview-block-start]')]
    .flatMap((element) => {
      const offset = Number(element.dataset.previewBlockStart)
      const line = Number(element.dataset.previewBlockLine)
      return Number.isInteger(offset) && offset >= 0
        ? [
            {
              element,
              offset,
              line: Number.isInteger(line) && line > 0 ? line : null,
              top: element.getBoundingClientRect().top
            }
          ]
        : []
    })
    .sort((left, right) => left.offset - right.offset)
}

export function revealReadingSourceOffset(root: HTMLElement, offset: number): boolean {
  const all = blocks(root)
  const position = selectBlockForSourceOffset(all, offset)
  if (!position) return false
  position.element.scrollIntoView({ block: 'start' })
  return true
}

export function topReadingSourceLine(root: HTMLElement, source: string): number | null {
  const all = blocks(root).sort((left, right) => left.top - right.top)
  const position = selectTopVisibleBlock(all, root.getBoundingClientRect().top + 8)
  return position ? (position.line ?? sourceOffsetToLine(source, position.offset)) : null
}

export function scrollReading(root: HTMLElement, fraction: number): void {
  root.scrollBy({ top: root.clientHeight * fraction, behavior: 'instant' })
}

export function navigateReadingHeading(root: HTMLElement, direction: -1 | 1): boolean {
  const headings = [...root.querySelectorAll<HTMLElement>('[data-mdx-heading-id]')]
  const threshold = root.getBoundingClientRect().top + 8
  const target =
    direction === 1
      ? headings.find((heading) => heading.getBoundingClientRect().top > threshold + 2)
      : headings.toReversed().find((heading) => heading.getBoundingClientRect().top < threshold - 2)
  if (!target) return false
  target.scrollIntoView({ block: 'start' })
  return true
}
