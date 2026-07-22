import type { ExportScanResult } from '../../shared/export'
import { type ExportIrDocument, parseNoteToExportIr } from './export-ir'

export interface RenderedNote {
  ir: ExportIrDocument
  meta: ExportScanResult
}

/**
 * Parse MDX into the versioned export IR without evaluating note code. The
 * compatibility name is retained for callers from the original export
 * pipeline, but placeholders are no longer produced.
 */
export function parseNoteForExport(
  source: string,
  noteRelativePath: string,
  noteTitle: string
): RenderedNote {
  return parseNoteToExportIr(source, noteRelativePath, noteTitle)
}
