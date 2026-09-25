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
const MAX_REFERENCE_RESULTS = 200
const MAX_REFERENCE_PREVIEW_LENGTH = 160
const MAX_RENAME_LOCATIONS = 512
const MAX_RENAME_NAME_LENGTH = 128
const MAX_CODE_ACTIONS = 20

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

export interface InteractiveReference {
  relativePath: string
  from: number
  to: number
  line: number
  column: number
  preview: string
  isDefinition: boolean
  isWriteAccess: boolean
}

export interface InteractiveReferenceResult {
  items: InteractiveReference[]
  total: number
  truncated: boolean
}

export type InteractiveRenameResult =
  | {
      canRename: true
      displayName: string
      from: number
      to: number
      edits: InteractiveTextEdit[]
    }
  | {
      canRename: false
      reasonCode: 'NOT_RENAMEABLE' | 'CROSS_FILE_RENAME' | 'INVALID_NAME' | 'TOO_MANY_LOCATIONS'
      reason: string
    }

export interface InteractiveCodeAction {
  id: string
  title: string
  edits: InteractiveTextEdit[]
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

  getReferences(relativePath: string, position: number): InteractiveReferenceResult {
    const virtualPath = this.assertProjectSourcePath(relativePath)
    const referencedSymbols =
      this.environment.languageService.findReferences(virtualPath, position) ?? []
    const references = referencedSymbols.flatMap((symbol) =>
      symbol.references.flatMap((reference) => {
        const projectRelativePath = fromVirtualPath(reference.fileName)
        if (projectRelativePath === null) {
          return []
        }
        const sourceFile = this.environment.getSourceFile(reference.fileName)
        if (!sourceFile) {
          return []
        }
        const start = reference.textSpan.start
        const location = sourceFile.getLineAndCharacterOfPosition(start)
        const line = sourceFile.getLineStarts()[location.line]
        const nextLine = sourceFile.getLineStarts()[location.line + 1] ?? sourceFile.text.length
        const preview = sourceFile.text
          .slice(line, nextLine)
          .trim()
          .slice(0, MAX_REFERENCE_PREVIEW_LENGTH)

        return [
          {
            relativePath: `${this.snapshot.projectRoot}/${projectRelativePath}`,
            from: start,
            to: start + reference.textSpan.length,
            line: location.line + 1,
            column: location.character + 1,
            preview,
            isDefinition:
              reference.isDefinition === true ||
              (reference.fileName === symbol.definition.fileName &&
                reference.textSpan.start === symbol.definition.textSpan.start &&
                reference.textSpan.length === symbol.definition.textSpan.length),
            isWriteAccess: reference.isWriteAccess
          }
        ]
      })
    )
    const deduplicated = deduplicateReferences(references).sort(
      (left, right) => left.relativePath.localeCompare(right.relativePath) || left.from - right.from
    )

    return {
      items: deduplicated.slice(0, MAX_REFERENCE_RESULTS),
      total: deduplicated.length,
      truncated: deduplicated.length > MAX_REFERENCE_RESULTS
    }
  }

  getRename(relativePath: string, position: number, newName?: string): InteractiveRenameResult {
    const virtualPath = this.assertProjectSourcePath(relativePath)
    const renameInfo = this.environment.languageService.getRenameInfo(virtualPath, position, {
      allowRenameOfImportPath: false,
      providePrefixAndSuffixTextForRename: true
    })
    if (!renameInfo.canRename || renameInfo.fileToRename) {
      return {
        canRename: false,
        reasonCode: 'NOT_RENAMEABLE',
        reason: renameInfo.canRename
          ? 'File and module-path rename is not available in this editor.'
          : renameInfo.localizedErrorMessage
      }
    }

    const locations =
      this.environment.languageService.findRenameLocations(virtualPath, position, false, false, {
        allowRenameOfImportPath: false,
        providePrefixAndSuffixTextForRename: true
      }) ?? []
    if (locations.length > MAX_RENAME_LOCATIONS) {
      return {
        canRename: false,
        reasonCode: 'TOO_MANY_LOCATIONS',
        reason: `Rename has more than ${MAX_RENAME_LOCATIONS} locations. Use References to inspect it.`
      }
    }
    if (locations.some((location) => location.fileName !== virtualPath)) {
      return {
        canRename: false,
        reasonCode: 'CROSS_FILE_RENAME',
        reason:
          'This symbol has references in other files. Use References; GOAL-27 does not mutate background buffers.'
      }
    }
    if (newName !== undefined && !isValidTypeScriptIdentifier(newName)) {
      return {
        canRename: false,
        reasonCode: 'INVALID_NAME',
        reason: `Rename must be a valid TypeScript identifier up to ${MAX_RENAME_NAME_LENGTH} characters.`
      }
    }

    return {
      canRename: true,
      displayName: renameInfo.displayName,
      from: renameInfo.triggerSpan.start,
      to: renameInfo.triggerSpan.start + renameInfo.triggerSpan.length,
      edits:
        newName === undefined
          ? []
          : locations
              .map((location) => ({
                from: location.textSpan.start,
                to: location.textSpan.start + location.textSpan.length,
                insert: `${location.prefixText ?? ''}${newName}${location.suffixText ?? ''}`
              }))
              .sort((left, right) => left.from - right.from || left.to - right.to)
    }
  }

  getCodeActions(relativePath: string, from: number, to: number): InteractiveCodeAction[] {
    const virtualPath = this.assertProjectSourcePath(relativePath)
    const sourceFile = this.environment.getSourceFile(virtualPath)
    if (!sourceFile) {
      return []
    }
    const rangeFrom = clamp(from, 0, sourceFile.text.length)
    const rangeTo = clamp(Math.max(from, to), rangeFrom, sourceFile.text.length)
    const diagnostics = [
      ...this.environment.languageService.getSyntacticDiagnostics(virtualPath),
      ...this.environment.languageService.getSemanticDiagnostics(virtualPath)
    ]
    const errorCodes = diagnostics
      .filter((diagnostic) => diagnosticTouchesRange(diagnostic, rangeFrom, rangeTo))
      .map((diagnostic) => diagnostic.code)
    if (errorCodes.length === 0) {
      return []
    }

    const fixes = this.environment.languageService.getCodeFixesAtPosition(
      virtualPath,
      rangeFrom,
      rangeTo,
      [...new Set(errorCodes)],
      {
        indentSize: 2,
        tabSize: 2,
        convertTabsToSpaces: true,
        newLineCharacter: '\n',
        semicolons: ts.SemicolonPreference.Remove
      },
      {
        includeCompletionsForModuleExports: true,
        includePackageJsonAutoImports: 'off',
        importModuleSpecifierPreference: 'relative',
        quotePreference: 'single'
      }
    )

    return fixes
      .flatMap((fix) => {
        if (
          fix.commands?.length ||
          fix.changes.length === 0 ||
          fix.changes.some((change) => change.fileName !== virtualPath || change.isNewFile)
        ) {
          return []
        }
        const edits = fix.changes.flatMap((change) =>
          change.textChanges.map((textChange) => ({
            from: textChange.span.start,
            to: textChange.span.start + textChange.span.length,
            insert: textChange.newText
          }))
        )
        if (
          !changesAreNonOverlapping(edits) ||
          !editsPreserveImportPolicy(sourceFile.text, edits)
        ) {
          return []
        }
        return [
          {
            id: fix.fixName,
            title: fix.description,
            edits: edits.sort((left, right) => left.from - right.from || left.to - right.to)
          }
        ]
      })
      .slice(0, MAX_CODE_ACTIONS)
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

function deduplicateReferences(references: InteractiveReference[]): InteractiveReference[] {
  const seen = new Set<string>()
  return references.filter((reference) => {
    const key = `${reference.relativePath}\0${reference.from}\0${reference.to}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function isValidTypeScriptIdentifier(value: string): boolean {
  if (value.length === 0 || value.length > MAX_RENAME_NAME_LENGTH) {
    return false
  }
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    value
  )
  return (
    scanner.scan() === ts.SyntaxKind.Identifier && scanner.scan() === ts.SyntaxKind.EndOfFileToken
  )
}

function diagnosticTouchesRange(diagnostic: ts.Diagnostic, from: number, to: number): boolean {
  if (diagnostic.start === undefined) {
    return false
  }
  const diagnosticTo = diagnostic.start + (diagnostic.length ?? 0)
  return to === from
    ? diagnostic.start <= from && diagnosticTo >= from
    : diagnostic.start < to && diagnosticTo > from
}

function changesAreNonOverlapping(edits: InteractiveTextEdit[]): boolean {
  const sorted = [...edits].sort((left, right) => left.from - right.from || left.to - right.to)
  return sorted.every((edit, index) => index === 0 || edit.from >= (sorted[index - 1]?.to ?? 0))
}

function editsPreserveImportPolicy(source: string, edits: InteractiveTextEdit[]): boolean {
  let updated = source
  for (const edit of [...edits].sort((left, right) => right.from - left.from)) {
    updated = `${updated.slice(0, edit.from)}${edit.insert}${updated.slice(edit.to)}`
  }
  return ts
    .preProcessFile(updated, true, true)
    .importedFiles.every((importedFile) => getImportPolicyError('', importedFile.fileName) === null)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
