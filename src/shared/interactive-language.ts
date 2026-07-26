import {
  createSystem,
  createVirtualTypeScriptEnvironment,
  type VirtualTypeScriptEnvironment
} from '@typescript/vfs'
import ts from 'typescript'
import type { InteractiveDiagnostic, InteractiveProjectSnapshot } from './interactive-authoring'

const virtualProjectRoot = '/project'
const allowedRuntimeModules = new Set(['react', 'react-dom'])
const languageSourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json'])

export const INTERACTIVE_COMPILER_OPTIONS: ts.CompilerOptions = {
  allowJs: true,
  allowSyntheticDefaultImports: true,
  checkJs: true,
  esModuleInterop: true,
  jsx: ts.JsxEmit.ReactJSX,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
  types: ['react', 'react-dom']
}

export interface InteractiveCompletion {
  name: string
  kind: string
  sortText: string
  insertText: string | null
  source: string | null
  hasAction: boolean
  from: number | null
  to: number | null
  data: ts.CompletionEntryData | undefined
}

export interface InteractiveTextEdit {
  from: number
  to: number
  insert: string
}

export interface InteractiveCompletionDetails {
  name: string
  detail: string
  documentation: string
  edits: InteractiveTextEdit[]
}

export interface InteractiveHover {
  from: number
  to: number
  signature: string
  documentation: string
}

export interface InteractiveSignatureHelp {
  activeSignature: number
  activeParameter: number
  signatures: Array<{
    prefix: string
    suffix: string
    separator: string
    parameters: Array<{ label: string; documentation: string }>
    documentation: string
  }>
}

export interface InteractiveDefinition {
  kind: 'project' | 'library'
  relativePath: string | null
  from: number
  to: number
  name: string
}

export class InteractiveLanguageProject {
  readonly projectId: string
  private readonly environment: VirtualTypeScriptEnvironment
  private readonly sourcePaths: string[]
  private version: number

  constructor(
    private readonly snapshot: InteractiveProjectSnapshot,
    typeLibraries: ReadonlyMap<string, string>
  ) {
    this.projectId = snapshot.projectId
    this.version = snapshot.version
    const files = new Map(typeLibraries)
    this.sourcePaths = snapshot.files
      .filter(
        (file) => file.relativePath !== 'manifest.json' && isLanguageSourcePath(file.relativePath)
      )
      .map((file) => {
        const virtualPath = toVirtualPath(file.relativePath)
        files.set(virtualPath, file.content)
        return virtualPath
      })

    this.environment = createVirtualTypeScriptEnvironment(
      createSystem(files),
      this.sourcePaths,
      ts,
      INTERACTIVE_COMPILER_OPTIONS
    )
  }

  get projectVersion(): number {
    return this.version
  }

  updateFile(relativePath: string, content: string, version: number): void {
    const virtualPath = this.assertProjectSourcePath(relativePath)
    if (!Number.isInteger(version) || version <= this.version) {
      throw new Error('Interactive language updates must increase the project version')
    }

    if (this.sourcePaths.includes(virtualPath)) {
      this.environment.updateFile(virtualPath, content)
    } else {
      this.environment.createFile(virtualPath, content)
      this.sourcePaths.push(virtualPath)
    }
    this.version = version
  }

  getDiagnostics(): InteractiveDiagnostic[] {
    const diagnostics = [...this.snapshot.diagnostics]

    for (const virtualPath of this.sourcePaths) {
      const sourceFile = this.environment.getSourceFile(virtualPath)
      if (!sourceFile) {
        continue
      }

      diagnostics.push(...this.getDependencyDiagnostics(sourceFile))
      const languageDiagnostics = [
        ...this.environment.languageService.getSyntacticDiagnostics(virtualPath),
        ...this.environment.languageService.getSemanticDiagnostics(virtualPath)
      ]
      diagnostics.push(
        ...languageDiagnostics.map((diagnostic) =>
          toInteractiveDiagnostic(diagnostic, this.snapshot.projectRoot)
        )
      )
    }

    return deduplicateDiagnostics(diagnostics)
  }

  getCompletions(relativePath: string, position: number): InteractiveCompletion[] {
    const virtualPath = this.assertProjectSourcePath(relativePath)
    const completions = this.environment.languageService.getCompletionsAtPosition(
      virtualPath,
      position,
      {
        includeCompletionsForImportStatements: true,
        includeCompletionsForModuleExports: true,
        includeCompletionsWithInsertText: true,
        includePackageJsonAutoImports: 'off'
      }
    )

    return (completions?.entries ?? []).map((entry) => ({
      name: entry.name,
      kind: entry.kind,
      sortText: entry.sortText,
      insertText: entry.insertText ?? null,
      source: entry.source ?? null,
      hasAction: entry.hasAction ?? false,
      from: entry.replacementSpan?.start ?? null,
      to:
        entry.replacementSpan === undefined
          ? null
          : entry.replacementSpan.start + entry.replacementSpan.length,
      data: entry.data
    }))
  }

  getCompletionDetails(
    relativePath: string,
    position: number,
    completion: Pick<InteractiveCompletion, 'name' | 'source' | 'data'>
  ): InteractiveCompletionDetails | null {
    const virtualPath = this.assertProjectSourcePath(relativePath)
    if (completion.source && !this.isAllowedAutoImportSource(relativePath, completion.source)) {
      return null
    }

    const details = this.environment.languageService.getCompletionEntryDetails(
      virtualPath,
      position,
      completion.name,
      {},
      completion.source ?? undefined,
      {
        includeCompletionsForImportStatements: true,
        includeCompletionsForModuleExports: true,
        includeCompletionsWithInsertText: true,
        includePackageJsonAutoImports: 'off'
      },
      completion.data
    )
    if (!details) {
      return null
    }

    const edits: InteractiveTextEdit[] = []
    for (const action of details.codeActions ?? []) {
      for (const change of action.changes) {
        if (change.fileName !== virtualPath) {
          return null
        }
        for (const textChange of change.textChanges) {
          edits.push({
            from: textChange.span.start,
            to: textChange.span.start + textChange.span.length,
            insert: textChange.newText
          })
        }
      }
    }

    return {
      name: details.name,
      detail: displayParts(details.displayParts),
      documentation: displayParts(details.documentation),
      edits
    }
  }

  getHover(relativePath: string, position: number): InteractiveHover | null {
    const virtualPath = this.assertProjectSourcePath(relativePath)
    const info = this.environment.languageService.getQuickInfoAtPosition(virtualPath, position)
    if (!info) {
      return null
    }

    return {
      from: info.textSpan.start,
      to: info.textSpan.start + info.textSpan.length,
      signature: displayParts(info.displayParts),
      documentation: displayParts(info.documentation)
    }
  }

  getSignatureHelp(relativePath: string, position: number): InteractiveSignatureHelp | null {
    const virtualPath = this.assertProjectSourcePath(relativePath)
    const help = this.environment.languageService.getSignatureHelpItems(virtualPath, position, {
      triggerReason: { kind: 'invoked' }
    })
    if (!help) {
      return null
    }

    return {
      activeSignature: help.selectedItemIndex,
      activeParameter: help.argumentIndex,
      signatures: help.items.map((item) => ({
        prefix: displayParts(item.prefixDisplayParts),
        suffix: displayParts(item.suffixDisplayParts),
        separator: displayParts(item.separatorDisplayParts),
        parameters: item.parameters.map((parameter) => ({
          label: displayParts(parameter.displayParts),
          documentation: displayParts(parameter.documentation)
        })),
        documentation: displayParts(item.documentation)
      }))
    }
  }

  getDefinitions(relativePath: string, position: number): InteractiveDefinition[] {
    const virtualPath = this.assertProjectSourcePath(relativePath)
    return (
      this.environment.languageService.getDefinitionAtPosition(virtualPath, position) ?? []
    ).map((definition) => {
      const projectRelativePath = fromVirtualPath(definition.fileName)
      return {
        kind: projectRelativePath === null ? 'library' : 'project',
        relativePath:
          projectRelativePath === null
            ? null
            : `${this.snapshot.projectRoot}/${projectRelativePath}`,
        from: definition.textSpan.start,
        to: definition.textSpan.start + definition.textSpan.length,
        name: definition.name
      }
    })
  }

  dispose(): void {
    this.environment.languageService.dispose()
  }

  private assertProjectSourcePath(relativePath: string): string {
    if (!isLanguageSourcePath(relativePath) || !isSafeProjectRelativePath(relativePath)) {
      throw new Error('Type intelligence only accepts source files inside the active project')
    }
    return toVirtualPath(relativePath)
  }

  private getDependencyDiagnostics(sourceFile: ts.SourceFile): InteractiveDiagnostic[] {
    const imports = ts.preProcessFile(sourceFile.text, true, true).importedFiles
    return imports.flatMap((importedFile) => {
      const specifier = importedFile.fileName
      const message = getImportPolicyError(fromVirtualPath(sourceFile.fileName) ?? '', specifier)
      if (!message) {
        return []
      }
      const start = importedFile.pos
      const end = importedFile.end
      const location = sourceFile.getLineAndCharacterOfPosition(start)
      return [
        {
          source: 'typescript',
          severity: 'error',
          code: specifier.startsWith('.') ? 'IMPORT_OUTSIDE_PROJECT' : 'DEPENDENCY_NOT_ALLOWED',
          message,
          relativePath: `${this.snapshot.projectRoot}/${fromVirtualPath(sourceFile.fileName)}`,
          from: start,
          to: end,
          line: location.line + 1,
          column: location.character + 1
        }
      ]
    })
  }

  private isAllowedAutoImportSource(relativePath: string, source: string): boolean {
    return getImportPolicyError(relativePath, source) === null
  }
}

function toInteractiveDiagnostic(
  diagnostic: ts.Diagnostic,
  projectRoot: string
): InteractiveDiagnostic {
  const projectRelativePath = diagnostic.file ? fromVirtualPath(diagnostic.file.fileName) : null
  const start = diagnostic.start ?? null
  const length = diagnostic.length ?? 0
  const location =
    diagnostic.file && start !== null ? diagnostic.file.getLineAndCharacterOfPosition(start) : null

  return {
    source: 'typescript',
    severity: diagnosticCategoryToSeverity(diagnostic.category),
    code: `TS${diagnostic.code}`,
    message: flattenDiagnosticMessage(diagnostic.messageText),
    relativePath: projectRelativePath ? `${projectRoot}/${projectRelativePath}` : null,
    from: start,
    to: start === null ? null : start + length,
    line: location ? location.line + 1 : null,
    column: location ? location.character + 1 : null
  }
}

function diagnosticCategoryToSeverity(
  category: ts.DiagnosticCategory
): InteractiveDiagnostic['severity'] {
  if (category === ts.DiagnosticCategory.Error) {
    return 'error'
  }
  if (category === ts.DiagnosticCategory.Warning) {
    return 'warning'
  }
  return 'info'
}

function flattenDiagnosticMessage(message: string | ts.DiagnosticMessageChain): string {
  return ts
    .flattenDiagnosticMessageText(message, '\n')
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
}

function displayParts(parts: readonly ts.SymbolDisplayPart[] | undefined): string {
  return parts?.map((part) => part.text).join('') ?? ''
}

function getImportPolicyError(relativePath: string, specifier: string): string | null {
  if (specifier.startsWith('.')) {
    const resolved = normalizeProjectPath(`${dirnameProjectPath(relativePath)}/${specifier}`)
    if (resolved === null) {
      return `Relative import "${specifier}" escapes the active interactive project.`
    }
    return null
  }

  const packageName = getPackageName(specifier)
  if (packageName && allowedRuntimeModules.has(packageName)) {
    return null
  }
  return `dependency not allowed: ${packageName ?? specifier}. It is unavailable in the offline interactive sandbox.`
}

function getPackageName(specifier: string): string | null {
  if (!specifier || specifier.startsWith('/') || specifier.includes('\\')) {
    return null
  }
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    return scope && name ? `${scope}/${name}` : null
  }
  return specifier.split('/')[0] ?? null
}

function dirnameProjectPath(relativePath: string): string {
  const separator = relativePath.lastIndexOf('/')
  return separator === -1 ? '' : relativePath.slice(0, separator)
}

function normalizeProjectPath(value: string): string | null {
  const segments: string[] = []
  for (const segment of value.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (segments.length === 0) {
        return null
      }
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

function isLanguageSourcePath(relativePath: string): boolean {
  const dotIndex = relativePath.lastIndexOf('.')
  return dotIndex !== -1 && languageSourceExtensions.has(relativePath.slice(dotIndex).toLowerCase())
}

function isSafeProjectRelativePath(relativePath: string): boolean {
  return (
    relativePath.length > 0 &&
    !relativePath.startsWith('/') &&
    !relativePath.includes('\\') &&
    normalizeProjectPath(relativePath) === relativePath
  )
}

function toVirtualPath(relativePath: string): string {
  if (!isSafeProjectRelativePath(relativePath)) {
    throw new Error('Interactive language path must be project-relative')
  }
  return `${virtualProjectRoot}/${relativePath}`
}

function fromVirtualPath(virtualPath: string): string | null {
  const prefix = `${virtualProjectRoot}/`
  return virtualPath.startsWith(prefix) ? virtualPath.slice(prefix.length) : null
}

function deduplicateDiagnostics(diagnostics: InteractiveDiagnostic[]): InteractiveDiagnostic[] {
  const seen = new Set<string>()
  return diagnostics.filter((diagnostic) => {
    const key = [
      diagnostic.source,
      diagnostic.code,
      diagnostic.relativePath,
      diagnostic.from,
      diagnostic.message
    ].join('\0')
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
