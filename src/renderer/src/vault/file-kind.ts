const NOTE_EXTENSION = /\.(?:md|mdx)$/iu
const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|svg)$/iu

export function isNotePath(relativePath: string | null): relativePath is string {
  return relativePath !== null && NOTE_EXTENSION.test(relativePath)
}

export function isPreviewableVaultImagePath(relativePath: string | null): relativePath is string {
  if (!relativePath) {
    return false
  }

  const normalizedPath = relativePath.replaceAll('\\', '/')
  return normalizedPath.startsWith('assets/') && IMAGE_EXTENSION.test(normalizedPath)
}
