/**
 * Read-only tool boundary for the AI.
 *
 * Hard rules enforced by code review + this module's structure:
 *
 *   - Every tool here is purely a getter. There is intentionally no
 *     `write_note`, `write_component`, `delete_*`, `rename_*`, or `patch_*`
 *     tool. AI can only observe; writes only happen after explicit user
 *     approval via `vault:write-file` from the renderer.
 *
 *   - `read_note` is restricted to the path the user is currently editing.
 *     Hard cap of 6 KB to keep tool outputs bounded.
 *
 *   - `compile_component_draft` runs esbuild inside a temp folder, returns
 *     ok/errors, and cleans the folder up before returning. It never touches
 *     the user's `interactives/` folder or any permission store entry.
 *
 *   - This module does NOT import `@tanstack/*`. The adapter
 *     (`ai-tanstack-adapter.ts`) wraps each `AiToolSpec` in
 *     `toolDefinition({...}).server(execute)` when wiring the model. That
 *     keeps the "TanStack AI import duy nhất trong adapter module" invariant.
 */

import { z } from 'zod'

import type { SelectionRange } from '../../shared/ai'

const noteTextSchema = z
  .object({
    relativePath: z.string().min(1),
    title: z.string(),
    content: z.string().max(6144),
    byteLength: z.number().int().min(0)
  })
  .strict()

const searchHitSchema = z
  .object({
    relativePath: z.string().min(1),
    title: z.string(),
    snippet: z.string()
  })
  .strict()

const backlinkHitSchema = z
  .object({
    relativePath: z.string().min(1),
    title: z.string(),
    target: z.string(),
    display: z.string()
  })
  .strict()

const compileVerdictSchema = z
  .object({
    ok: z.boolean(),
    contentHash: z.string().optional(),
    errors: z.array(z.string()).default([])
  })
  .strict()

/**
 * Framework-free tool spec used by `ai-tools.ts`. The adapter wraps each of
 * these with TanStack AI's `toolDefinition(...).server(execute)`. We avoid
 * zod 4's input/output generics to keep the type simple — each concrete
 * tool's `execute` is checked against its schema at runtime.
 */
export interface AiToolSpec {
  /** Stable identifier exposed to the model. */
  readonly name: string
  /** Human-readable explanation for the model. */
  readonly description: string
  /** zod schema for input. */
  readonly inputSchema: z.ZodTypeAny
  /** zod schema for output. */
  readonly outputSchema: z.ZodTypeAny
  /** Pure function. No side effects outside the vault API. The adapter
   *  validates args with `inputSchema.parse(args)` before invoking. */
  readonly execute: (args: unknown) => Promise<unknown>
}

export interface AiToolContext {
  /** The note the user currently has open. Restricts `read_note`. */
  activeNoteRelativePath: string
  selection: SelectionRange | null
}

interface ReadNoteArgs {
  relativePath: string
}

interface SearchIndexArgs {
  query: string
  limit?: number
}

interface GetBacklinksArgs {
  relativePath: string
}

interface CompileComponentDraftArgs {
  componentSource: string
  manifest: unknown
}

/**
 * Build the read-only tool specs for the current assistant turn.
 *
 * The returned array is intentionally framework-free: the adapter wraps each
 * entry with TanStack AI's `toolDefinition(...).server(execute)` so this
 * file remains the single source of truth for *what* tools exist and
 * *what they can touch*.
 */
export function buildAiToolDefinitions(context: AiToolContext): AiToolSpec[] {
  const readNote: AiToolSpec = {
    name: 'read_note',
    description:
      'Read the note the user is currently editing by its vault-relative path. For security, only the currently active note is readable.',
    inputSchema: z.object({
      relativePath: z.string().min(1)
    }),
    outputSchema: noteTextSchema,
    execute: async (rawArgs: unknown) => {
      const args = rawArgs as ReadNoteArgs
      if (args.relativePath !== context.activeNoteRelativePath) {
        throw new Error('UNAUTHORIZED_PATH: only the active note is readable')
      }

      const { getCurrentVault } = await import('./vault-session')
      const vault = getCurrentVault()
      const content = await vault.readFile(args.relativePath)
      const title = firstNonEmptyLine(content) ?? args.relativePath
      const trimmed = content.length > 6144 ? `${content.slice(0, 6144)}\n\n[…truncated…]` : content

      return noteTextSchema.parse({
        relativePath: args.relativePath,
        title,
        content: trimmed,
        byteLength: content.length
      })
    }
  }

  const searchIndex: AiToolSpec = {
    name: 'search_index',
    description:
      'Search the vault index by full-text query. Returns up to `limit` matches with a body snippet. Read-only.',
    inputSchema: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(30).optional()
    }),
    outputSchema: z.array(searchHitSchema),
    execute: async (rawArgs: unknown) => {
      const args = rawArgs as SearchIndexArgs
      const { getCurrentIndex } = await import('./vault-session')
      const index = getCurrentIndex()
      const results = index.database.search(args.query, args.limit ?? 10)
      return results.map((result) =>
        searchHitSchema.parse({
          relativePath: result.note.relativePath,
          title: result.note.title,
          snippet: result.snippet
        })
      )
    }
  }

  const getBacklinks: AiToolSpec = {
    name: 'get_backlinks',
    description:
      'List notes that link to the given relative path. Read-only; backed by the SQLite backlinks index.',
    inputSchema: z.object({
      relativePath: z.string().min(1)
    }),
    outputSchema: z.array(backlinkHitSchema),
    execute: async (rawArgs: unknown) => {
      const args = rawArgs as GetBacklinksArgs
      const { getCurrentIndex } = await import('./vault-session')
      const index = getCurrentIndex()
      const backlinks = index.database.getBacklinks(args.relativePath)
      return backlinks.map((entry) =>
        backlinkHitSchema.parse({
          relativePath: entry.source.relativePath,
          title: entry.source.title,
          target: entry.target,
          display: entry.display
        })
      )
    }
  }

  const compileDraft: AiToolSpec = {
    name: 'compile_component_draft',
    description:
      'Validate that a vault-component draft (TypeScript source + manifest) compiles and passes the dependency allowlist. Runs esbuild inside an ephemeral folder; the vault is never touched and no permission entry is written. Returns `{ok:true, contentHash}` or `{ok:false, errors: string[]}` describing what to repair.',
    inputSchema: z.object({
      componentSource: z.string().min(1),
      manifest: z.unknown()
    }),
    outputSchema: compileVerdictSchema,
    execute: async (rawArgs: unknown) => {
      const args = rawArgs as CompileComponentDraftArgs
      const { sandboxManifestSchema } = await import('../../shared/sandbox')
      const parsed = sandboxManifestSchema.safeParse(args.manifest)

      if (!parsed.success) {
        return compileVerdictSchema.parse({
          ok: false,
          errors: parsed.error.issues.map(
            (issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`
          )
        })
      }

      const { getCurrentVault } = await import('./vault-session')
      const { SandboxService } = await import('./sandbox-service')
      const verdict = await new SandboxService(getCurrentVault()).compileDraft(
        args.componentSource,
        parsed.data
      )

      if (verdict.ok) {
        return compileVerdictSchema.parse({
          ok: true,
          contentHash: verdict.contentHash,
          errors: []
        })
      }

      return compileVerdictSchema.parse({
        ok: false,
        errors: verdict.errors
      })
    }
  }

  return [readNote, searchIndex, getBacklinks, compileDraft]
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function firstNonEmptyLine(text: string): string | null {
  for (const candidate of text.split(/\r?\n/)) {
    const trimmed = candidate.trim()

    if (!trimmed) {
      continue
    }

    if (trimmed.startsWith('#')) {
      return trimmed.replace(/^#+\s*/, '').trim()
    }

    return trimmed
  }

  return null
}

/** Marker so reviewers can grep for any accidental writer being smuggled in. */
export const AI_TOOL_BOUNDARY_MARKER = 'mdx-vault-ai-tools-readonly:v1'
