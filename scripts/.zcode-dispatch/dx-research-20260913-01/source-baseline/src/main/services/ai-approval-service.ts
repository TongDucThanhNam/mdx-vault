import { access, mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname } from 'path'

import type { PatchOperation } from '../../shared/ai'
import { sandboxManifestSchema } from '../../shared/sandbox'
import { applyAllOperations } from './ai-patch-engine'
import { safeJoin } from './safe-path'
import { SandboxService } from './sandbox-service'
import type { VaultService } from './vault-service'

export async function approveAiPatch(
  vault: VaultService,
  noteRelativePath: string,
  operations: PatchOperation[]
): Promise<{ writtenPaths: string[] }> {
  const originalNote = await vault.readFile(noteRelativePath)
  const applied = applyAllOperations(originalNote, operations)
  const createdPaths: string[] = []
  let noteWritten = false

  await validateDrafts(vault, operations)

  for (const file of applied.files) {
    const target = safeJoin(vault.rootPath, file.relativePath)
    if (await exists(target)) {
      throw new Error(`AI approval refuses to overwrite existing file: ${file.relativePath}`)
    }
  }

  try {
    for (const file of applied.files) {
      const target = safeJoin(vault.rootPath, file.relativePath)
      const temporary = `${target}.tmp-ai-${process.pid}-${Date.now()}`
      await mkdir(dirname(target), { recursive: true })
      await writeFile(temporary, file.content, 'utf8')
      await rename(temporary, target)
      createdPaths.push(file.relativePath)
    }

    if (applied.text !== originalNote) {
      await vault.writeFile(noteRelativePath, applied.text)
      noteWritten = true
    }

    const writtenPaths = [...createdPaths]
    if (noteWritten) writtenPaths.push(noteRelativePath)
    if (writtenPaths.length === 0) throw new Error('AI approval produced no changes')
    return { writtenPaths }
  } catch (error) {
    if (noteWritten) await vault.writeFile(noteRelativePath, originalNote)
    await Promise.all(
      createdPaths.map((relativePath) =>
        rm(safeJoin(vault.rootPath, relativePath), { force: true }).catch(() => undefined)
      )
    )
    throw error
  }
}

async function validateDrafts(vault: VaultService, operations: PatchOperation[]): Promise<void> {
  const sandbox = new SandboxService(vault)
  for (const operation of operations) {
    if (operation.kind !== 'componentDraft') continue
    const parsed = sandboxManifestSchema.parse(JSON.parse(operation.manifestJson))
    const verdict = await sandbox.compileDraft(operation.componentSource, parsed)
    if (!verdict.ok)
      throw new Error(`Component draft failed validation: ${verdict.errors.join('; ')}`)
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
