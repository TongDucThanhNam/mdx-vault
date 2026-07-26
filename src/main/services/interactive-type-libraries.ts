import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { createDefaultMapFromNodeModules } from '@typescript/vfs'
import ts from 'typescript'
import { INTERACTIVE_COMPILER_OPTIONS } from '../../shared/interactive-language'

const requireFromHere = createRequire(import.meta.url)
let cachedLibraries: ReadonlyMap<string, string> | null = null

export function loadNodeInteractiveTypeLibraries(): ReadonlyMap<string, string> {
  if (cachedLibraries) {
    return cachedLibraries
  }

  const packagedRoot = resolvePackagedTypeRoot()
  const libraries = packagedRoot
    ? loadPackagedTypeLibraries(packagedRoot)
    : createDefaultMapFromNodeModules(INTERACTIVE_COMPILER_OPTIONS, ts)

  if (packagedRoot) {
    addDeclarationDirectory(
      libraries,
      join(packagedRoot, '@types', 'react'),
      '/node_modules/@types/react'
    )
    addDeclarationDirectory(
      libraries,
      join(packagedRoot, '@types', 'react-dom'),
      '/node_modules/@types/react-dom'
    )
    addDeclarationDirectory(libraries, join(packagedRoot, 'csstype'), '/node_modules/csstype')
  } else {
    addPackageDeclarations(libraries, '@types/react', '/node_modules/@types/react')
    addPackageDeclarations(libraries, '@types/react-dom', '/node_modules/@types/react-dom')
    addPackageDeclarations(libraries, 'csstype', '/node_modules/csstype')
  }

  cachedLibraries = libraries
  return libraries
}

function resolvePackagedTypeRoot(): string | null {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (!resourcesPath) {
    return null
  }
  const candidate = join(resourcesPath, 'interactive-types')
  return existsSync(candidate) ? candidate : null
}

function loadPackagedTypeLibraries(packagedRoot: string): Map<string, string> {
  const libraries = new Map<string, string>()
  addDeclarationDirectory(libraries, join(packagedRoot, 'typescript'), '/')
  return libraries
}

function addPackageDeclarations(
  libraries: Map<string, string>,
  packageName: string,
  virtualRoot: string
): void {
  const packageRoot = dirname(requireFromHere.resolve(`${packageName}/package.json`))
  addDeclarationDirectory(libraries, packageRoot, virtualRoot)
}

function addDeclarationDirectory(
  libraries: Map<string, string>,
  packageRoot: string,
  virtualRoot: string
): void {
  for (const entry of readdirSync(packageRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !(entry.name.endsWith('.d.ts') || entry.name === 'package.json')) {
      continue
    }
    const separator = virtualRoot.endsWith('/') ? '' : '/'
    libraries.set(
      `${virtualRoot}${separator}${entry.name}`,
      readFileSync(join(packageRoot, entry.name), 'utf8')
    )
  }
}
