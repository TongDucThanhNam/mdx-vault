export interface PreviewHighlightSelection {
  start: number
  end: number
  markStart?: number
  markEnd?: number
}

export function applyPreviewHighlight(
  source: string,
  selection: PreviewHighlightSelection
): string | null {
  const { start, end, markStart, markEnd } = selection

  if (!isValidRange(start, end, source.length)) {
    return null
  }

  const selectedText = source.slice(start, end)
  if (!selectedText || selectedText.trim() !== selectedText || selectedText.includes('\n')) {
    return null
  }

  if (markStart !== undefined || markEnd !== undefined) {
    if (
      markStart === undefined ||
      markEnd === undefined ||
      !isValidRange(markStart, markEnd, source.length) ||
      start < markStart + 2 ||
      end > markEnd - 2 ||
      source.slice(markStart, markStart + 2) !== '==' ||
      source.slice(markEnd - 2, markEnd) !== '=='
    ) {
      return null
    }

    return `${source.slice(0, markStart)}${source.slice(markStart + 2, markEnd - 2)}${source.slice(markEnd)}`
  }

  if (selectedText.includes('==')) {
    return null
  }

  return `${source.slice(0, start)}==${selectedText}==${source.slice(end)}`
}

function isValidRange(start: number, end: number, sourceLength: number): boolean {
  return (
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    start >= 0 &&
    start < end &&
    end <= sourceLength
  )
}
