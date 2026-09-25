export const BOOKMARKS_VERSION = 1 as const
export const MAX_BOOKMARK_NODES = 2_000
export const MAX_BOOKMARK_DEPTH = 12

export type BookmarkTarget =
  | { kind: 'file'; relativePath: string }
  | { kind: 'folder'; relativePath: string }
  | { kind: 'search'; query: string }
  | { kind: 'heading'; relativePath: string; heading: string }

export interface BookmarkItem {
  kind: 'item'
  id: string
  title: string | null
  target: BookmarkTarget
}

export interface BookmarkGroup {
  kind: 'group'
  id: string
  title: string
  expanded: boolean
  children: BookmarkNode[]
}

export type BookmarkNode = BookmarkItem | BookmarkGroup

export interface BookmarkManifest {
  version: typeof BOOKMARKS_VERSION
  revision: number
  children: BookmarkNode[]
}

export type BookmarkItemInput = Omit<BookmarkItem, 'kind'>

export function createEmptyBookmarkManifest(): BookmarkManifest {
  return { version: BOOKMARKS_VERSION, revision: 0, children: [] }
}

export function addBookmarkItem(
  manifest: BookmarkManifest,
  input: BookmarkItemInput,
  groupId?: string,
  groupTitle?: string
): BookmarkManifest {
  assertUniqueNodeId(manifest, input.id)
  const item: BookmarkItem = { kind: 'item', ...input }
  let children = cloneNodes(manifest.children)

  if (!groupId) {
    children.push(item)
    return nextManifest(manifest, children)
  }

  let inserted = false
  children = mapGroups(children, (group) => {
    if (group.id !== groupId) return group
    inserted = true
    return { ...group, children: [...group.children, item] }
  })

  if (!inserted) {
    if (!groupTitle?.trim()) {
      throw new Error('Bookmark group does not exist.')
    }
    assertUniqueNodeId(manifest, groupId)
    children.push({
      kind: 'group',
      id: groupId,
      title: groupTitle.trim(),
      expanded: true,
      children: [item]
    })
  }

  return nextManifest(manifest, children)
}

export function addBookmarkGroup(
  manifest: BookmarkManifest,
  input: Pick<BookmarkGroup, 'id' | 'title'>,
  parentGroupId?: string
): BookmarkManifest {
  assertUniqueNodeId(manifest, input.id)
  const group: BookmarkGroup = {
    kind: 'group',
    id: input.id,
    title: input.title.trim() || 'Untitled group',
    expanded: true,
    children: []
  }
  if (!parentGroupId) {
    return nextManifest(manifest, [...cloneNodes(manifest.children), group])
  }

  let inserted = false
  const children = mapGroups(cloneNodes(manifest.children), (candidate) => {
    if (candidate.id !== parentGroupId) return candidate
    inserted = true
    return { ...candidate, children: [...candidate.children, group] }
  })
  if (!inserted) throw new Error('Target bookmark group was not found.')
  return nextManifest(manifest, children)
}

export function updateBookmarkNode(
  manifest: BookmarkManifest,
  nodeId: string,
  update:
    | Partial<Pick<BookmarkItem, 'title' | 'target'>>
    | Partial<Pick<BookmarkGroup, 'title' | 'expanded'>>
): BookmarkManifest {
  let changed = false
  const children = mapNodes(manifest.children, (node) => {
    if (node.id !== nodeId) return node
    changed = true
    return { ...node, ...update } as BookmarkNode
  })

  if (!changed) {
    throw new Error('Bookmark item was not found.')
  }

  return nextManifest(manifest, children)
}

export function removeBookmarkNode(manifest: BookmarkManifest, nodeId: string): BookmarkManifest {
  const removed = removeNode(manifest.children, nodeId)
  if (!removed.node) {
    throw new Error('Bookmark item was not found.')
  }
  return nextManifest(manifest, removed.children)
}

export function moveBookmarkNode(
  manifest: BookmarkManifest,
  nodeId: string,
  targetGroupId: string | null,
  targetIndex: number
): BookmarkManifest {
  const removed = removeNode(cloneNodes(manifest.children), nodeId)

  if (!removed.node) {
    throw new Error('Bookmark item was not found.')
  }

  if (
    removed.node.kind === 'group' &&
    targetGroupId &&
    containsNode(removed.node.children, targetGroupId)
  ) {
    throw new Error('A bookmark group cannot be moved inside itself.')
  }

  const boundedIndex = Math.max(0, Math.floor(targetIndex))

  if (!targetGroupId) {
    const children = [...removed.children]
    children.splice(Math.min(boundedIndex, children.length), 0, removed.node)
    return nextManifest(manifest, children)
  }

  let inserted = false
  const children = mapGroups(removed.children, (group) => {
    if (group.id !== targetGroupId) return group
    const nextChildren = [...group.children]
    nextChildren.splice(
      Math.min(boundedIndex, nextChildren.length),
      0,
      removed.node as BookmarkNode
    )
    inserted = true
    return { ...group, children: nextChildren }
  })

  if (!inserted) {
    throw new Error('Target bookmark group was not found.')
  }

  return nextManifest(manifest, children)
}

export function rewriteBookmarkTargets(
  manifest: BookmarkManifest,
  oldRelativePath: string,
  newRelativePath: string,
  folder = false
): BookmarkManifest {
  const oldPath = normalizeVaultPath(oldRelativePath)
  const newPath = normalizeVaultPath(newRelativePath)
  let changed = false
  const children = mapNodes(manifest.children, (node) => {
    if (node.kind !== 'item' || node.target.kind === 'search') {
      return node
    }

    const currentPath = normalizeVaultPath(node.target.relativePath)
    const matches = folder
      ? currentPath === oldPath || currentPath.startsWith(`${oldPath}/`)
      : currentPath === oldPath

    if (!matches) {
      return node
    }

    const suffix = folder ? currentPath.slice(oldPath.length) : ''
    changed = true
    return {
      ...node,
      target: { ...node.target, relativePath: `${newPath}${suffix}` }
    }
  })

  return changed ? nextManifest(manifest, children) : manifest
}

export function flattenBookmarkNodes(nodes: BookmarkNode[]): BookmarkNode[] {
  const flattened: BookmarkNode[] = []
  for (const node of nodes) {
    flattened.push(node)
    if (node.kind === 'group') {
      flattened.push(...flattenBookmarkNodes(node.children))
    }
  }
  return flattened
}

function nextManifest(manifest: BookmarkManifest, children: BookmarkNode[]): BookmarkManifest {
  assertBookmarkBounds(children)
  return { ...manifest, revision: manifest.revision + 1, children }
}

function assertBookmarkBounds(nodes: BookmarkNode[], depth = 0, count = { value: 0 }): void {
  if (depth > MAX_BOOKMARK_DEPTH) {
    throw new Error(`Bookmark groups cannot be nested deeper than ${MAX_BOOKMARK_DEPTH} levels.`)
  }

  for (const node of nodes) {
    count.value += 1
    if (count.value > MAX_BOOKMARK_NODES) {
      throw new Error(`Bookmarks are limited to ${MAX_BOOKMARK_NODES} items and groups.`)
    }
    if (node.kind === 'group') {
      assertBookmarkBounds(node.children, depth + 1, count)
    }
  }
}

function assertUniqueNodeId(manifest: BookmarkManifest, id: string): void {
  if (flattenBookmarkNodes(manifest.children).some((node) => node.id === id)) {
    throw new Error('Bookmark IDs must be unique.')
  }
}

function removeNode(
  children: BookmarkNode[],
  nodeId: string
): { children: BookmarkNode[]; node: BookmarkNode | null } {
  const directIndex = children.findIndex((node) => node.id === nodeId)
  if (directIndex !== -1) {
    const nextChildren = [...children]
    const [node] = nextChildren.splice(directIndex, 1)
    return { children: nextChildren, node }
  }

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    if (child.kind !== 'group') continue
    const nested = removeNode(child.children, nodeId)
    if (nested.node) {
      const nextChildren = [...children]
      nextChildren[index] = { ...child, children: nested.children }
      return { children: nextChildren, node: nested.node }
    }
  }

  return { children, node: null }
}

function mapNodes(
  children: BookmarkNode[],
  transform: (node: BookmarkNode) => BookmarkNode
): BookmarkNode[] {
  return children.map((node) => {
    const withChildren =
      node.kind === 'group' ? { ...node, children: mapNodes(node.children, transform) } : node
    return transform(withChildren)
  })
}

function mapGroups(
  children: BookmarkNode[],
  transform: (group: BookmarkGroup) => BookmarkGroup
): BookmarkNode[] {
  return children.map((node) => {
    if (node.kind === 'item') return node
    const nested = { ...node, children: mapGroups(node.children, transform) }
    return transform(nested)
  })
}

function containsNode(children: BookmarkNode[], nodeId: string): boolean {
  return children.some(
    (node) => node.id === nodeId || (node.kind === 'group' && containsNode(node.children, nodeId))
  )
}

function cloneNodes(nodes: BookmarkNode[]): BookmarkNode[] {
  return nodes.map((node) =>
    node.kind === 'group' ? { ...node, children: cloneNodes(node.children) } : { ...node }
  )
}

function normalizeVaultPath(value: string): string {
  return value
    .replaceAll('\\', '/')
    .replace(/^\.\/+/u, '')
    .replace(/\/+$/u, '')
}
