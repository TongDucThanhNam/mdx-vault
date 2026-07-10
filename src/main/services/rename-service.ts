import { getNoteLinkKeys } from '../../shared/wikilinks'
import { buildRenamePlan, type RenamePlan } from './rename-plan'
import type { VaultIndexRuntime } from './vault-index-runtime'
import type { VaultService } from './vault-service'

export async function planVaultRename(
  vault: VaultService,
  index: VaultIndexRuntime,
  oldRelativePath: string,
  newRelativePath: string
): Promise<RenamePlan> {
  const validated = await vault.validateRename(oldRelativePath, newRelativePath)
  const notes = index.database.listNotes()
  const renamedNote = notes.find(
    (note) => normalizeVaultPath(note.relativePath) === validated.oldRelativePath
  )

  if (!renamedNote) {
    throw new Error('The note is not available in the vault index')
  }

  const candidatePaths = new Set(index.database.findLinkSourcePaths(getNoteLinkKeys(renamedNote)))
  candidatePaths.add(validated.oldRelativePath)

  const sources = await Promise.all(
    [...candidatePaths].map(async (relativePath) => ({
      relativePath,
      content: await vault.readFile(relativePath)
    }))
  )

  return buildRenamePlan({
    oldRelativePath: validated.oldRelativePath,
    newRelativePath: validated.newRelativePath,
    notes,
    sources
  })
}

function normalizeVaultPath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/')
}
