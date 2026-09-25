import type {
  LinkMentionRequest,
  PropertyMutationRequest,
  PropertyMutationResponse,
  PropertyRenameApplyRequest,
  PropertyRenamePlan,
  PropertyRenameResult
} from '../../shared/knowledge'
import { linkUnlinkedMention } from '../../shared/knowledge-source'
import {
  applyPropertyMutation,
  type PropertyMutation,
  parseFrontmatterProperties,
  renamePropertyKey
} from './frontmatter-properties'
import { hashContent } from './index-service'
import type { VaultIndexRuntime } from './vault-index-runtime'
import type { VaultService } from './vault-service'

export async function mutateNoteProperty(
  vault: VaultService,
  index: VaultIndexRuntime,
  request: PropertyMutationRequest
): Promise<PropertyMutationResponse> {
  const source = await vault.readFile(request.relativePath)
  const mutation: PropertyMutation = {
    ...request.mutation,
    expectedSourceHash: request.expectedContentHash
  }
  const result = applyPropertyMutation(source, mutation)
  await vault.writeFile(request.relativePath, result.source)

  try {
    await index.indexFile(request.relativePath)
  } catch (error) {
    await vault.writeFile(request.relativePath, source)
    await index.indexFile(request.relativePath)
    throw error
  }

  return {
    relativePath: request.relativePath,
    source: result.source,
    contentHash: result.contentHash
  }
}

export async function linkNoteMention(
  vault: VaultService,
  index: VaultIndexRuntime,
  request: LinkMentionRequest
): Promise<PropertyMutationResponse> {
  const source = await vault.readFile(request.relativePath)
  const nextSource = linkUnlinkedMention(
    source,
    request.mention,
    request.targetRelativePath,
    request.expectedContentHash
  )
  await vault.writeFile(request.relativePath, nextSource)

  try {
    await index.indexFile(request.relativePath)
  } catch (error) {
    await vault.writeFile(request.relativePath, source)
    await index.indexFile(request.relativePath)
    throw error
  }

  return {
    relativePath: request.relativePath,
    source: nextSource,
    contentHash: hashContent(nextSource)
  }
}

export async function planPropertyRename(
  vault: VaultService,
  index: VaultIndexRuntime,
  oldName: string,
  newName: string
): Promise<PropertyRenamePlan> {
  const affectedPaths = index.database.listNotePathsWithProperty(oldName)
  const affectedFiles: PropertyRenamePlan['affectedFiles'] = []

  for (const relativePath of affectedPaths) {
    const source = await vault.readFile(relativePath)
    const parsed = parseFrontmatterProperties(source)
    const oldNormalized = normalizeName(oldName)
    const newNormalized = normalizeName(newName)
    const oldProperty = parsed.properties.find(
      (property) => property.normalizedName === oldNormalized
    )
    const collision = parsed.properties.some(
      (property) =>
        property.normalizedName === newNormalized && property.normalizedName !== oldNormalized
    )

    affectedFiles.push({
      relativePath,
      contentHash: hashContent(source),
      collision,
      unsupportedReason:
        parsed.parseError ??
        (!oldProperty
          ? 'The indexed property no longer exists in the current source.'
          : oldProperty.keyRange.from === oldProperty.keyRange.to
            ? 'The property key has no safe source range.'
            : null)
    })
  }

  // Validate names even when the property is not currently used.
  if (affectedFiles.length === 0) {
    renamePropertyKey(`---\n${oldName}: value\n---\n`, oldName, newName)
  }

  return {
    oldName,
    newName,
    affectedFiles,
    canApply: affectedFiles.every((file) => !file.collision && file.unsupportedReason === null)
  }
}

export async function applyPropertyRename(
  vault: VaultService,
  index: VaultIndexRuntime,
  request: PropertyRenameApplyRequest
): Promise<PropertyRenameResult> {
  const freshPlan = await planPropertyRename(vault, index, request.oldName, request.newName)
  const expectedByPath = new Map(
    request.expectedFiles.map((file) => [normalizePath(file.relativePath), file.contentHash])
  )

  if (!freshPlan.canApply) {
    throw new Error('Property rename has collisions or unsupported frontmatter.')
  }

  if (
    freshPlan.affectedFiles.length !== expectedByPath.size ||
    freshPlan.affectedFiles.some(
      (file) => expectedByPath.get(normalizePath(file.relativePath)) !== file.contentHash
    )
  ) {
    throw new Error('The property rename plan is stale. Preview it again before applying.')
  }

  const snapshots = new Map<string, string>()
  const updates = new Map<string, string>()

  for (const file of freshPlan.affectedFiles) {
    const source = await vault.readFile(file.relativePath)
    if (hashContent(source) !== file.contentHash) {
      throw new Error(`The property rename plan is stale for ${file.relativePath}.`)
    }
    snapshots.set(file.relativePath, source)
    updates.set(
      file.relativePath,
      renamePropertyKey(source, request.oldName, request.newName).source
    )
  }

  const writtenPaths: string[] = []

  try {
    for (const [relativePath, source] of updates) {
      await vault.writeFile(relativePath, source)
      writtenPaths.push(relativePath)
    }
    for (const relativePath of updates.keys()) {
      await index.indexFile(relativePath, false)
    }
    index.notifyChanged()
  } catch (error) {
    const rollbackErrors: unknown[] = []

    for (const relativePath of writtenPaths) {
      const snapshot = snapshots.get(relativePath)
      if (snapshot === undefined) continue
      await vault.writeFile(relativePath, snapshot).catch((rollbackError: unknown) => {
        rollbackErrors.push(rollbackError)
      })
    }

    await index.rebuild().catch((rollbackError: unknown) => {
      rollbackErrors.push(rollbackError)
    })

    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Property rename failed and rollback could not fully restore the vault'
      )
    }
    throw error
  }

  return {
    updatedFiles: [...updates].map(([relativePath, source]) => ({
      relativePath,
      source,
      contentHash: hashContent(source)
    }))
  }
}

function normalizeName(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase()
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/')
}
