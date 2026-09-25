interface DatasetTarget {
  dataset?: {
    itemPath?: unknown
  }
}

export function resolveFileTreeClickPath(
  composedPath: readonly unknown[],
  filePaths: ReadonlySet<string>
): string | null {
  for (const target of composedPath) {
    if (!target || typeof target !== 'object' || !('dataset' in target)) {
      continue
    }

    const itemPath = (target as DatasetTarget).dataset?.itemPath
    if (typeof itemPath === 'string' && filePaths.has(itemPath)) {
      return itemPath
    }
  }

  return null
}

export function shouldActivateTreeSelection(
  selectedFile: string | null,
  activePath: string | null,
  clickActivatedPath: string | null
): selectedFile is string {
  return selectedFile !== null && selectedFile !== activePath && selectedFile !== clickActivatedPath
}
