export function isVisibleVaultPath(relativePath: string): boolean {
  return !relativePath
    .replaceAll('\\', '/')
    .split('/')
    .some((segment) => segment.startsWith('.'))
}
