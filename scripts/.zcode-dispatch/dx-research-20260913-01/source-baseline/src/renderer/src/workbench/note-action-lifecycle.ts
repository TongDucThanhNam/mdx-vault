import type { VaultTreeFile } from '@/vault/types'

export async function openVaultNote(
  open: () => Promise<boolean>,
  onOpened: () => void
): Promise<boolean> {
  const opened = await open()
  if (!opened) {
    return false
  }

  onOpened()
  return true
}

interface OpenRefreshedVaultFileOptions {
  relativePath: string
  refreshVaultSnapshot: () => Promise<VaultTreeFile[]>
  openFile: (relativePath: string, file: VaultTreeFile) => Promise<boolean>
}

export async function openRefreshedVaultFile(
  options: OpenRefreshedVaultFileOptions
): Promise<boolean> {
  const treeFiles = await options.refreshVaultSnapshot()
  const refreshedFile = treeFiles.find((file) => file.relativePath === options.relativePath)
  if (!refreshedFile) {
    throw new Error(`The file was not present in the refreshed vault: ${options.relativePath}`)
  }

  return options.openFile(options.relativePath, refreshedFile)
}

interface CreateAndOpenVaultNoteOptions {
  relativePath: string
  content: string
  saveActiveItem: () => Promise<boolean>
  createFile: (relativePath: string, content: string) => Promise<string>
  refreshVaultSnapshot: () => Promise<VaultTreeFile[]>
  openCreatedFile: (relativePath: string, file: VaultTreeFile) => Promise<boolean>
  rollbackCreatedFile: (relativePath: string) => Promise<void>
}

/**
 * Creates a note only after the active workbench item is safely persisted.
 * If the freshly-created note cannot become the active workbench item, move it
 * back out of the vault so a failed navigation cannot leave an orphan behind.
 */
export async function createAndOpenVaultNote(
  options: CreateAndOpenVaultNoteOptions
): Promise<string> {
  if (!(await options.saveActiveItem())) {
    throw new Error('The active file could not be saved; note creation was cancelled')
  }

  const createdPath = await options.createFile(options.relativePath, options.content)

  try {
    const treeFiles = await options.refreshVaultSnapshot()
    const createdFile = treeFiles.find((file) => file.relativePath === createdPath)
    if (!createdFile) {
      throw new Error(`The new note was not present in the refreshed vault: ${createdPath}`)
    }

    if (!(await options.openCreatedFile(createdPath, createdFile))) {
      throw new Error(`The new note could not be opened: ${createdPath}`)
    }

    return createdPath
  } catch (openError) {
    try {
      await options.rollbackCreatedFile(createdPath)
    } catch (rollbackError) {
      throw new Error(
        `The note was created at ${createdPath}, but opening and rollback both failed: ${errorMessage(rollbackError)}`,
        { cause: openError }
      )
    }

    try {
      await options.refreshVaultSnapshot()
    } catch {
      // The filesystem rollback already succeeded. The watcher or next refresh
      // will reconcile the renderer snapshot without risking another mutation.
    }

    throw new Error(`The note could not be opened, so ${createdPath} was moved to trash`, {
      cause: openError
    })
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
