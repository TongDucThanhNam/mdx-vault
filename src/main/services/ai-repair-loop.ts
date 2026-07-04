import { AI_ERROR_CODES, type ComponentDraft } from '../../shared/ai'
import { sandboxManifestSchema, type SandboxManifest } from '../../shared/sandbox'
import { SandboxService } from './sandbox-service'
import { getCurrentVault } from './vault-session'

/**
 * Compile-repair loop for AI-generated component drafts.
 *
 * Per GOAL-06: when an action like "Make interactive" produces a fresh
 * `componentDraft`, we must run it through esbuild + the dependency allowlist
 * (see SandboxService) and, if it fails, give the diagnostics back to the
 * model so it can self-repair. Hard cap: 3 rounds; after that we surface
 * the failure to the renderer, which shows the diff review with the failing
 * draft and an explicit "compile errors prevent approval" banner.
 *
 * This file is *not* the place that calls the LLM. It runs the compile-tool
 * branch and updates the draft's `provenance.generatedAt` / repairs count.
 * The TanStack AI adapter (the only file that imports `@tanstack/*`) owns the
 * actual `chat(...)` call and uses this helper to short-circuit on success
 * or to gather diagnostics on failure.
 */

export class AiRepairExhaustedError extends Error {
  readonly code = AI_ERROR_CODES.REPAIR_EXHAUSTED
  readonly roundsAttempted: number
  readonly lastErrors: string[]

  constructor(roundsAttempted: number, lastErrors: string[]) {
    super(`Component draft could not compile after ${roundsAttempted} repair rounds`)
    this.name = 'AiRepairExhaustedError'
    this.roundsAttempted = roundsAttempted
    this.lastErrors = lastErrors
  }
}

export interface RepairAttempt {
  draft: ComponentDraft
  /** Round index, 1-based. First attempt = round 1. */
  round: number
}

export interface RepairContext {
  /** Maximum total rounds (initial + N-1 repairs). Defaults to 3 per goal file. */
  maxRounds?: number
  /** Hook so the adapter can decide what to feed back to the model. The
   *  caller passes a function that, given the failing draft + errors,
   *  returns the next draft to try. We don't run LLM here. */
  nextDraft: (draft: ComponentDraft, errors: string[]) => Promise<ComponentDraft | null>
}

export interface RepairSuccess {
  ok: true
  draft: ComponentDraft
  rounds: number
}

export interface RepairFailure {
  ok: false
  draft: ComponentDraft
  rounds: number
  lastErrors: string[]
}

export async function repairComponentDraft(
  initial: ComponentDraft,
  context: RepairContext
): Promise<RepairSuccess | RepairFailure> {
  const maxRounds = Math.max(1, context.maxRounds ?? 3)
  const sandbox = new SandboxService(getCurrentVault())
  let current: ComponentDraft = initial
  let lastErrors: string[] = []

  for (let round = 1; round <= maxRounds; round += 1) {
    const manifestValidation = parseManifestDraft(current)

    if (!manifestValidation.ok) {
      lastErrors = manifestValidation.errors

      if (round === maxRounds) {
        return { ok: false, draft: current, rounds: round, lastErrors }
      }

      const next = await context.nextDraft(current, lastErrors)
      if (!next) {
        return { ok: false, draft: current, rounds: round, lastErrors }
      }
      current = next
      continue
    }

    const verdict = await sandbox.compileDraft(current.componentSource, manifestValidation.manifest)

    if (verdict.ok) {
      return {
        ok: true,
        draft: current,
        rounds: round
      }
    }

    lastErrors = verdict.errors

    if (round === maxRounds) {
      return { ok: false, draft: current, rounds: round, lastErrors }
    }

    const next = await context.nextDraft(current, lastErrors)
    if (!next) {
      return { ok: false, draft: current, rounds: round, lastErrors }
    }
    current = next
  }

  // Unreachable; the loop either returns or continues.
  return { ok: false, draft: current, rounds: maxRounds, lastErrors }
}

/* -------------------------------------------------------------------------- */
/*                                Helpers                                     */
/* -------------------------------------------------------------------------- */

function parseManifestDraft(
  draft: ComponentDraft
): { ok: true; manifest: SandboxManifest } | { ok: false; errors: string[] } {
  let parsed: unknown

  try {
    parsed = JSON.parse(draft.manifestJson)
  } catch (error) {
    return {
      ok: false,
      errors: [
        `manifest.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      ]
    }
  }

  const validation = sandboxManifestSchema.safeParse(parsed)

  if (!validation.success) {
    return {
      ok: false,
      errors: validation.error.issues.map(
        (issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`
      )
    }
  }

  return { ok: true, manifest: validation.data }
}

/** Marker for grep-able review. */
export const AI_REPAIR_LOOP_MARKER = 'mdx-vault-ai-repair-loop:v1'
