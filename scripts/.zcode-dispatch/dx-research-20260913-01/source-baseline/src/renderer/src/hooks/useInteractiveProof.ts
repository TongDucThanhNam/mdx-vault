import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type {
  InteractiveDiagnostic,
  InteractiveProjectSnapshot
} from '../../../shared/interactive-authoring'
import {
  canAutoRunNormally,
  INITIAL_INTERACTIVE_PROOF_RUNTIME,
  type InteractiveProofState,
  reduceInteractiveProofRuntime,
  validateInteractivePreviewProps
} from '../../../shared/interactive-proof'
import type { SandboxDocument } from '../../../shared/sandbox'

interface UseInteractiveProofOptions {
  projectRoot: string
  snapshot: InteractiveProjectSnapshot | null
  savedFingerprint: string
  getSavedFingerprint: () => string
  activeIsDirty: boolean
  starterConsented: boolean
  consumeStarterConsent: () => void
  saveActiveFile: () => Promise<boolean>
}

export interface InteractiveProofController {
  state: InteractiveProofState
  document: SandboxDocument | null
  diagnostics: InteractiveDiagnostic[]
  propsText: string
  renderedProps: Record<string, unknown>
  hasLastGoodWithNewerIssues: boolean
  setPropsText: (value: string) => void
  run: () => Promise<void>
  refresh: () => Promise<void>
  stop: () => void
  onFrameReady: () => void
  onRuntimeError: (error: {
    kind: 'error' | 'unhandledrejection'
    message: string
    stack: string | null
  }) => void
}

export function useInteractiveProof({
  projectRoot,
  snapshot,
  savedFingerprint,
  getSavedFingerprint,
  activeIsDirty,
  starterConsented,
  consumeStarterConsent,
  saveActiveFile
}: UseInteractiveProofOptions): InteractiveProofController {
  const [runtime, dispatchRuntime] = useReducer(
    reduceInteractiveProofRuntime,
    INITIAL_INTERACTIVE_PROOF_RUNTIME
  )
  const [propsText, setPropsText] = useState('{}')
  const [renderedProps, setRenderedProps] = useState<Record<string, unknown>>({})
  const consentRef = useRef(false)
  const stoppedRef = useRef(false)
  const requestRef = useRef(0)
  const permissionEpochRef = useRef(0)
  const lastAttemptFingerprintRef = useRef<string | null>(null)
  const snapshotRef = useRef(snapshot)
  const propsTextRef = useRef(propsText)
  snapshotRef.current = snapshot
  propsTextRef.current = propsText

  useEffect(() => {
    requestRef.current += 1
    consentRef.current = false
    stoppedRef.current = false
    lastAttemptFingerprintRef.current = null
    permissionEpochRef.current += 1
    dispatchRuntime({ type: 'reset' })
    setPropsText('{}')
    setRenderedProps({})
  }, [projectRoot])

  const prepareProof = useCallback(async (): Promise<void> => {
    const activeSnapshot = snapshotRef.current
    if (!activeSnapshot) {
      dispatchRuntime({
        type: 'compile-issues',
        diagnostics: [
          createProofDiagnostic('PROJECT_NOT_READY', 'Interactive project is still loading.')
        ]
      })
      return
    }
    if (!(await saveActiveFile())) {
      dispatchRuntime({
        type: 'compile-issues',
        diagnostics: [createProofDiagnostic('SAVE_FAILED', 'Save failed; proof was not refreshed.')]
      })
      return
    }

    const attemptFingerprint = `${getSavedFingerprint()}\0${propsTextRef.current}`
    const propsResult = validateInteractivePreviewProps(activeSnapshot, propsTextRef.current)
    if (!propsResult.ok) {
      dispatchRuntime({ type: 'compile-issues', diagnostics: propsResult.diagnostics })
      lastAttemptFingerprintRef.current = attemptFingerprint
      return
    }

    const request = requestRef.current + 1
    requestRef.current = request
    dispatchRuntime({ type: 'checking' })
    lastAttemptFingerprintRef.current = attemptFingerprint
    let result: Awaited<ReturnType<typeof window.sandboxApi.loadAuthoringProof>>
    try {
      result = await window.sandboxApi.loadAuthoringProof(
        projectRoot,
        window.crypto.randomUUID(),
        propsResult.props
      )
    } catch (error) {
      if (request !== requestRef.current) {
        return
      }
      dispatchRuntime({
        type: 'compile-issues',
        diagnostics: [
          createProofDiagnostic(
            'PROOF_LOAD_FAILED',
            error instanceof Error ? error.message : String(error)
          )
        ]
      })
      return
    }
    if (request !== requestRef.current) {
      return
    }
    if (result.status === 'issues') {
      dispatchRuntime({ type: 'compile-issues', diagnostics: result.diagnostics })
      return
    }

    dispatchRuntime({ type: 'document-accepted', document: result.document })
    setRenderedProps(propsResult.props)
  }, [getSavedFingerprint, projectRoot, saveActiveFile])

  const run = useCallback(async (): Promise<void> => {
    consentRef.current = true
    stoppedRef.current = false
    await prepareProof()
  }, [prepareProof])

  const refresh = useCallback(async (): Promise<void> => {
    consentRef.current = true
    stoppedRef.current = false
    await prepareProof()
  }, [prepareProof])

  const stop = useCallback((): void => {
    requestRef.current += 1
    stoppedRef.current = true
    dispatchRuntime({ type: 'stop' })
  }, [])

  useEffect(() => {
    if (!starterConsented || !snapshot || consentRef.current) {
      return
    }
    consentRef.current = true
    consumeStarterConsent()
    void prepareProof()
  }, [consumeStarterConsent, prepareProof, snapshot, starterConsented])

  useEffect(() => {
    if (
      starterConsented ||
      !snapshot ||
      activeIsDirty ||
      consentRef.current ||
      stoppedRef.current
    ) {
      return
    }

    const epoch = permissionEpochRef.current + 1
    permissionEpochRef.current = epoch
    void window.sandboxApi
      .describeInteractive(projectRoot, null)
      .then((descriptor) => {
        if (
          epoch !== permissionEpochRef.current ||
          consentRef.current ||
          stoppedRef.current ||
          !canAutoRunNormally(descriptor.permissionStatus, activeIsDirty)
        ) {
          return
        }
        consentRef.current = true
        void prepareProof()
      })
      .catch(() => {
        // A missing/invalid manifest is already represented in project diagnostics.
      })

    return () => {
      permissionEpochRef.current += 1
    }
  }, [activeIsDirty, prepareProof, projectRoot, savedFingerprint, snapshot, starterConsented])

  useEffect(() => {
    if (!consentRef.current || stoppedRef.current || !snapshot) {
      return
    }
    const fingerprint = `${savedFingerprint}\0${propsText}`
    if (
      lastAttemptFingerprintRef.current === null ||
      lastAttemptFingerprintRef.current === fingerprint
    ) {
      return
    }
    const timer = window.setTimeout(() => {
      void prepareProof()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [prepareProof, propsText, savedFingerprint, snapshot])

  const onFrameReady = useCallback((): void => {
    dispatchRuntime({ type: 'frame-ready' })
  }, [])

  const onRuntimeError = useCallback(
    (error: {
      kind: 'error' | 'unhandledrejection'
      message: string
      stack: string | null
    }): void => {
      dispatchRuntime({
        type: 'runtime-issue',
        diagnostic: {
          source: 'runtime',
          severity: 'error',
          code: error.kind === 'error' ? 'RUNTIME_ERROR' : 'UNHANDLED_REJECTION',
          message: error.message,
          relativePath: `${projectRoot}/component.tsx`,
          from: null,
          to: null,
          line: null,
          column: null
        }
      })
    },
    [projectRoot]
  )

  return {
    state: runtime.state,
    document: runtime.document,
    diagnostics: runtime.diagnostics,
    propsText,
    renderedProps,
    hasLastGoodWithNewerIssues: runtime.document !== null && runtime.state === 'compile-issue',
    setPropsText,
    run,
    refresh,
    stop,
    onFrameReady,
    onRuntimeError
  }
}

function createProofDiagnostic(code: string, message: string): InteractiveDiagnostic {
  return {
    source: 'project',
    severity: 'error',
    code,
    message,
    relativePath: null,
    from: null,
    to: null,
    line: null,
    column: null
  }
}
