import type { WorkbenchItem } from '@/workbench/types'

export type LocalGraphUnavailableReason = 'no-active-note' | 'unsupported-item' | 'missing-note'

export type LocalGraphContext =
  | { rootRelativePath: string; unavailableReason: null }
  | { rootRelativePath: null; unavailableReason: LocalGraphUnavailableReason }

export function resolveLocalGraphContext(item: WorkbenchItem | null): LocalGraphContext {
  if (!item) {
    return { rootRelativePath: null, unavailableReason: 'no-active-note' }
  }
  if (item.kind !== 'note') {
    return { rootRelativePath: null, unavailableReason: 'unsupported-item' }
  }
  if (item.missing) {
    return { rootRelativePath: null, unavailableReason: 'missing-note' }
  }
  return {
    rootRelativePath: item.relativePath,
    unavailableReason: null
  }
}
