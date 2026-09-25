interface DeleteVaultNoteOptions {
  prepareDelete: () => Promise<boolean>
  deleteFile: () => Promise<void>
  refreshAfterDelete: () => Promise<void>
  commitDelete: () => Promise<boolean>
  reportSuccess: () => void
}

/**
 * Runs the existing note-only delete lifecycle without committing workbench UI
 * before the save, filesystem mutation, and refreshed vault snapshot succeed.
 */
export async function deleteVaultNote(options: DeleteVaultNoteOptions): Promise<boolean> {
  if (!(await options.prepareDelete())) {
    return false
  }

  await options.deleteFile()
  await options.refreshAfterDelete()

  if (!(await options.commitDelete())) {
    return false
  }

  options.reportSuccess()
  return true
}
