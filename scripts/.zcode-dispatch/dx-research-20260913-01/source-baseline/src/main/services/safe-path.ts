import { isAbsolute, relative, resolve } from 'path'

export function safeJoin(root: string, relativePath: string): string {
  if (relativePath.includes('\0')) {
    throw new Error('Path contains a null byte')
  }

  const absoluteRoot = resolve(root)
  const target = resolve(absoluteRoot, relativePath)
  const pathFromRoot = relative(absoluteRoot, target)

  if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    throw new Error('Path escapes vault root')
  }

  return target
}
