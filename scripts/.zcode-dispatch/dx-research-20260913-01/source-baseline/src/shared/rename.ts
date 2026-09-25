export interface RenamePlanPreview {
  oldRelativePath: string
  newRelativePath: string
  affectedFiles: string[]
  linkCount: number
  noteCount: number
}

export interface RenameResult {
  newRelativePath: string
  rewrittenFiles: string[]
  updatedLinks: number
}
