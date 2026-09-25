import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BookmarkService } from '../src/main/services/bookmark-service'
import {
  addBookmarkItem,
  createEmptyBookmarkManifest,
  moveBookmarkNode,
  rewriteBookmarkTargets
} from '../src/shared/bookmarks'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

describe('GOAL-23 durable bookmark model', () => {
  test('persists versioned groups and ordering independently of the index', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal23-bookmarks-'))
    roots.push(root)
    const service = new BookmarkService(root)
    let manifest = createEmptyBookmarkManifest()

    manifest = addBookmarkItem(manifest, {
      id: 'file-1',
      title: null,
      target: { kind: 'file', relativePath: 'notes/Alpha.mdx' }
    })
    manifest = addBookmarkItem(
      manifest,
      {
        id: 'heading-1',
        title: 'Section',
        target: { kind: 'heading', relativePath: 'notes/Alpha.mdx', heading: 'Section' }
      },
      'group-1',
      'Research'
    )
    manifest = moveBookmarkNode(manifest, 'file-1', 'group-1', 1)

    await service.save(manifest)
    await rm(join(root, '.app', 'index.sqlite'), { force: true })

    expect(await new BookmarkService(root).load()).toEqual(manifest)
    expect(JSON.parse(await readFile(join(root, '.app', 'bookmarks.json'), 'utf8')).version).toBe(1)
  })

  test('rewrites file and descendant heading targets while preserving missing bookmarks', () => {
    let manifest = createEmptyBookmarkManifest()
    manifest = addBookmarkItem(manifest, {
      id: 'file',
      title: null,
      target: { kind: 'file', relativePath: 'notes/Old.mdx' }
    })
    manifest = addBookmarkItem(manifest, {
      id: 'heading',
      title: null,
      target: { kind: 'heading', relativePath: 'notes/Old.mdx', heading: 'Part' }
    })
    manifest = addBookmarkItem(manifest, {
      id: 'missing',
      title: null,
      target: { kind: 'file', relativePath: 'notes/Deleted.mdx' }
    })

    const rewritten = rewriteBookmarkTargets(manifest, 'notes/Old.mdx', 'archive/New.mdx')
    expect(rewritten.children.map((node) => (node.kind === 'item' ? node.target : null))).toEqual([
      { kind: 'file', relativePath: 'archive/New.mdx' },
      { kind: 'heading', relativePath: 'archive/New.mdx', heading: 'Part' },
      { kind: 'file', relativePath: 'notes/Deleted.mdx' }
    ])
  })

  test('reports corrupt storage without overwriting it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal23-corrupt-bookmarks-'))
    roots.push(root)
    await mkdir(join(root, '.app'), { recursive: true })
    await writeFile(join(root, '.app', 'bookmarks.json'), '{broken', 'utf8')
    const service = new BookmarkService(root)

    await expect(service.load()).rejects.toThrow(/corrupt/i)
    expect(await readFile(join(root, '.app', 'bookmarks.json'), 'utf8')).toBe('{broken')
  })

  test('rejects skipped revisions while allowing an exact internal rollback snapshot', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal23-bookmark-revisions-'))
    roots.push(root)
    const service = new BookmarkService(root)
    const empty = createEmptyBookmarkManifest()
    const first = addBookmarkItem(empty, {
      id: 'one',
      title: null,
      target: { kind: 'file', relativePath: 'notes/One.mdx' }
    })
    await service.save(first, empty.revision)

    await expect(
      service.save({ ...first, revision: first.revision + 2 }, first.revision)
    ).rejects.toThrow(/exactly one/i)
    await service.restore(empty, first.revision)
    expect(await service.load()).toEqual(empty)
  })
})
