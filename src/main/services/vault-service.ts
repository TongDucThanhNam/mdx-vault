import { mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, resolve } from 'path'
import fg from 'fast-glob'

import { safeJoin } from './safe-path'

export interface VaultFile {
  relativePath: string
  name: string
  directory: string
  extension: '.md' | '.mdx'
}

export interface VaultInfo {
  name: string
  files: VaultFile[]
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

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx'])
const ASSET_DATA_EXTENSIONS = new Set(['.csv', '.json'])
const FILE_PATTERNS = ['**/*.md', '**/*.mdx']
const TRASH_DIR = '.trash'
const IGNORED_DIRECTORIES = ['**/node_modules/**', '**/.git/**', '**/.app/**', '**/.trash/**']

export class VaultService {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  get rootPath(): string {
    return this.root
  }

  async getInfo(): Promise<VaultInfo> {
    return {
      name: basename(this.root),
      files: await this.listFiles()
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

  async readFile(relativePath: string): Promise<string> {
    const target = this.resolveMarkdownPath(relativePath)
    await assertFile(target)
    return readFile(target, 'utf8')
  }

  async readAssetFile(relativePath: string): Promise<string> {
    const normalizedPath = normalizeVaultPath(relativePath)
    const extension = extname(normalizedPath).toLowerCase()

    if (!ASSET_DATA_EXTENSIONS.has(extension)) {
      throw new Error('Only .csv and .json asset files are allowed')
    }

    const target = safeJoin(this.root, normalizedPath)

    if (!isAssetPath(normalizedPath)) {
      throw new Error('Dataset files must live under assets/')
    }

    await assertDatasetFile(target)
    return readFile(target, 'utf8')
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const target = this.resolveMarkdownPath(relativePath)
    const tempPath = `${target}.tmp-${process.pid}-${Date.now()}`

    await mkdir(dirname(target), { recursive: true })
    await writeFile(tempPath, content, 'utf8')
    await rename(tempPath, target)
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
  async renameFile(oldRelativePath: string, newRelativePath: string): Promise<string> {
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

    await mkdir(dirname(target), { recursive: true })
    await rename(source, target)
    return normalizedNew
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

function normalizeVaultPath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/')
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

async function assertDatasetFile(target: string): Promise<void> {
  let fileStats: Awaited<ReturnType<typeof stat>>

  try {
    fileStats = await stat(target)
  } catch {
    throw new Error('Dataset file not found')
  }

  if (!fileStats.isFile()) {
    throw new Error('Dataset path is not a file')
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
    /\{\{\s*(date|time|title)\s*\}\}/g,
    (_match, key: string) => variables[key] ?? ''
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

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
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
