import type { InteractiveDiagnostic, InteractiveProjectSnapshot } from './interactive-authoring'
import { getJsonErrorPosition } from './interactive-authoring'
import {
  getSandboxPropsValidationErrors,
  INTERACTIVE_PREVIEW_PROPS_MAX_BYTES,
  type SandboxDocument,
  type SandboxManifest,
  sandboxManifestSchema
} from './sandbox'

export type InteractiveProofState =
  | 'not-run'
  | 'checking'
  | 'ready'
  | 'compile-issue'
  | 'runtime-issue'
  | 'stopped'

export const INTERACTIVE_PROOF_STATE_LABELS: Readonly<Record<InteractiveProofState, string>> = {
  'not-run': 'Not run',
  checking: 'Checking',
  ready: 'Ready',
  'compile-issue': 'Compile issue',
  'runtime-issue': 'Runtime issue',
  stopped: 'Stopped'
}

export interface InteractiveProofRuntime {
  state: InteractiveProofState
  document: SandboxDocument | null
  diagnostics: InteractiveDiagnostic[]
}

export type InteractiveProofRuntimeEvent =
  | { type: 'reset' }
  | { type: 'checking' }
  | { type: 'compile-issues'; diagnostics: InteractiveDiagnostic[] }
  | { type: 'document-accepted'; document: SandboxDocument }
  | { type: 'frame-ready' }
  | { type: 'runtime-issue'; diagnostic: InteractiveDiagnostic }
  | { type: 'stop' }

export const INITIAL_INTERACTIVE_PROOF_RUNTIME: InteractiveProofRuntime = {
  state: 'not-run',
  document: null,
  diagnostics: []
}

export function reduceInteractiveProofRuntime(
  current: InteractiveProofRuntime,
  event: InteractiveProofRuntimeEvent
): InteractiveProofRuntime {
  switch (event.type) {
    case 'reset':
      return INITIAL_INTERACTIVE_PROOF_RUNTIME
    case 'checking':
      return { ...current, state: 'checking', diagnostics: [] }
    case 'compile-issues':
      return { ...current, state: 'compile-issue', diagnostics: event.diagnostics }
    case 'document-accepted':
      return { state: 'checking', document: event.document, diagnostics: [] }
    case 'frame-ready':
      return { ...current, state: 'ready' }
    case 'runtime-issue':
      return { ...current, state: 'runtime-issue', diagnostics: [event.diagnostic] }
    case 'stop':
      return { state: 'stopped', document: null, diagnostics: [] }
  }
}

export function canAutoRunNormally(
  permissionStatus: 'allowed' | 'denied' | 'prompt',
  activeIsDirty: boolean
): boolean {
  return permissionStatus === 'allowed' && !activeIsDirty
}

export type InteractivePreviewPropsResult =
  | {
      ok: true
      props: Record<string, unknown>
      manifest: SandboxManifest
      diagnostics: []
    }
  | {
      ok: false
      diagnostics: InteractiveDiagnostic[]
    }

export function validateInteractivePreviewProps(
  snapshot: InteractiveProjectSnapshot,
  propsText: string
): InteractivePreviewPropsResult {
  if (new TextEncoder().encode(propsText).byteLength > INTERACTIVE_PREVIEW_PROPS_MAX_BYTES) {
    return invalidPreviewProps(
      snapshot.projectRoot,
      'PROPS_TOO_LARGE',
      'Preview props cannot exceed 64 KiB.'
    )
  }

  let props: unknown
  try {
    props = JSON.parse(propsText)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview props are not valid JSON'
    const position = getJsonErrorPosition(message)
    return {
      ok: false,
      diagnostics: [
        createPropsDiagnostic({
          code: 'PROPS_JSON_INVALID',
          message,
          from: position,
          to: position === null ? null : position + 1
        })
      ]
    }
  }

  const manifestFile = snapshot.files.find((file) => file.relativePath === 'manifest.json')
  if (!manifestFile) {
    return invalidPreviewProps(
      snapshot.projectRoot,
      'MANIFEST_MISSING',
      'manifest.json is required before running an isolated proof.',
      'manifest'
    )
  }

  let manifestJson: unknown
  try {
    manifestJson = JSON.parse(manifestFile.content)
  } catch {
    return invalidPreviewProps(
      snapshot.projectRoot,
      'MANIFEST_INVALID',
      'manifest.json is not valid JSON.',
      'manifest'
    )
  }
  const manifest = sandboxManifestSchema.safeParse(manifestJson)
  if (!manifest.success) {
    return {
      ok: false,
      diagnostics: manifest.error.issues.map((issue) => ({
        source: 'manifest',
        severity: 'error',
        code: 'MANIFEST_INVALID',
        message: `${issue.path.join('.') || 'manifest'}: ${issue.message}`,
        relativePath: `${snapshot.projectRoot}/manifest.json`,
        from: null,
        to: null,
        line: null,
        column: null
      }))
    }
  }

  const validationErrors = getSandboxPropsValidationErrors(manifest.data, props)
  if (validationErrors.length > 0) {
    return {
      ok: false,
      diagnostics: validationErrors.map((message) =>
        createPropsDiagnostic({
          code: 'PROPS_SCHEMA_INVALID',
          message
        })
      )
    }
  }

  return {
    ok: true,
    props: props as Record<string, unknown>,
    manifest: manifest.data,
    diagnostics: []
  }
}

function invalidPreviewProps(
  projectRoot: string,
  code: string,
  message: string,
  source: InteractiveDiagnostic['source'] = 'props'
): InteractivePreviewPropsResult {
  return {
    ok: false,
    diagnostics: [
      source === 'props'
        ? createPropsDiagnostic({ code, message })
        : {
            source,
            severity: 'error',
            code,
            message,
            relativePath: `${projectRoot}/manifest.json`,
            from: null,
            to: null,
            line: null,
            column: null
          }
    ]
  }
}

function createPropsDiagnostic({
  code,
  message,
  from = null,
  to = null
}: {
  code: string
  message: string
  from?: number | null
  to?: number | null
}): InteractiveDiagnostic {
  return {
    source: 'props',
    severity: 'error',
    code,
    message,
    relativePath: null,
    from,
    to,
    line: null,
    column: null
  }
}
