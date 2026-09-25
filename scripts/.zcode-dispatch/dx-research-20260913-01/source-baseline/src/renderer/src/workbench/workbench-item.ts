import { isEditableTextPath, isNotePath, isPreviewableVaultImagePath } from '@/vault/file-kind'
import type { DefaultNoteViewSetting } from '../../../shared/app-settings'
import { resolveInteractiveProjectPath } from '../../../shared/interactive-authoring'
import type { FileWorkbenchItem, GraphWorkbenchItem, WorkbenchItemKind } from './types'
import { createWorkbenchItem, GLOBAL_GRAPH_WORKBENCH_ID } from './workbench-state'

export function createWorkbenchItemForPath(
  relativePath: string,
  defaultNoteView: DefaultNoteViewSetting
): FileWorkbenchItem {
  const kind = classifyWorkbenchItem(relativePath)

  return createWorkbenchItem({
    relativePath,
    kind,
    viewState: kind === 'note' ? { viewMode: defaultNoteView } : undefined
  })
}

export function createGlobalGraphWorkbenchItem(): GraphWorkbenchItem {
  return {
    id: GLOBAL_GRAPH_WORKBENCH_ID,
    kind: 'graph',
    resource: { kind: 'global-graph' },
    dirty: false,
    missing: false,
    autosavePaused: false
  }
}

function classifyWorkbenchItem(relativePath: string): WorkbenchItemKind {
  if (resolveInteractiveProjectPath(relativePath)?.kind === 'readme') {
    return 'text'
  }
  if (isNotePath(relativePath)) {
    return 'note'
  }
  if (isEditableTextPath(relativePath)) {
    return 'text'
  }
  if (isPreviewableVaultImagePath(relativePath)) {
    return 'image'
  }
  return 'unsupported'
}
