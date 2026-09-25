import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import fg from 'fast-glob'
import {
  createInteractiveProjectSnapshot,
  type InteractiveDiagnostic
} from '../../shared/interactive-authoring'
import { InteractiveLanguageProject } from '../../shared/interactive-language'
import { loadNodeInteractiveTypeLibraries } from './interactive-type-libraries'

export async function typecheckInteractiveRoot({
  rootPath,
  projectRoot,
  version = 1
}: {
  rootPath: string
  projectRoot: string
  version?: number
}): Promise<InteractiveDiagnostic[]> {
  const relativePaths = await fg(
    ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.json', 'README.md'],
    {
      cwd: rootPath,
      dot: false,
      onlyFiles: true,
      unique: true,
      followSymbolicLinks: false
    }
  )
  const files = await Promise.all(
    relativePaths.map(async (relativePath) => ({
      relativePath: relativePath.replaceAll('\\', '/'),
      content: await readFile(resolve(rootPath, relativePath), 'utf8')
    }))
  )
  const snapshot = createInteractiveProjectSnapshot({
    projectRoot,
    version,
    files
  })
  const project = new InteractiveLanguageProject(snapshot, loadNodeInteractiveTypeLibraries())

  try {
    return project.getDiagnostics()
  } finally {
    project.dispose()
  }
}
