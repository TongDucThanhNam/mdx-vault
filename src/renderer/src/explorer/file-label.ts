const NOTE_EXTENSION = /\.(mdx|md)$/i

export function displayFileName(
  relativePath: string,
  showFileExtensions: boolean,
  visiblePaths: readonly string[]
): string {
  const normalized = relativePath.replaceAll('\\', '/')
  const name = normalized.split('/').at(-1) ?? normalized
  if (showFileExtensions || !NOTE_EXTENSION.test(name)) return name
  const stem = name.replace(NOTE_EXTENSION, '')
  const directory = normalized.slice(0, normalized.length - name.length).toLocaleLowerCase()
  const ambiguous = visiblePaths.some((other) => {
    if (other === relativePath) return false
    const normalizedOther = other.replaceAll('\\', '/')
    const otherName = normalizedOther.split('/').at(-1) ?? normalizedOther
    return (
      NOTE_EXTENSION.test(otherName) &&
      normalizedOther.slice(0, normalizedOther.length - otherName.length).toLocaleLowerCase() ===
        directory &&
      otherName.replace(NOTE_EXTENSION, '').toLocaleLowerCase() === stem.toLocaleLowerCase()
    )
  })
  return ambiguous ? name : stem
}

/** Tree row selection can redraw every visible row; resolve each label once per path set. */
export function createFileLabelCache(
  visiblePaths: readonly string[],
  showFileExtensions: boolean
): (relativePath: string) => string {
  const labels = new Map<string, string>()
  return (relativePath) => {
    let label = labels.get(relativePath)
    if (label === undefined) {
      label = displayFileName(relativePath, showFileExtensions, visiblePaths)
      labels.set(relativePath, label)
    }
    return label
  }
}
