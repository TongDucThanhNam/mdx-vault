import type { WorkbenchItem } from '@/workbench/types'

export interface TabContextCloseTargets {
  current: readonly string[]
  others: readonly string[]
  left: readonly string[]
  right: readonly string[]
  saved: readonly string[]
  all: readonly string[]
}

export interface BatchCloseCandidate {
  id: string
  requiresActivation: boolean
}

export function runTabFileAction(
  item: WorkbenchItem,
  action: (relativePath: string) => void
): boolean {
  if (item.kind === 'graph') {
    return false
  }

  action(item.relativePath)
  return true
}

/** Derives each context-menu close set from the stable visual tab order. */
export function deriveTabContextCloseTargets(
  items: readonly WorkbenchItem[],
  targetId: string
): TabContextCloseTargets {
  const targetIndex = items.findIndex((item) => item.id === targetId)
  if (targetIndex < 0) {
    return { current: [], others: [], left: [], right: [], saved: [], all: [] }
  }

  return {
    current: [targetId],
    others: items.filter((item) => item.id !== targetId).map((item) => item.id),
    left: items.slice(0, targetIndex).map((item) => item.id),
    right: items.slice(targetIndex + 1).map((item) => item.id),
    saved: items.filter((item) => !item.dirty).map((item) => item.id),
    all: items.map((item) => item.id)
  }
}

/**
 * Keeps bulk close safe: close the active candidate first, otherwise prefer an
 * inactive saved item. An unsaved inactive item must be activated before its
 * existing single-item transaction is allowed to save and close it.
 */
export function selectNextBatchCloseCandidate(
  items: readonly WorkbenchItem[],
  activeId: string | null,
  pendingIds: ReadonlySet<string>
): BatchCloseCandidate | null {
  const activeCandidate = activeId
    ? items.find((item) => item.id === activeId && pendingIds.has(item.id))
    : null
  if (activeCandidate) {
    return { id: activeCandidate.id, requiresActivation: false }
  }

  const savedCandidate = items.find((item) => pendingIds.has(item.id) && !item.dirty)
  if (savedCandidate) {
    return { id: savedCandidate.id, requiresActivation: false }
  }

  const unsavedCandidate = items.find((item) => pendingIds.has(item.id))
  return unsavedCandidate ? { id: unsavedCandidate.id, requiresActivation: true } : null
}
