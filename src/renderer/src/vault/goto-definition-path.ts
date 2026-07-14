interface VaultNavigationFile {
  relativePath: string
}

/** Resolve an existing vault file, with Interactive folder fallback. */
export function resolveVaultNavigationTarget(
  files: readonly VaultNavigationFile[],
  relativePath: string
): string | null {
  const normalizedPath = relativePath.replaceAll('\\', '/').replace(/\/+$/u, '')
  if (!normalizedPath) {
    return null
  }

  const availablePaths = new Set(files.map((file) => file.relativePath))
  if (availablePaths.has(normalizedPath)) {
    return normalizedPath
  }

  const componentPath = `${normalizedPath}/component.tsx`
  return availablePaths.has(componentPath) ? componentPath : null
}
