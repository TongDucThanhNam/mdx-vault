import { readFile, stat } from 'fs/promises'
import { watch, type FSWatcher } from 'chokidar'

import { safeJoin } from './safe-path'
import { DbService } from './db-service'
import { buildNoteIndex, hashContent, isMarkdownPath } from './index-service'
import type { VaultService } from './vault-service'

type IndexChangeCallback = () => void

const WATCH_TARGET = '.'
const DEBOUNCE_MS = 250

export class VaultIndexRuntime {
  private readonly vault: VaultService
  private readonly db: DbService
  private readonly onDidChange?: IndexChangeCallback
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private watcher: FSWatcher | null = null

  private constructor(vault: VaultService, db: DbService, onDidChange?: IndexChangeCallback) {
    this.vault = vault
    this.db = db
    this.onDidChange = onDidChange
  }

  static open(vault: VaultService, onDidChange?: IndexChangeCallback): VaultIndexRuntime {
    return new VaultIndexRuntime(vault, DbService.open(vault.rootPath), onDidChange)
  }

  get database(): DbService {
    return this.db
  }

  async start(): Promise<void> {
    await this.scanVault()
    await this.startWatcher()
  }

  async close(): Promise<void> {
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer)
    }

    this.pendingTimers.clear()

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }

    this.db.close()
  }

  async rebuild(): Promise<void> {
    this.db.clearAll()
    await this.scanVault()
    this.onDidChange?.()
  }

  async scanVault(): Promise<void> {
    const files = await this.vault.listFiles()
    const currentPaths = new Set(files.map((file) => file.relativePath))
    const indexedPaths = this.db.listNotePaths()
    let changed = false

    for (const relativePath of indexedPaths) {
      if (!currentPaths.has(relativePath)) {
        this.db.deleteNote(relativePath)
        changed = true
      }
    }

    for (const file of files) {
      changed = (await this.indexFile(file.relativePath, false)) || changed
    }

    if (changed) {
      this.onDidChange?.()
    }
  }

  async indexFile(relativePath: string, emitChange = true): Promise<boolean> {
    const normalizedPath = normalizeVaultPath(relativePath)

    if (!isMarkdownPath(normalizedPath) || isIgnoredVaultPath(normalizedPath)) {
      return false
    }

    const absolutePath = safeJoin(this.vault.rootPath, normalizedPath)
    const fileStats = await stat(absolutePath).catch(() => null)

    if (!fileStats?.isFile()) {
      return false
    }

    const mtimeMs = Math.round(fileStats.mtimeMs)
    const previousState = this.db.getNoteFileState(normalizedPath)

    if (previousState?.mtimeMs === mtimeMs) {
      return false
    }

    const source = await readFile(absolutePath, 'utf8')
    const contentHash = hashContent(source)

    if (previousState?.contentHash === contentHash) {
      this.db.updateNoteMtime(normalizedPath, mtimeMs)

      if (emitChange) {
        this.onDidChange?.()
      }

      return true
    }

    this.db.upsertNote(
      buildNoteIndex({
        relativePath: normalizedPath,
        source,
        mtimeMs
      })
    )

    if (emitChange) {
      this.onDidChange?.()
    }

    return true
  }

  deleteFile(relativePath: string): void {
    const normalizedPath = normalizeVaultPath(relativePath)

    if (!isMarkdownPath(normalizedPath) || isIgnoredVaultPath(normalizedPath)) {
      return
    }

    this.db.deleteNote(normalizedPath)
    this.onDidChange?.()
  }

  private startWatcher(): Promise<void> {
    return new Promise((resolveReady, rejectReady) => {
      const watcher = watch(WATCH_TARGET, {
        cwd: this.vault.rootPath,
        ignored: (path) => isIgnoredVaultPath(path),
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 50
        }
      })

      this.watcher = watcher
      watcher.on('add', (path) => this.queueIndex(path))
      watcher.on('change', (path) => this.queueIndex(path))
      watcher.on('unlink', (path) => this.queueDelete(path))
      watcher.once('ready', resolveReady)
      watcher.once('error', rejectReady)
      watcher.on('error', (error) => {
        console.error('Vault index watcher error', error)
      })
    })
  }

  private queueIndex(path: string): void {
    const relativePath = normalizeVaultPath(path)
    const existingTimer = this.pendingTimers.get(relativePath)

    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      this.pendingTimers.delete(relativePath)
      void this.indexFile(relativePath).catch((error: unknown) => {
        console.error(`Failed to index ${relativePath}`, error)
      })
    }, DEBOUNCE_MS)

    this.pendingTimers.set(relativePath, timer)
  }

  private queueDelete(path: string): void {
    const relativePath = normalizeVaultPath(path)
    const existingTimer = this.pendingTimers.get(relativePath)

    if (existingTimer) {
      clearTimeout(existingTimer)
      this.pendingTimers.delete(relativePath)
    }

    this.deleteFile(relativePath)
  }
}

function normalizeVaultPath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/')
}

function isIgnoredVaultPath(path: string): boolean {
  const normalizedPath = normalizeVaultPath(path)
  const segments = normalizedPath.split('/')
  return (
    segments.includes('.app') ||
    segments.includes('node_modules') ||
    segments.includes('.git') ||
    segments.includes('.trash')
  )
}
