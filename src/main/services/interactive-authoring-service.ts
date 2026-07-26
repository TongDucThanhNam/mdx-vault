import { createHash, randomUUID } from 'crypto'
import { lstat, mkdir, readdir, rename, rm, rmdir, writeFile } from 'fs/promises'

import {
  createInteractiveStarter,
  type InteractiveCreatePayload,
  type InteractiveCreateResult,
  interactiveCreatePayloadSchema,
  planInteractiveNoteInsertion
} from '../../shared/interactive-authoring'
import { safeJoin } from './safe-path'
import type { SandboxDraftCompileResult } from './sandbox-service'
import { SandboxService } from './sandbox-service'
import type { VaultService } from './vault-service'

export type InteractiveCommitStage = 'component' | 'manifest' | 'readme' | 'note' | 'finalize'

interface InteractiveAuthoringServiceOptions {
  validateDraft?: (
    componentSource: string,
    manifest: Parameters<SandboxService['compileDraft']>[1]
  ) => Promise<SandboxDraftCompileResult>
  onCommitStage?: (stage: InteractiveCommitStage) => Promise<void> | void
  finalize?: (result: InteractiveCreateResult) => Promise<void> | void
}

export class InteractiveAuthoringError extends Error {
  constructor(
    readonly code:
      | 'INVALID_REQUEST'
      | 'STALE_NOTE'
      | 'DESTINATION_EXISTS'
      | 'UNSAFE_PATH'
      | 'VALIDATION_FAILED'
      | 'TRANSACTION_FAILED'
      | 'ROLLBACK_FAILED',
    message: string
  ) {
    super(message)
    this.name = 'InteractiveAuthoringError'
  }
}

const creationQueues = new Map<string, Promise<void>>()

export class InteractiveAuthoringService {
  private readonly validateDraft: NonNullable<InteractiveAuthoringServiceOptions['validateDraft']>

  constructor(
    private readonly vault: VaultService,
    private readonly options: InteractiveAuthoringServiceOptions = {}
  ) {
    this.validateDraft =
      options.validateDraft ??
      ((componentSource, manifest) =>
        new SandboxService(this.vault).compileDraft(componentSource, manifest))
  }

  async create(payload: InteractiveCreatePayload): Promise<InteractiveCreateResult> {
    let input: InteractiveCreatePayload
    try {
      input = interactiveCreatePayloadSchema.parse(payload)
    } catch (error) {
      throw new InteractiveAuthoringError(
        'INVALID_REQUEST',
        error instanceof Error ? error.message : 'Interactive create request is invalid'
      )
    }

    return runSerialized(this.vault.rootPath, () => this.createSerialized(input))
  }

  private async createSerialized(
    input: InteractiveCreatePayload
  ): Promise<InteractiveCreateResult> {
    const projectRoot = `interactives/${input.slug}`
    const componentRelativePath = `${projectRoot}/component.tsx`
    const projectPath = safeJoin(this.vault.rootPath, projectRoot)
    const interactivesPath = safeJoin(this.vault.rootPath, 'interactives')
    const temporaryRoot = safeJoin(
      this.vault.rootPath,
      `interactives/.tmp-${input.slug}-${randomUUID()}`
    )
    let createdInteractivesRoot = false
    let temporaryCreated = false
    let projectCommitted = false
    let noteWriteAttempted = false
    let noteCommitted = false
    let originalNote = ''
    let plannedNote = ''

    try {
      await assertNoSymbolicLinkSegments(this.vault.rootPath, input.noteRelativePath, true)
      originalNote = await this.vault.readFile(input.noteRelativePath)
      if (sha256(originalNote) !== input.expectedContentHash) {
        throw new InteractiveAuthoringError(
          'STALE_NOTE',
          'The note changed after the create action was invoked'
        )
      }

      await assertDestinationAvailable(interactivesPath, input.slug)
      const insertion = planInteractiveNoteInsertion({
        noteRelativePath: input.noteRelativePath,
        noteContent: originalNote,
        insertionOffset: input.insertionOffset,
        projectRoot
      })
      plannedNote = insertion.content
      const starter = createInteractiveStarter(input)
      const manifest = JSON.parse(starter.manifest)
      const validation = await this.validateDraft(starter.component, manifest)
      if (!validation.ok) {
        throw new InteractiveAuthoringError(
          'VALIDATION_FAILED',
          `Starter validation failed: ${validation.errors.join('; ')}`
        )
      }

      const currentNote = await this.vault.readFile(input.noteRelativePath)
      if (currentNote !== originalNote || sha256(currentNote) !== input.expectedContentHash) {
        throw new InteractiveAuthoringError(
          'STALE_NOTE',
          'The note changed while the starter was being validated'
        )
      }

      if (!(await pathExists(interactivesPath))) {
        await mkdir(interactivesPath)
        createdInteractivesRoot = true
      }
      await assertNoSymbolicLinkSegments(this.vault.rootPath, 'interactives', true)
      await assertDestinationAvailable(interactivesPath, input.slug)
      await mkdir(temporaryRoot)
      temporaryCreated = true

      await this.options.onCommitStage?.('component')
      await writeFile(safeJoin(temporaryRoot, 'component.tsx'), starter.component, {
        encoding: 'utf8',
        flag: 'wx'
      })
      await this.options.onCommitStage?.('manifest')
      await writeFile(safeJoin(temporaryRoot, 'manifest.json'), starter.manifest, {
        encoding: 'utf8',
        flag: 'wx'
      })
      await this.options.onCommitStage?.('readme')
      await writeFile(safeJoin(temporaryRoot, 'README.md'), starter.readme, {
        encoding: 'utf8',
        flag: 'wx'
      })

      await assertDestinationAvailable(interactivesPath, input.slug)
      await rename(temporaryRoot, projectPath)
      temporaryCreated = false
      projectCommitted = true

      await this.options.onCommitStage?.('note')
      noteWriteAttempted = true
      await this.vault.writeFileIfUnchanged(input.noteRelativePath, originalNote, plannedNote)
      noteCommitted = true

      const result: InteractiveCreateResult = {
        noteRelativePath: input.noteRelativePath,
        noteContent: plannedNote,
        projectRoot,
        componentRelativePath,
        insertedSource: insertion.src,
        contentHash: validation.contentHash
      }

      await this.options.onCommitStage?.('finalize')
      await this.options.finalize?.(result)
      return result
    } catch (error) {
      const rollbackErrors: string[] = []

      if (noteWriteAttempted) {
        try {
          const currentNote = await this.vault.readFile(input.noteRelativePath)
          if (currentNote !== originalNote) {
            await this.vault.writeFileIfUnchanged(input.noteRelativePath, currentNote, originalNote)
          }
        } catch (rollbackError) {
          rollbackErrors.push(formatError(rollbackError))
        }
      }

      if (temporaryCreated) {
        await rm(temporaryRoot, { recursive: true, force: true }).catch((rollbackError) => {
          rollbackErrors.push(formatError(rollbackError))
        })
      }
      if (projectCommitted) {
        await rm(projectPath, { recursive: true, force: true }).catch((rollbackError) => {
          rollbackErrors.push(formatError(rollbackError))
        })
      }
      if (createdInteractivesRoot) {
        await rmdir(interactivesPath).catch((rollbackError) => {
          if (!isDirectoryNotEmptyError(rollbackError)) {
            rollbackErrors.push(formatError(rollbackError))
          }
        })
      }

      if (rollbackErrors.length > 0) {
        throw new InteractiveAuthoringError(
          'ROLLBACK_FAILED',
          `${formatError(error)}; rollback failed: ${rollbackErrors.join('; ')}`
        )
      }
      if (error instanceof InteractiveAuthoringError) {
        throw error
      }
      if (
        noteCommitted ||
        noteWriteAttempted ||
        projectCommitted ||
        temporaryCreated ||
        createdInteractivesRoot
      ) {
        throw new InteractiveAuthoringError('TRANSACTION_FAILED', formatError(error))
      }
      throw error
    }
  }
}

async function assertDestinationAvailable(interactivesPath: string, slug: string): Promise<void> {
  if (!(await pathExists(interactivesPath))) {
    return
  }

  const stats = await lstat(interactivesPath)
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new InteractiveAuthoringError(
      'UNSAFE_PATH',
      'The interactives destination is not a safe directory'
    )
  }

  const entries = await readdir(interactivesPath)
  if (entries.some((entry) => entry.toLocaleLowerCase() === slug.toLocaleLowerCase())) {
    throw new InteractiveAuthoringError(
      'DESTINATION_EXISTS',
      `Interactive destination already exists: interactives/${slug}`
    )
  }
}

async function assertNoSymbolicLinkSegments(
  root: string,
  relativePath: string,
  requireCompletePath: boolean
): Promise<void> {
  const segments = relativePath.replaceAll('\\', '/').split('/')
  let current = root

  for (const [index, segment] of segments.entries()) {
    current = safeJoin(current, segment)
    try {
      const stats = await lstat(current)
      if (stats.isSymbolicLink()) {
        throw new InteractiveAuthoringError(
          'UNSAFE_PATH',
          `Symbolic links are not allowed in interactive authoring paths: ${relativePath}`
        )
      }
      if (index < segments.length - 1 && !stats.isDirectory()) {
        throw new InteractiveAuthoringError(
          'UNSAFE_PATH',
          `Interactive authoring path has a non-directory ancestor: ${relativePath}`
        )
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        if (requireCompletePath) {
          throw new InteractiveAuthoringError(
            'UNSAFE_PATH',
            `Interactive authoring path does not exist: ${relativePath}`
          )
        }
        return
      }
      throw error
    }
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (isNotFoundError(error)) {
      return false
    }
    throw error
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  )
}

function isDirectoryNotEmptyError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOTEMPTY'
  )
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function runSerialized<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = creationQueues.get(key) ?? Promise.resolve()
  let release = (): void => {}
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const queued = previous.then(() => current)
  creationQueues.set(key, queued)

  await previous
  try {
    return await operation()
  } finally {
    release()
    if (creationQueues.get(key) === queued) {
      creationQueues.delete(key)
    }
  }
}
