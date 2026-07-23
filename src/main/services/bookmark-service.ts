import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'

import {
  BOOKMARKS_VERSION,
  type BookmarkManifest,
  createEmptyBookmarkManifest,
  MAX_BOOKMARK_DEPTH,
  MAX_BOOKMARK_NODES,
  rewriteBookmarkTargets
} from '../../shared/bookmarks'

const relativePathSchema = z
  .string()
  .min(1)
  .max(1_024)
  .refine((value) => {
    const normalized = value.replaceAll('\\', '/')
    return (
      !normalized.startsWith('/') &&
      !/^[a-z]:/iu.test(normalized) &&
      !normalized.split('/').includes('..')
    )
  }, 'Bookmark paths must stay vault-relative')

const bookmarkTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), relativePath: relativePathSchema }),
  z.object({ kind: z.literal('folder'), relativePath: relativePathSchema }),
  z.object({ kind: z.literal('search'), query: z.string().min(1).max(300) }),
  z.object({
    kind: z.literal('heading'),
    relativePath: relativePathSchema,
    heading: z.string().min(1).max(500)
  })
])

const bookmarkItemSchema = z.object({
  kind: z.literal('item'),
  id: z.string().min(1).max(120),
  title: z.string().max(500).nullable(),
  target: bookmarkTargetSchema
})

type BookmarkGroupSchema = z.ZodType<{
  kind: 'group'
  id: string
  title: string
  expanded: boolean
  children: Array<z.infer<typeof bookmarkItemSchema> | BookmarkGroupSchema['_output']>
}>

const bookmarkGroupSchema: BookmarkGroupSchema = z.lazy(() =>
  z.object({
    kind: z.literal('group'),
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(500),
    expanded: z.boolean(),
    children: z.array(z.union([bookmarkItemSchema, bookmarkGroupSchema])).max(MAX_BOOKMARK_NODES)
  })
)

export const bookmarkManifestSchema = z
  .object({
    version: z.literal(BOOKMARKS_VERSION),
    revision: z.number().int().nonnegative(),
    children: z.array(z.union([bookmarkItemSchema, bookmarkGroupSchema])).max(MAX_BOOKMARK_NODES)
  })
  .superRefine((manifest, context) => {
    const ids = new Set<string>()
    let count = 0

    const visit = (
      nodes: Array<z.infer<typeof bookmarkItemSchema> | z.infer<typeof bookmarkGroupSchema>>,
      depth: number
    ): void => {
      if (depth > MAX_BOOKMARK_DEPTH) {
        context.addIssue({
          code: 'custom',
          message: `Bookmark groups exceed the maximum depth of ${MAX_BOOKMARK_DEPTH}.`
        })
        return
      }

      for (const node of nodes) {
        count += 1
        if (ids.has(node.id)) {
          context.addIssue({ code: 'custom', message: `Duplicate bookmark ID: ${node.id}` })
        }
        ids.add(node.id)
        if (node.kind === 'group') visit(node.children, depth + 1)
      }
    }

    visit(manifest.children, 0)
    if (count > MAX_BOOKMARK_NODES) {
      context.addIssue({
        code: 'custom',
        message: `Bookmarks exceed the maximum of ${MAX_BOOKMARK_NODES} nodes.`
      })
    }
  })

export class BookmarkService {
  private readonly filePath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(vaultRoot: string) {
    this.filePath = join(vaultRoot, '.app', 'bookmarks.json')
  }

  async load(): Promise<BookmarkManifest> {
    let raw: string

    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return createEmptyBookmarkManifest()
      }
      throw error
    }

    try {
      return bookmarkManifestSchema.parse(JSON.parse(raw)) as BookmarkManifest
    } catch {
      throw new Error(
        'Bookmark storage is corrupt. The existing .app/bookmarks.json was preserved for recovery.'
      )
    }
  }

  async save(manifest: BookmarkManifest, expectedRevision?: number): Promise<BookmarkManifest> {
    const validated = bookmarkManifestSchema.parse(manifest) as BookmarkManifest
    let result = validated

    const operation = this.writeQueue.then(async () => {
      const current = await this.load()
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw new Error('Bookmarks changed in another operation. Reload before saving.')
      }
      if (expectedRevision !== undefined && validated.revision !== expectedRevision + 1) {
        throw new Error('Bookmark revisions must advance by exactly one.')
      }

      result = validated
      await this.writeAtomic(`${JSON.stringify(result, null, 2)}\n`)
    })

    this.writeQueue = operation.catch(() => undefined)
    await operation
    return result
  }

  async restore(
    manifest: BookmarkManifest,
    expectedCurrentRevision: number
  ): Promise<BookmarkManifest> {
    const validated = bookmarkManifestSchema.parse(manifest) as BookmarkManifest
    let result = validated
    const operation = this.writeQueue.then(async () => {
      const current = await this.load()
      if (current.revision !== expectedCurrentRevision) {
        throw new Error('Bookmarks changed before the rename rollback could be restored.')
      }
      result = validated
      await this.writeAtomic(`${JSON.stringify(result, null, 2)}\n`)
    })
    this.writeQueue = operation.catch(() => undefined)
    await operation
    return result
  }

  async rewritePath(
    oldRelativePath: string,
    newRelativePath: string,
    folder = false
  ): Promise<{ before: BookmarkManifest; after: BookmarkManifest }> {
    const before = await this.load()
    const after = rewriteBookmarkTargets(before, oldRelativePath, newRelativePath, folder)

    if (after !== before) {
      await this.save(after, before.revision)
    }

    return { before, after }
  }

  private async writeAtomic(serialized: string): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    try {
      await writeFile(tempPath, serialized, 'utf8')
      await rename(tempPath, this.filePath)
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined)
      throw error
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
