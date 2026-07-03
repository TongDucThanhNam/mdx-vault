import { mkdir, readFile, rename, stat, writeFile } from 'fs/promises'
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

const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx'])
const ASSET_DATA_EXTENSIONS = new Set(['.csv', '.json'])
const FILE_PATTERNS = ['**/*.md', '**/*.mdx']
const IGNORED_DIRECTORIES = ['**/node_modules/**', '**/.git/**', '**/.app/**']

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
