import { z } from 'zod'
import { sandboxManifestSchema } from './sandbox'

export const INTERACTIVE_PROJECT_MAX_FILES = 128
export const INTERACTIVE_PROJECT_MAX_FILE_BYTES = 5 * 1024 * 1024
export const INTERACTIVE_PROJECT_MAX_TOTAL_BYTES = 10 * 1024 * 1024

const restrictedSegments = new Set(['.app', '.trash', '.git', 'node_modules'])
const interactiveSourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json'])
export const interactiveDisplayNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, 'Display name is required')
      .refine(
        (value) => Array.from(value).length <= 80,
        'Display name must be 80 characters or less'
      )
  )
export const interactiveSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase kebab-case')
const vaultRelativePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => isSafeRelativePath(value), 'Path must be vault-relative and unrestricted')

export const interactiveStarterSchema = z.enum(['blank', 'stateful-control'])
export type InteractiveStarter = z.infer<typeof interactiveStarterSchema>

export const interactiveDiagnosticSchema = z
  .object({
    source: z.enum(['typescript', 'esbuild', 'manifest', 'runtime', 'props', 'project']),
    severity: z.enum(['error', 'warning', 'info']),
    code: z.string().min(1).max(128),
    message: z.string().min(1).max(16_384),
    relativePath: z.string().min(1).max(1024).nullable(),
    from: z.number().int().nonnegative().nullable(),
    to: z.number().int().nonnegative().nullable(),
    line: z.number().int().positive().nullable(),
    column: z.number().int().positive().nullable()
  })
  .strict()

export type InteractiveDiagnostic = z.infer<typeof interactiveDiagnosticSchema>

export const interactiveCreatePayloadSchema = z
  .object({
    noteRelativePath: vaultRelativePathSchema.refine(
      (value) => value.toLowerCase().endsWith('.md') || value.toLowerCase().endsWith('.mdx'),
      'Interactive creation requires an editable Markdown note'
    ),
    insertionOffset: z.number().int().nonnegative().max(INTERACTIVE_PROJECT_MAX_FILE_BYTES),
    expectedContentHash: z.string().regex(/^[a-f0-9]{64}$/),
    displayName: interactiveDisplayNameSchema,
    slug: interactiveSlugSchema,
    starter: interactiveStarterSchema
  })
  .strict()

export type InteractiveCreatePayload = z.infer<typeof interactiveCreatePayloadSchema>

export const interactiveCreateResultSchema = z
  .object({
    noteRelativePath: vaultRelativePathSchema,
    noteContent: z.string().max(INTERACTIVE_PROJECT_MAX_FILE_BYTES),
    projectRoot: vaultRelativePathSchema,
    componentRelativePath: vaultRelativePathSchema,
    insertedSource: z.string().min(1).max(1024),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/)
  })
  .strict()

export type InteractiveCreateResult = z.infer<typeof interactiveCreateResultSchema>

export type InteractiveProjectFileKind = 'source' | 'manifest' | 'readme'

export interface InteractiveProjectPath {
  projectRoot: string
  projectName: string
  relativePath: string
  projectRelativePath: string
  kind: InteractiveProjectFileKind
}

export interface InteractiveProjectFile {
  relativePath: string
  content: string
}

export interface InteractiveProjectSnapshot {
  projectRoot: string
  projectId: string
  version: number
  files: InteractiveProjectFile[]
  diagnostics: InteractiveDiagnostic[]
}

interface CreateInteractiveProjectSnapshotInput {
  projectRoot: string
  version: number
  files: InteractiveProjectFile[]
}

interface InteractiveStarterInput {
  displayName: string
  slug: string
  starter: InteractiveStarter
}

export interface InteractiveStarterFiles {
  component: string
  manifest: string
  readme: string
}

interface InteractiveInsertionInput {
  noteRelativePath: string
  noteContent: string
  insertionOffset: number
  projectRoot: string
}

export interface InteractiveInsertionPlan {
  content: string
  src: string
  tag: string
  insertionOffset: number
}

export function deriveInteractiveSlug(displayName: string): string {
  const normalized = displayName
    .trim()
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'D')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')

  return normalized || 'interactive'
}

export function createInteractiveStarter(input: InteractiveStarterInput): InteractiveStarterFiles {
  const displayName = interactiveDisplayNameSchema.parse(input.displayName)
  const slug = interactiveSlugSchema.parse(input.slug)
  const starter = interactiveStarterSchema.parse(input.starter)
  const componentName = slug
    .split('-')
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('')
  const label = JSON.stringify(displayName)
  const component =
    starter === 'stateful-control'
      ? `import { useState } from 'react'

export interface ${componentName}Props {}

export default function ${componentName}(_props: ${componentName}Props) {
  const [value, setValue] = useState(0)

  return (
    <section aria-label={${label}}>
      <p>${displayName}: {value}</p>
      <button type="button" onClick={() => setValue((current) => current + 1)}>
        Increase
      </button>
    </section>
  )
}
`
      : `export interface ${componentName}Props {}

export default function ${componentName}(_props: ${componentName}Props) {
  return (
    <section aria-label={${label}}>
      <p>${displayName}</p>
    </section>
  )
}
`
  const manifest = sandboxManifestSchema.parse({
    name: displayName,
    version: '1.0.0',
    runtime: 'react',
    permissions: {
      network: false,
      filesystem: false,
      dataPaths: []
    },
    propsSchema: {},
    dependencies: {
      react: '^19.0.0',
      'react-dom': '^19.0.0'
    }
  })
  const readme = `# ${displayName}

This interactive was created manually in mdx-vault.

## Authoring safety

The component runs in an isolated proof with network, filesystem, and vault data access disabled by default. Review its source and manifest before using it from a note.

## Files

- \`component.tsx\` — React source
- \`manifest.json\` — runtime, props, dependencies, and permissions
- \`README.md\` — assumptions and author notes
`

  return {
    component,
    manifest: `${JSON.stringify(manifest, null, 2)}\n`,
    readme
  }
}

export function planInteractiveNoteInsertion(
  input: InteractiveInsertionInput
): InteractiveInsertionPlan {
  const noteRelativePath = normalizeSafeRelativePath(input.noteRelativePath)
  const projectRoot = normalizeSafeRelativePath(input.projectRoot)

  if (!projectRoot.startsWith('interactives/')) {
    throw new Error('Interactive destination must stay under interactives/')
  }
  if (
    !Number.isInteger(input.insertionOffset) ||
    input.insertionOffset < 0 ||
    input.insertionOffset > input.noteContent.length
  ) {
    throw new Error('Insertion offset is outside the note')
  }
  if (!isUtf16Boundary(input.noteContent, input.insertionOffset)) {
    throw new Error('Insertion offset must be a valid UTF-16 boundary')
  }

  const noteDirectory = dirnamePosix(noteRelativePath)
  const relative = relativePosix(noteDirectory, projectRoot)
  const src = relative.startsWith('.') ? relative : `./${relative}`
  const tag = `<Interactive src="${src}" />`
  const eol = input.noteContent.includes('\r\n') ? '\r\n' : '\n'
  const before = input.noteContent.slice(0, input.insertionOffset)
  const after = input.noteContent.slice(input.insertionOffset)
  const prefix =
    before.length === 0 || before.endsWith(`${eol}${eol}`)
      ? ''
      : before.endsWith(eol)
        ? eol
        : `${eol}${eol}`
  const suffix =
    after.length === 0
      ? eol
      : after.startsWith(`${eol}${eol}`)
        ? ''
        : after.startsWith(eol)
          ? eol
          : `${eol}${eol}`

  return {
    content: `${before}${prefix}${tag}${suffix}${after}`,
    src,
    tag,
    insertionOffset: before.length + prefix.length
  }
}

export function resolveInteractiveProjectPath(relativePath: string): InteractiveProjectPath | null {
  if (!isSafeRelativePath(relativePath)) {
    return null
  }

  const normalized = normalizePosixPath(relativePath)
  const segments = normalized.split('/')
  if (segments.length < 3 || segments[0] !== 'interactives') {
    return null
  }

  const projectName = segments[1]
  if (!projectName || projectName.startsWith('.') || restrictedSegments.has(projectName)) {
    return null
  }
  if (segments.some((segment, index) => index > 1 && restrictedSegments.has(segment))) {
    return null
  }

  const projectRelativePath = segments.slice(2).join('/')
  const basename = basenamePosix(projectRelativePath)
  const extension = extnamePosix(projectRelativePath).toLowerCase()
  const kind: InteractiveProjectFileKind | null =
    projectRelativePath === 'manifest.json'
      ? 'manifest'
      : projectRelativePath === 'README.md'
        ? 'readme'
        : interactiveSourceExtensions.has(extension)
          ? 'source'
          : null

  if (!kind || basename.startsWith('.')) {
    return null
  }

  return {
    projectRoot: `interactives/${projectName}`,
    projectName,
    relativePath: normalized,
    projectRelativePath,
    kind
  }
}

export function createInteractiveProjectSnapshot(
  input: CreateInteractiveProjectSnapshotInput
): InteractiveProjectSnapshot {
  const projectRoot = normalizeSafeRelativePath(input.projectRoot)
  const rootParts = projectRoot.split('/')
  if (
    rootParts.length !== 2 ||
    rootParts[0] !== 'interactives' ||
    !rootParts[1] ||
    rootParts[1].startsWith('.') ||
    restrictedSegments.has(rootParts[1])
  ) {
    throw new Error('Interactive project root is invalid')
  }
  if (!Number.isInteger(input.version) || input.version < 0) {
    throw new Error('Interactive project version must be a non-negative integer')
  }
  if (input.files.length > INTERACTIVE_PROJECT_MAX_FILES) {
    throw new Error(`Interactive project cannot exceed ${INTERACTIVE_PROJECT_MAX_FILES} files`)
  }

  const seen = new Set<string>()
  let totalBytes = 0
  const files = input.files.map((file) => {
    const fullPath = normalizeSafeRelativePath(`${projectRoot}/${file.relativePath}`)
    const resolved = resolveInteractiveProjectPath(fullPath)
    if (!resolved || resolved.projectRoot !== projectRoot) {
      throw new Error(
        `Interactive project file is outside the supported grammar: ${file.relativePath}`
      )
    }
    if (seen.has(resolved.projectRelativePath.toLowerCase())) {
      throw new Error(`Interactive project contains a duplicate path: ${file.relativePath}`)
    }
    seen.add(resolved.projectRelativePath.toLowerCase())

    const bytes = utf8ByteLength(file.content)
    if (bytes > INTERACTIVE_PROJECT_MAX_FILE_BYTES) {
      throw new Error('Interactive project file exceeds the 5 MiB text-file limit')
    }
    totalBytes += bytes
    if (totalBytes > INTERACTIVE_PROJECT_MAX_TOTAL_BYTES) {
      throw new Error('Interactive project snapshot exceeds the 10 MiB total limit')
    }

    return {
      relativePath: resolved.projectRelativePath,
      content: file.content
    }
  })

  const diagnostics = validateSnapshotManifest(projectRoot, files)

  return {
    projectRoot,
    projectId: projectRoot,
    version: input.version,
    files,
    diagnostics
  }
}

function validateSnapshotManifest(
  projectRoot: string,
  files: InteractiveProjectFile[]
): InteractiveDiagnostic[] {
  const manifest = files.find((file) => file.relativePath === 'manifest.json')
  if (!manifest) {
    return [
      createDiagnostic({
        code: 'MANIFEST_MISSING',
        message: 'manifest.json is missing. Create or restore it to run an isolated proof.',
        relativePath: `${projectRoot}/manifest.json`
      })
    ]
  }

  try {
    const parsed = sandboxManifestSchema.safeParse(JSON.parse(manifest.content))
    if (parsed.success) {
      return []
    }

    return parsed.error.issues.map((issue) => {
      const key = issue.path.find((part): part is string => typeof part === 'string')
      const range = key ? findJsonKeyRange(manifest.content, key) : null
      return createDiagnostic({
        code: 'MANIFEST_INVALID',
        message: `${issue.path.join('.') || 'manifest'}: ${issue.message}`,
        relativePath: `${projectRoot}/manifest.json`,
        content: manifest.content,
        from: range?.from ?? null,
        to: range?.to ?? null
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'manifest.json is not valid JSON'
    const position = getJsonErrorPosition(message)
    return [
      createDiagnostic({
        code: 'MANIFEST_INVALID',
        message,
        relativePath: `${projectRoot}/manifest.json`,
        content: manifest.content,
        from: position,
        to: position === null ? null : Math.min(position + 1, manifest.content.length)
      })
    ]
  }
}

function createDiagnostic({
  code,
  message,
  relativePath,
  content,
  from = null,
  to = null
}: {
  code: string
  message: string
  relativePath: string
  content?: string
  from?: number | null
  to?: number | null
}): InteractiveDiagnostic {
  const location = content && from !== null ? getOffsetLocation(content, from) : null
  return {
    source: 'manifest',
    severity: 'error',
    code,
    message,
    relativePath,
    from,
    to,
    line: location?.line ?? null,
    column: location?.column ?? null
  }
}

export function getJsonErrorPosition(message: string): number | null {
  const positionMatch = /\b(?:at\s+)?position\s+(\d+)\b/i.exec(message)
  return positionMatch ? Number(positionMatch[1]) : null
}

function findJsonKeyRange(content: string, key: string): { from: number; to: number } | null {
  const needle = JSON.stringify(key)
  const from = content.indexOf(needle)
  return from === -1 ? null : { from, to: from + needle.length }
}

function getOffsetLocation(content: string, offset: number): { line: number; column: number } {
  const before = content.slice(0, offset)
  const lines = before.split(/\r\n|\r|\n/)
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1
  }
}

function normalizeSafeRelativePath(relativePath: string): string {
  if (!isSafeRelativePath(relativePath)) {
    throw new Error('Path must be vault-relative and unrestricted')
  }
  return normalizePosixPath(relativePath)
}

function isSafeRelativePath(relativePath: string): boolean {
  if (
    !relativePath ||
    relativePath.includes('\\') ||
    relativePath.includes('\0') ||
    relativePath.startsWith('/') ||
    /^[a-zA-Z]:/.test(relativePath)
  ) {
    return false
  }

  const normalized = normalizePosixPath(relativePath)
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    return false
  }

  return relativePath
    .split('/')
    .every(
      (segment) =>
        segment &&
        segment !== '.' &&
        segment !== '..' &&
        !segment.startsWith('.') &&
        !restrictedSegments.has(segment)
    )
}

function isUtf16Boundary(value: string, offset: number): boolean {
  if (offset <= 0 || offset >= value.length) {
    return true
  }
  const previous = value.charCodeAt(offset - 1)
  const current = value.charCodeAt(offset)
  return !(previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff)
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function normalizePosixPath(value: string): string {
  const parts: string[] = []
  for (const segment of value.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      parts.pop()
      continue
    }
    parts.push(segment)
  }
  return parts.join('/')
}

function dirnamePosix(value: string): string {
  const normalized = normalizePosixPath(value)
  const separator = normalized.lastIndexOf('/')
  return separator < 0 ? '.' : normalized.slice(0, separator)
}

function basenamePosix(value: string): string {
  const normalized = normalizePosixPath(value)
  const separator = normalized.lastIndexOf('/')
  return separator < 0 ? normalized : normalized.slice(separator + 1)
}

function extnamePosix(value: string): string {
  const basename = basenamePosix(value)
  const dot = basename.lastIndexOf('.')
  return dot <= 0 ? '' : basename.slice(dot)
}

function relativePosix(from: string, to: string): string {
  const fromParts = from === '.' ? [] : normalizePosixPath(from).split('/')
  const toParts = normalizePosixPath(to).split('/')
  let shared = 0
  while (
    shared < fromParts.length &&
    shared < toParts.length &&
    fromParts[shared] === toParts[shared]
  ) {
    shared += 1
  }
  return [
    ...Array.from({ length: fromParts.length - shared }, () => '..'),
    ...toParts.slice(shared)
  ].join('/')
}
