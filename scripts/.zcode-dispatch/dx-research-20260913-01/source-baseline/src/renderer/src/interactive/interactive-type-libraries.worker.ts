const typescriptLibraryModules = import.meta.glob<string>(
  '../../../../node_modules/typescript/lib/lib.*.d.ts',
  {
    eager: true,
    import: 'default',
    query: '?raw'
  }
)
const reactTypeModules = import.meta.glob<string>(
  [
    '../../../../node_modules/@types/react/*.d.ts',
    '../../../../node_modules/@types/react/package.json',
    '../../../../node_modules/@types/react-dom/*.d.ts',
    '../../../../node_modules/@types/react-dom/package.json',
    '../../../../node_modules/csstype/index.d.ts',
    '../../../../node_modules/csstype/package.json'
  ],
  {
    eager: true,
    import: 'default',
    query: '?raw'
  }
)

export function loadWorkerInteractiveTypeLibraries(): ReadonlyMap<string, string> {
  const libraries = new Map<string, string>()
  for (const [sourcePath, content] of Object.entries(typescriptLibraryModules)) {
    libraries.set(`/${basename(sourcePath)}`, content)
  }
  for (const [sourcePath, content] of Object.entries(reactTypeModules)) {
    const virtualPath = toNodeModulesVirtualPath(sourcePath)
    if (virtualPath) {
      libraries.set(virtualPath, content)
    }
  }
  return libraries
}

function basename(value: string): string {
  return value.slice(value.lastIndexOf('/') + 1)
}

function toNodeModulesVirtualPath(sourcePath: string): string | null {
  const normalized = sourcePath.replaceAll('\\', '/')
  const marker = '/node_modules/'
  const markerIndex = normalized.lastIndexOf(marker)
  return markerIndex === -1 ? null : normalized.slice(markerIndex)
}
