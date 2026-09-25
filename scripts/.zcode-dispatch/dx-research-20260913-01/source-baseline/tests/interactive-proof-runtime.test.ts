import { describe, expect, test } from 'bun:test'
import type { InteractiveDiagnostic } from '../src/shared/interactive-authoring'
import {
  canAutoRunNormally,
  INITIAL_INTERACTIVE_PROOF_RUNTIME,
  reduceInteractiveProofRuntime
} from '../src/shared/interactive-proof'
import type { SandboxDocument } from '../src/shared/sandbox'

const document: SandboxDocument = {
  kind: 'interactive',
  src: 'interactives/counter',
  resolvedPath: 'interactives/counter',
  contentHash: 'a'.repeat(64),
  instanceId: 'proof-one',
  documentUrl: 'mdx-vault-sandbox://document/proof-one'
}

const compileDiagnostic: InteractiveDiagnostic = {
  source: 'typescript',
  severity: 'error',
  code: 'TS2345',
  message: 'Argument of type string is not assignable to number.',
  relativePath: 'interactives/counter/component.tsx',
  from: 42,
  to: 49,
  line: 3,
  column: 7
}

describe('interactive proof runtime', () => {
  test('retains the last good proof across compile and runtime issues, then recovers', () => {
    let runtime = reduceInteractiveProofRuntime(INITIAL_INTERACTIVE_PROOF_RUNTIME, {
      type: 'checking'
    })
    runtime = reduceInteractiveProofRuntime(runtime, {
      type: 'document-accepted',
      document
    })
    runtime = reduceInteractiveProofRuntime(runtime, { type: 'frame-ready' })
    expect(runtime).toMatchObject({ state: 'ready', document })

    runtime = reduceInteractiveProofRuntime(runtime, {
      type: 'compile-issues',
      diagnostics: [compileDiagnostic]
    })
    expect(runtime).toMatchObject({
      state: 'compile-issue',
      document,
      diagnostics: [compileDiagnostic]
    })

    const runtimeDiagnostic = {
      ...compileDiagnostic,
      source: 'runtime' as const,
      code: 'UNHANDLED_REJECTION'
    }
    runtime = reduceInteractiveProofRuntime(runtime, {
      type: 'runtime-issue',
      diagnostic: runtimeDiagnostic
    })
    expect(runtime).toMatchObject({
      state: 'runtime-issue',
      document,
      diagnostics: [runtimeDiagnostic]
    })

    const recoveredDocument = { ...document, instanceId: 'proof-two' }
    runtime = reduceInteractiveProofRuntime(runtime, {
      type: 'document-accepted',
      document: recoveredDocument
    })
    runtime = reduceInteractiveProofRuntime(runtime, { type: 'frame-ready' })
    expect(runtime).toEqual({
      state: 'ready',
      document: recoveredDocument,
      diagnostics: []
    })
  })

  test('Stop clears executable state and reset requires a new consent decision', () => {
    const ready = {
      state: 'ready' as const,
      document,
      diagnostics: []
    }
    expect(reduceInteractiveProofRuntime(ready, { type: 'stop' })).toEqual({
      state: 'stopped',
      document: null,
      diagnostics: []
    })
    expect(reduceInteractiveProofRuntime(ready, { type: 'reset' })).toEqual(
      INITIAL_INTERACTIVE_PROOF_RUNTIME
    )
  })

  test('normal permission auto-run requires an exact allowed descriptor and a clean buffer', () => {
    expect(canAutoRunNormally('allowed', false)).toBe(true)
    expect(canAutoRunNormally('allowed', true)).toBe(false)
    expect(canAutoRunNormally('prompt', false)).toBe(false)
    expect(canAutoRunNormally('denied', false)).toBe(false)
  })
})
