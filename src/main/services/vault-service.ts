import fg from 'fast-glob'
import { constants } from 'fs'
import { mkdir, open, readFile, realpath, rename, rm, rmdir, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'path'

import type { RenameResult } from '../../shared/rename'
import { applyRenameEdits, type RenamePlan } from './rename-plan'
import { safeJoin } from './safe-path'

export interface VaultFile {
  relativePath: string
  name: string
  directory: string
  extension: '.md' | '.mdx'
}

export interface VaultTreeFile {
  relativePath: string
  name: string
  directory: string
  extension: string
}

export interface VaultInfo {
  name: string
  files: VaultFile[]
  treeFiles: VaultTreeFile[]
}

export interface TrashEntry {
  /** Path relative to vault root, including the `.trash/` prefix. */
  relativePath: string
  /** Original relative path before the file was trashed, if recoverable. */
  originalPath: string
  name: string
  extension: '.md' | '.mdx'
  /** mtimeMs of the trashed file. */
  mtimeMs: number
}

export interface NoteTemplate {
  relativePath: string
  name: string
}

export type RenameTransactionResult = RenameResult

export interface RenameFileOptions {
  plan?: RenamePlan
  onApplied?: (result: RenameTransactionResult) => Promise<void>
  onRolledBack?: () => Promise<void>
}

type AtomicWriteOverride = (
  absolutePath: string,
  data: string | Uint8Array,
  writeDefault: () => Promise<void>
) => Promise<void>

interface VaultServiceOptions {
  atomicWrite?: AtomicWriteOverride
}

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx'])
const ASSET_DATA_EXTENSIONS = new Set(['.csv', '.json'])
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.csv',
  '.tsv',
  '.json',
  '.jsonc',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.html',
  '.css',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.py',
  '.sh',
  '.sql',
  '.log',
  '.ini'
])
const FILE_PATTERNS = ['**/*.md', '**/*.mdx']
const TREE_FILE_PATTERNS = ['**/*']
const TRASH_DIR = '.trash'
const IGNORED_DIRECTORIES = ['**/node_modules/**', '**/.git/**', '**/.app/**', '**/.trash/**']
const RESTRICTED_DIRECT_ACCESS_DIRECTORIES = new Set([TRASH_DIR, '.app', 'node_modules', '.git'])
const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024
const TEXT_BINARY_GUARD_BYTES = 8 * 1024

export class VaultService {
  private readonly root: string
  private readonly atomicWriteOverride?: AtomicWriteOverride
  private tempSequence = 0

  constructor(root: string, options: VaultServiceOptions = {}) {
    this.root = resolve(root)
    this.atomicWriteOverride = options.atomicWrite
  }

  get rootPath(): string {
    return this.root
  }

  async getInfo(): Promise<VaultInfo> {
    const [files, treeFiles] = await Promise.all([this.listFiles(), this.listTreeFiles()])

    return {
      name: basename(this.root),
      files,
      treeFiles
    }
  }

  async listFiles(): Promise<VaultFile[]> {
    const entries = await fg(FILE_PATTERNS, {
      cwd: this.root,
      dot: false,
      ignore: IGNORED_DIRECTORIES,
      onlyFiles: true,
      unique: true,
      followSymbolicLinks: false
    })

    return entries
      .map((relativePath) => toVaultFile(relativePath))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  }

  async listTreeFiles(): Promise<VaultTreeFile[]> {
    const entries = await fg(TREE_FILE_PATTERNS, {
      cwd: this.root,
      dot: true,
      ignore: IGNORED_DIRECTORIES,
      onlyFiles: true,
      unique: true,
      followSymbolicLinks: false
    })

    return entries
      .map((relativePath) => toVaultTreeFile(relativePath))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  }

  async readFile(relativePath: string): Promise<string> {
    const target = this.resolveMarkdownPath(relativePath)
    await assertFile(target)
    return readFile(target, 'utf8')
  }

  async readAssetFile(relativePath: string): Promise<string> {
    const normalizedPath = normalizeVaultPath(relativePath)
    const extension = extname(normalizedPath).toLowerCase()

    if (!ASSET_DATA_EXTENSIONS.has(extension) && !IMAGE_EXTENSIONS.has(extension)) {
      throw new Error('Unsupported asset file extension')
    }

    const target = safeJoin(this.root, normalizedPath)

    if (!isAssetPath(normalizedPath)) {
      throw new Error('Asset files must live under assets/')
    }

    await assertAssetFile(target)

    if (ASSET_DATA_EXTENSIONS.has(extension)) {
      return readFile(target, 'utf8')
    }

    return (await readFile(target)).toString('base64')
  }

  async readTextFile(relativePath: string): Promise<string> {
    const normalizedPath = normalizeDirectTextPath(relativePath)
    const target = await this.resolveExistingDirectFilePath(
      normalizedPath,
      TEXT_EXTENSIONS,
      'Unsupported text file extension'
    )
    const fileStats = await stat(target)

    if (!fileStats.isFile()) {
      throw new Error('Text path is not a file')
    }

    assertTextFileSize(fileStats.size)
    const data = await readFile(target)
    assertTextFileSize(data.byteLength)
    assertTextDataIsNotBinary(data)
    return data.toString('utf8')
  }

  async writeTextFile(relativePath: string, content: string): Promise<void> {
    const normalizedPath = normalizeDirectTextPath(relativePath)
    const target = await this.resolveExistingDirectFilePath(
      normalizedPath,
      TEXT_EXTENSIONS,
      'Unsupported text file extension'
    )
    const data = Buffer.from(content, 'utf8')
    assertTextFileSize(data.byteLength)
    assertTextDataIsNotBinary(data)
    await this.writeExistingFile(target, content)
  }

  async readImageFile(relativePath: string): Promise<string> {
    const target = await this.resolveExistingDirectFilePath(
      relativePath,
      IMAGE_EXTENSIONS,
      'Unsupported image file extension'
    )
    await assertFile(target)
    return (await readFile(target)).toString('base64')
  }

  /**
   * Verifies that an arbitrary tree file still exists and can be opened for
   * reading without returning its contents to the renderer. This is used to
   * reject stale unsupported-file entries before a workbench tab is committed.
   */
  async probeFile(relativePath: string): Promise<void> {
    const normalizedPath = normalizeVaultPath(relativePath)
    const extension = extname(normalizedPath).toLowerCase()
    const target = await this.resolveExistingDirectFilePath(
      normalizedPath,
      new Set([extension]),
      'Vault file extension changed while it was being opened'
    )
    const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW)

    try {
      const fileStats = await handle.stat()
      if (!fileStats.isFile()) {
        throw new Error('Vault path is not a file')
      }
    } finally {
      await handle.close()
    }
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const target = await this.resolveExistingDirectFilePath(
      relativePath,
      MARKDOWN_EXTENSIONS,
      'Only .md and .mdx files are allowed'
    )
    await this.writeExistingFile(target, content)
  }

  async writeFileIfUnchanged(
    relativePath: string,
    expectedContent: string,
    content: string
  ): Promise<void> {
    const target = await this.resolveExistingDirectFilePath(
      relativePath,
      MARKDOWN_EXTENSIONS,
      'Only .md and .mdx files are allowed'
    )
    await this.writeExistingFileIfContentMatches(target, expectedContent, content)
  }

  /**
   * Create a new note file. Refuses to overwrite an existing file — callers
   * should check `exists()` first or pass a unique path. Resolves to the
   * canonical (normalized) relative path so the renderer can open it.
   */
  async createFile(relativePath: string, content: string): Promise<string> {
    const normalizedPath = normalizeVaultPath(relativePath)
    const extension = extname(normalizedPath).toLowerCase()

    if (!MARKDOWN_EXTENSIONS.has(extension)) {
      throw new Error('Only .md and .mdx files are allowed')
    }

    const target = safeJoin(this.root, normalizedPath)

    if (await pathExists(target)) {
      throw new Error('A file with this name already exists')
    }

    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, 'utf8')

    return normalizedPath
  }

  /** Check whether a relative markdown path already exists on disk. */
  async exists(relativePath: string): Promise<boolean> {
    try {
      const target = this.resolveMarkdownPath(relativePath)
      await stat(target)
      return true
    } catch {
      return false
    }
  }

  /**
   * Soft-delete a note: move it into `<vault>/.trash/`. The trashed file keeps
   * a mangled name (timestamp suffix) so deleting `Foo.mdx` twice doesn't
   * clobber the previous trash entry. Recoverable by hand via the file
   * manager, never a hard delete.
   *
   * Returns the trash-relative path that was written.
   */
  async deleteFile(relativePath: string): Promise<string> {
    const normalizedPath = normalizeVaultPath(relativePath)
    this.assertMarkdownExtension(normalizedPath)
    this.assertNotInTrash(normalizedPath)

    const source = safeJoin(this.root, normalizedPath)
    await assertFile(source)

    const trashRoot = safeJoin(this.root, TRASH_DIR)
    await mkdir(trashRoot, { recursive: true })

    const targetName = buildTrashFileName(normalizedPath, Date.now())
    const target = safeJoin(trashRoot, targetName)
    await mkdir(dirname(target), { recursive: true })

    await rename(source, target)
    return `${TRASH_DIR}/${targetName}`
  }

  /**
   * Atomically rename/move a note to a new relative path. Parent directories
   * are created as needed. Refuses to overwrite an existing file — callers
   * should check {@link exists} first. The atomic `rename` is what makes this
   * crash-safe: either the move happens or it doesn't.
   */
  async renameFile(oldRelativePath: string, newRelativePath: string): Promise<string>
  async renameFile(
    oldRelativePath: string,
    newRelativePath: string,
    options: RenameFileOptions
  ): Promise<RenameTransactionResult>
  async renameFile(
    oldRelativePath: string,
    newRelativePath: string,
    options?: RenameFileOptions
  ): Promise<string | RenameTransactionResult> {
    const { oldRelativePath: normalizedOld, newRelativePath: normalizedNew } =
      await this.validateRename(oldRelativePath, newRelativePath)
    const source = safeJoin(this.root, normalizedOld)
    const target = safeJoin(this.root, normalizedNew)

    if (!options) {
      await mkdir(dirname(target), { recursive: true })
      await rename(source, target)
      return normalizedNew
    }

    const plan = options.plan ?? createEmptyRenamePlan(normalizedOld, normalizedNew)
    this.validateRenamePlan(plan, normalizedOld, normalizedNew)

    const snapshots = new Map<string, Uint8Array>()
    const rewrites = new Map<string, string>()

    for (const plannedFile of plan.files) {
      const relativePath = normalizeVaultPath(plannedFile.relativePath)
      const absolutePath = this.resolveMarkdownPath(relativePath)
      await assertFile(absolutePath)

      if (snapshots.has(relativePath)) {
        throw new Error(`Rename plan contains duplicate file: ${relativePath}`)
      }

      const snapshot = await readFile(absolutePath)
      snapshots.set(relativePath, snapshot)
      rewrites.set(relativePath, applyRenameEdits(snapshot.toString('utf8'), plannedFile.edits))
    }

    const createdParentDirectories = await findMissingParentDirectories(this.root, dirname(target))
    let renameCompleted = false

    try {
      for (const [relativePath, rewrittenContent] of rewrites) {
        await this.writeFileAtomic(this.resolveMarkdownPath(relativePath), rewrittenContent)
      }

      await mkdir(dirname(target), { recursive: true })
      await rename(source, target)
      renameCompleted = true

      const result: RenameTransactionResult = {
        newRelativePath: normalizedNew,
        rewrittenFiles: [...rewrites.keys()],
        updatedLinks: plan.linkCount
      }

      await options.onApplied?.(result)
      return result
    } catch (error) {
      const rollbackErrors: unknown[] = []

      if (renameCompleted) {
        await rename(target, source).catch((rollbackError: unknown) => {
          rollbackErrors.push(rollbackError)
        })
      }

      for (const [relativePath, snapshot] of snapshots) {
        await this.writeFileAtomic(this.resolveMarkdownPath(relativePath), snapshot).catch(
          (rollbackError: unknown) => {
            rollbackErrors.push(rollbackError)
          }
        )
      }

      await options.onRolledBack?.().catch((rollbackError: unknown) => {
        rollbackErrors.push(rollbackError)
      })

      await removeCreatedParentDirectories(createdParentDirectories, rollbackErrors)

      if (rollbackErrors.length > 0) {
        throw new AggregateError(
          [error, ...rollbackErrors],
          'Rename failed and rollback could not restore the vault completely'
        )
      }

      throw error
    }
  }

  async validateRename(
    oldRelativePath: string,
    newRelativePath: string
  ): Promise<{ oldRelativePath: string; newRelativePath: string }> {
    const normalizedOld = normalizeVaultPath(oldRelativePath)
    const normalizedNew = normalizeVaultPath(newRelativePath)

    this.assertMarkdownExtension(normalizedOld)
    this.assertMarkdownExtension(normalizedNew)
    this.assertNotInTrash(normalizedOld)
    this.assertNotInTrash(normalizedNew)

    const source = safeJoin(this.root, normalizedOld)
    const target = safeJoin(this.root, normalizedNew)

    await assertFile(source)

    if (await pathExists(target)) {
      throw new Error('A file with this name already exists')
    }

    return {
      oldRelativePath: normalizedOld,
      newRelativePath: normalizedNew
    }
  }

  /**
   * Duplicate a note: copy `Foo.mdx` to `Foo copy.mdx` (or `Foo copy 2.mdx`,
   * etc., if that already exists). Returns the new relative path. The copy is
   * written atomically via a tmp file + rename.
   */
  async duplicateFile(relativePath: string): Promise<string> {
    const normalizedPath = normalizeVaultPath(relativePath)
    this.assertMarkdownExtension(normalizedPath)
    this.assertNotInTrash(normalizedPath)

    const source = safeJoin(this.root, normalizedPath)
    const content = await readFile(source, 'utf8')

    const targetPath = await this.findUniqueDuplicatePath(normalizedPath)
    await this.writeFile(targetPath, content)
    return targetPath
  }

  /**
   * Permanently remove everything in `<vault>/.trash/`. Used by the "Empty
   * trash" command. The `.trash/` directory itself is preserved.
   */
  async emptyTrash(): Promise<void> {
    const trashRoot = safeJoin(this.root, TRASH_DIR)

    if (!(await pathExists(trashRoot))) {
      return
    }

    // rm with `force: true` won't throw if entries vanish between stat and
    // delete (e.g. user removing files via the OS file manager concurrently).
    await rm(trashRoot, { recursive: true, force: true })
    await mkdir(trashRoot, { recursive: true })
  }

  /** List the current contents of `<vault>/.trash/`. */
  async listTrash(): Promise<TrashEntry[]> {
    const trashRoot = safeJoin(this.root, TRASH_DIR)

    if (!(await pathExists(trashRoot))) {
      return []
    }

    const entries = await fg(['**/*.md', '**/*.mdx'], {
      cwd: trashRoot,
      dot: false,
      ignore: IGNORED_DIRECTORIES,
      onlyFiles: true,
      unique: true,
      followSymbolicLinks: false
    })

    const result: TrashEntry[] = []

    for (const entry of entries) {
      const normalizedEntry = normalizeVaultPath(entry)
      const absolutePath = safeJoin(trashRoot, normalizedEntry)
      const fileStats = await stat(absolutePath).catch(() => null)

      if (!fileStats?.isFile()) {
        continue
      }

      const name = basename(normalizedEntry)
      const extension = extname(name).toLowerCase()

      if (extension !== '.md' && extension !== '.mdx') {
        continue
      }

      result.push({
        relativePath: `${TRASH_DIR}/${normalizedEntry}`,
        originalPath: parseOriginalPathFromTrashName(normalizedEntry),
        name,
        extension: extension as '.md' | '.mdx',
        mtimeMs: fileStats.mtimeMs
      })
    }

    return result.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  }

  async listTemplates(): Promise<NoteTemplate[]> {
    const entries = await fg(['templates/*.mdx'], {
      cwd: this.root,
      dot: false,
      ignore: IGNORED_DIRECTORIES,
      onlyFiles: true,
      unique: true,
      followSymbolicLinks: false
    })

    return entries
      .map((entry) => {
        const relativePath = normalizeVaultPath(entry)
        return {
          relativePath,
          name: basename(relativePath, extname(relativePath))
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  async renderTemplate(relativePath: string, title: string): Promise<string> {
    const normalizedPath = normalizeVaultPath(relativePath)

    if (
      dirname(normalizedPath) !== 'templates' ||
      extname(normalizedPath).toLowerCase() !== '.mdx'
    ) {
      throw new Error('Templates must be .mdx files under templates/')
    }

    const target = safeJoin(this.root, normalizedPath)
    await assertFile(target)

    return renderTemplateVariables(await readFile(target, 'utf8'), title, new Date())
  }

  /** Resolve a relative path to its absolute form inside the vault. Used by
   * `shell.showItemInFolder` and any caller that needs the on-disk path. */
  resolveAbsolutePath(relativePath: string): string {
    const normalizedPath = normalizeVaultPath(relativePath)
    return safeJoin(this.root, normalizedPath)
  }

  /**
   * Persist a binary asset (image) under `<vault>/assets/`. The filename is
   * sanitized, restricted to an image-extension allowlist, and uniquified if
   * a file with the same name already exists. Returns the vault-relative path
   * (e.g. `assets/screenshot-1.png`) so the renderer can insert a markdown
   * reference like `![](assets/screenshot-1.png)`.
   */
  async saveAsset(suggestedName: string, data: Uint8Array): Promise<string> {
    const sanitized = sanitizeAssetName(suggestedName)
    const uniqueName = await this.findUniqueAssetName(sanitized)
    const relativePath = `assets/${uniqueName}`
    const target = safeJoin(this.root, relativePath)

    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, data)
    return relativePath
  }

  private async findUniqueDuplicatePath(relativePath: string): Promise<string> {
    const directory = dirname(relativePath)
    const extension = extname(relativePath)
    const stem = basename(relativePath, extension)
    const prefix = directory && directory !== '.' ? `${directory}/` : ''

    let candidate = `${prefix}${stem} copy${extension}`
    let counter = 2

    while (await pathExists(safeJoin(this.root, candidate))) {
      candidate = `${prefix}${stem} copy ${counter}${extension}`
      counter += 1
    }

    return candidate
  }

  private async findUniqueAssetName(sanitizedName: string): Promise<string> {
    const extension = extname(sanitizedName)
    const stem = basename(sanitizedName, extension)
    let candidate = sanitizedName
    let counter = 1

    while (await pathExists(safeJoin(this.root, `assets/${candidate}`))) {
      candidate = `${stem}-${counter}${extension}`
      counter += 1
    }

    return candidate
  }

  private assertMarkdownExtension(relativePath: string): void {
    const extension = extname(relativePath).toLowerCase()

    if (!MARKDOWN_EXTENSIONS.has(extension)) {
      throw new Error('Only .md and .mdx files are allowed')
    }
  }

  private assertNotInTrash(relativePath: string): void {
    if (relativePath === TRASH_DIR || relativePath.startsWith(`${TRASH_DIR}/`)) {
      throw new Error('Cannot modify files inside .trash/ directly')
    }
  }

  private resolveMarkdownPath(relativePath: string): string {
    const normalizedPath = normalizeVaultPath(relativePath)
    const extension = extname(normalizedPath).toLowerCase()

    if (!MARKDOWN_EXTENSIONS.has(extension)) {
      throw new Error('Only .md and .mdx files are allowed')
    }

    return safeJoin(this.root, normalizedPath)
  }

  private resolveDirectFilePath(
    relativePath: string,
    allowedExtensions: ReadonlySet<string>,
    unsupportedExtensionMessage: string
  ): string {
    const normalizedPath = normalizeVaultPath(relativePath)
    const extension = extname(normalizedPath).toLowerCase()

    if (!allowedExtensions.has(extension)) {
      throw new Error(unsupportedExtensionMessage)
    }

    const target = safeJoin(this.root, normalizedPath)
    assertDirectFileAccessAllowed(normalizedPath)
    return target
  }

  private async resolveExistingDirectFilePath(
    relativePath: string,
    allowedExtensions: ReadonlySet<string>,
    unsupportedExtensionMessage: string
  ): Promise<string> {
    const target = this.resolveDirectFilePath(
      relativePath,
      allowedExtensions,
      unsupportedExtensionMessage
    )

    let resolvedRoot: string
    let resolvedTarget: string

    try {
      ;[resolvedRoot, resolvedTarget] = await Promise.all([realpath(this.root), realpath(target)])
    } catch {
      throw new Error('Vault file path could not be resolved safely')
    }

    const pathFromRoot = relative(resolvedRoot, resolvedTarget)
    const normalizedResolvedPath = pathFromRoot.replaceAll('\\', '/')

    if (
      normalizedResolvedPath === '..' ||
      normalizedResolvedPath.startsWith('../') ||
      isAbsolute(pathFromRoot)
    ) {
      throw new Error('Vault file path resolves outside the vault root')
    }

    if (!allowedExtensions.has(extname(normalizedResolvedPath).toLowerCase())) {
      throw new Error(unsupportedExtensionMessage)
    }

    assertDirectFileAccessAllowed(normalizedResolvedPath)
    await assertFile(resolvedTarget)
    return resolvedTarget
  }

  private validateRenamePlan(
    plan: RenamePlan,
    oldRelativePath: string,
    newRelativePath: string
  ): void {
    if (
      normalizeVaultPath(plan.oldRelativePath) !== oldRelativePath ||
      normalizeVaultPath(plan.newRelativePath) !== newRelativePath
    ) {
      throw new Error('Rename plan does not match the requested paths')
    }
  }

  private async writeFileAtomic(target: string, data: string | Uint8Array): Promise<void> {
    const sequence = this.tempSequence + 1
    this.tempSequence = sequence
    const tempPath = `${target}.tmp-${process.pid}-${Date.now()}-${sequence}`
    const writeDefault = async (): Promise<void> => {
      await mkdir(dirname(target), { recursive: true })

      try {
        if (typeof data === 'string') {
          await writeFile(tempPath, data, 'utf8')
        } else {
          await writeFile(tempPath, data)
        }

        await rename(tempPath, target)
      } finally {
        await rm(tempPath, { force: true })
      }
    }

    if (this.atomicWriteOverride) {
      await this.atomicWriteOverride(target, data, writeDefault)
      return
    }

    await writeDefault()
  }

  /**
   * Writes through a handle that can only be opened when the target still
   * exists. If another process removes the path after validation, this updates
   * the already-open inode/handle and never renames a new file back into place.
   */
  private async writeExistingFile(target: string, data: string | Uint8Array): Promise<void> {
    const writeDefault = async (): Promise<void> => {
      const handle = await open(target, constants.O_RDWR | constants.O_NOFOLLOW)

      try {
        const openedStats = await handle.stat()
        if (!openedStats.isFile()) {
          throw new Error('Vault path is not a file')
        }

        await handle.truncate(0)
        if (typeof data === 'string') {
          await handle.writeFile(data, 'utf8')
        } else {
          await handle.writeFile(data)
        }
        await handle.sync()

        const [handleStats, pathStats] = await Promise.all([handle.stat(), stat(target)])
        if (handleStats.dev !== pathStats.dev || handleStats.ino !== pathStats.ino) {
          throw new Error('Vault file changed while it was being saved')
        }
      } finally {
        await handle.close()
      }
    }

    if (this.atomicWriteOverride) {
      await this.atomicWriteOverride(target, data, writeDefault)
      return
    }

    await writeDefault()
  }

  private async writeExistingFileIfContentMatches(
    target: string,
    expectedContent: string,
    content: string
  ): Promise<void> {
    const writeDefault = async (): Promise<void> => {
      const handle = await open(target, constants.O_RDWR | constants.O_NOFOLLOW)

      try {
        const openedStats = await handle.stat()
        if (!openedStats.isFile()) {
          throw new Error('Vault path is not a file')
        }

        const currentContent = await handle.readFile('utf8')
        if (currentContent !== expectedContent) {
          throw new Error('Vault file changed since the expected revision')
        }

        const data = Buffer.from(content, 'utf8')
        await handle.truncate(0)
        let written = 0
        while (written < data.byteLength) {
          const result = await handle.write(data, written, data.byteLength - written, written)
          written += result.bytesWritten
        }
        await handle.sync()

        const [handleStats, pathStats] = await Promise.all([handle.stat(), stat(target)])
        if (handleStats.dev !== pathStats.dev || handleStats.ino !== pathStats.ino) {
          throw new Error('Vault file changed while it was being saved')
        }
      } finally {
        await handle.close()
      }
    }

    if (this.atomicWriteOverride) {
      await this.atomicWriteOverride(target, content, writeDefault)
      return
    }

    await writeDefault()
  }
}

function normalizeDirectTextPath(relativePath: string): string {
  const normalizedPath = normalizeVaultPath(relativePath)
  if (
    extname(normalizedPath).toLowerCase() === '.md' &&
    !/^interactives\/[^/]+\/README\.md$/i.test(normalizedPath)
  ) {
    throw new Error('Markdown text access is limited to interactive README files')
  }
  return normalizedPath
}

function toVaultFile(relativePath: string): VaultFile {
  const normalizedPath = normalizeVaultPath(relativePath)
  const segments = normalizedPath.split('/')
  const name = segments.at(-1) ?? normalizedPath
  const directory = segments.slice(0, -1).join('/')
  const extension = extname(name).toLowerCase()

  if (extension !== '.md' && extension !== '.mdx') {
    throw new Error(`Unsupported vault file extension: ${extension}`)
  }

  return {
    relativePath: normalizedPath,
    name,
    directory,
    extension
  }
}

function toVaultTreeFile(relativePath: string): VaultTreeFile {
  const normalizedPath = normalizeVaultPath(relativePath)
  const segments = normalizedPath.split('/')
  const name = segments.at(-1) ?? normalizedPath

  return {
    relativePath: normalizedPath,
    name,
    directory: segments.slice(0, -1).join('/'),
    extension: extname(name).toLowerCase()
  }
}

function normalizeVaultPath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/')
}

function assertDirectFileAccessAllowed(relativePath: string): void {
  const restrictedDirectory = relativePath
    .split('/')
    .map((segment) => segment.toLowerCase())
    .find((segment) => RESTRICTED_DIRECT_ACCESS_DIRECTORIES.has(segment))

  if (restrictedDirectory) {
    throw new Error(`Cannot access files inside ${restrictedDirectory}/`)
  }
}

function assertTextFileSize(size: number): void {
  if (size > MAX_TEXT_FILE_BYTES) {
    throw new Error('Text file exceeds the 5 MiB size limit')
  }
}

function assertTextDataIsNotBinary(data: Uint8Array): void {
  if (data.subarray(0, TEXT_BINARY_GUARD_BYTES).includes(0)) {
    throw new Error('Text file appears to be binary (NUL byte detected)')
  }
}

function createEmptyRenamePlan(oldRelativePath: string, newRelativePath: string): RenamePlan {
  return {
    oldRelativePath,
    newRelativePath,
    files: [],
    linkCount: 0,
    noteCount: 0
  }
}

async function findMissingParentDirectories(
  root: string,
  targetDirectory: string
): Promise<string[]> {
  const directories: string[] = []
  let current = targetDirectory

  while (current !== root && !(await pathExists(current))) {
    directories.push(current)
    const parent = dirname(current)

    if (parent === current) {
      break
    }

    current = parent
  }

  return directories
}

async function removeCreatedParentDirectories(
  directories: string[],
  rollbackErrors: unknown[]
): Promise<void> {
  for (const directory of directories) {
    try {
      await rmdir(directory)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code

      if (code !== 'ENOENT' && code !== 'ENOTEMPTY') {
        rollbackErrors.push(error)
      }
    }
  }
}

function isAssetPath(relativePath: string): boolean {
  return relativePath === 'assets' || relativePath.startsWith('assets/')
}

async function assertFile(target: string): Promise<void> {
  const fileStats = await stat(target)

  if (!fileStats.isFile()) {
    throw new Error('Path is not a file')
  }
}

async function assertAssetFile(target: string): Promise<void> {
  let fileStats: Awaited<ReturnType<typeof stat>>

  try {
    fileStats = await stat(target)
  } catch {
    throw new Error('Asset file not found')
  }

  if (!fileStats.isFile()) {
    throw new Error('Asset path is not a file')
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

/**
 * Build the trash-relative filename for a deleted vault entry.
 *
 * Format: `<directory>/<stem>.<timestamp>.<ext>` — preserves the original
 * folder structure inside `.trash/` so a deleted `notes/Foo.mdx` lands at
 * `.trash/notes/Foo.1719900000000.mdx` instead of clobbering a prior delete.
 * The timestamp makes repeated deletes of the same name safe.
 */
function buildTrashFileName(relativePath: string, timestampMs: number): string {
  const extension = extname(relativePath)
  const stem = basename(relativePath, extension)
  const directory = dirname(relativePath)
  const mangled = `${stem}.${timestampMs}${extension}`

  return directory && directory !== '.' ? `${directory}/${mangled}` : mangled
}

/**
 * Best-effort parse of the original relative path from a trash entry name.
 * Strips the `.<timestamp>` segment that {@link buildTrashFileName} inserted
 * before the extension. If the format doesn't match, returns the raw entry.
 */
function parseOriginalPathFromTrashName(trashRelativePath: string): string {
  const directory = dirname(trashRelativePath)
  const extension = extname(trashRelativePath)
  const name = basename(trashRelativePath, extension)

  // Strip the trailing `.<digits>` timestamp if present.
  const stripped = name.replace(/\.\d+$/, '')

  const prefix = directory && directory !== '.' ? `${directory}/` : ''
  return `${prefix}${stripped}${extension}`
}

function renderTemplateVariables(content: string, title: string, now: Date): string {
  const variables: Record<string, string> = {
    date: formatLocalDate(now),
    time: formatLocalTime(now),
    title
  }

  return content.replace(
    /\{\{\s*(date|time|title)(?::([^}]+))?\s*\}\}/g,
    (_match, key: string, format: string | undefined) => {
      if (!format) {
        return variables[key] ?? ''
      }

      if (key === 'title') {
        throw new Error('{{title}} does not support a format suffix')
      }

      return formatTemplateDateTime(now, format.trim())
    }
  )
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatTemplateDateTime(date: Date, format: string): string {
  if (!format) {
    throw new Error('Template date/time format cannot be empty')
  }

  if (format.length > 48) {
    throw new Error('Template date/time format is too long')
  }

  const values: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'),
    HH: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0')
  }

  let output = ''
  let index = 0

  while (index < format.length) {
    const token = ['YYYY', 'MM', 'DD', 'HH', 'mm'].find((candidate) =>
      format.startsWith(candidate, index)
    )

    if (token) {
      output += values[token]
      index += token.length
      continue
    }

    const character = format[index]

    if (/[A-Za-z]/u.test(character)) {
      throw new Error(`Unsupported template date/time token near "${format.slice(index)}"`)
    }

    output += character
    index += 1
  }

  return output
}

const ILLEGAL_ASSET_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])

/**
 * Sanitize a caller-suggested asset filename:
 *   - basename only (strip any path components)
 *   - lowercase extension must be in the image allowlist
 *   - drop illegal cross-OS filename chars
 *   - fall back to `image-<timestamp>.<ext>` if everything got stripped
 */
function sanitizeAssetName(rawName: string): string {
  const base = basename(rawName.replaceAll('\\', '/')).trim()
  const dotIndex = base.lastIndexOf('.')
  const stemRaw = dotIndex > 0 ? base.slice(0, dotIndex) : base
  const extRaw = dotIndex > 0 ? base.slice(dotIndex).toLowerCase() : ''

  if (!IMAGE_EXTENSIONS.has(extRaw)) {
    throw new Error(`Unsupported asset extension: ${extRaw || '(none)'}`)
  }

  let stem = stemRaw
    .split('')
    .filter((char) => !ILLEGAL_ASSET_CHARS.has(char) && char.charCodeAt(0) > 0x1f)
    .join('')
    .trim()
    .replace(/\s+/g, '-')

  if (!stem) {
    stem = `image-${Date.now()}`
  }

  return `${stem}${extRaw}`
}
