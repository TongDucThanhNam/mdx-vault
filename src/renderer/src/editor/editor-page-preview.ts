import type { IndexedNoteSummary } from '@/vault/types'
import {
  parseWikilinkTarget,
  resolveMarkdownNoteTarget,
  resolveWikilinkTarget,
  type WikilinkSubpath
} from '../../../shared/wikilinks'
import type { GotoDefinitionTarget } from './goto-definition'

export function resolveEditorPreviewTarget(
  target: GotoDefinitionTarget | null,
  notes: IndexedNoteSummary[],
  sourceRelativePath: string | undefined
): { note: IndexedNoteSummary; subpath: WikilinkSubpath | null } | null {
  if (target?.type === 'wikilink') {
    const reference = parseWikilinkTarget(target.value)
    const note = resolveWikilinkTarget(notes, target.value, sourceRelativePath)
    return reference && note ? { note, subpath: reference.subpath } : null
  }
  if (target?.type === 'path') {
    const resolved = resolveMarkdownNoteTarget(notes, target.value, sourceRelativePath)
    return resolved ? { note: resolved.note, subpath: resolved.reference.subpath } : null
  }
  return null
}
