import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TextFileRevealRequest } from '@/editor/TextFileEditor'
import type { InteractiveCodeIntelligence } from '@/interactive/interactive-code-intelligence'
import { InteractiveLanguageWorkerClient } from '@/interactive/interactive-language-client'
import { navigateInteractiveProblem } from '@/interactive/interactive-problem-navigation'
import type { VaultTreeFile } from '@/vault/types'
import {
  createInteractiveProjectSnapshot,
  type InteractiveDiagnostic,
  type InteractiveProjectSnapshot,
  resolveInteractiveProjectPath
} from '../../../shared/interactive-authoring'
import type {
  InteractiveDefinition,
  InteractiveReference
} from '../../../shared/interactive-language'

type TypeIntelligenceStatus = 'idle' | 'checking' | 'ready' | 'unavailable'

interface UseInteractiveProjectOptions {
  activeRelativePath: string
  activeContent: string
  treeFiles: readonly VaultTreeFile[]
  vaultSessionId: number
  openOrActivate: (relativePath: string) => Promise<boolean>
}

export interface InteractiveProjectController {
  projectRoot: string
  projectName: string
  snapshot: InteractiveProjectSnapshot | null
  diagnostics: InteractiveDiagnostic[]
  intelligence: InteractiveCodeIntelligence | null
  intelligenceStatus: TypeIntelligenceStatus
  intelligenceMessage: string | null
  revealRequest: TextFileRevealRequest | null
  openProblem: (diagnostic: InteractiveDiagnostic) => Promise<void>
  retryIntelligence: () => void
  metrics: {
    coldReadyMs: number | null
    firstDiagnosticsMs: number | null
    warmCompletionMs: number | null
  }
}

export function useInteractiveProject({
  activeRelativePath,
  activeContent,
  treeFiles,
  vaultSessionId,
  openOrActivate
}: UseInteractiveProjectOptions): InteractiveProjectController {
  const activeProjectPath = resolveInteractiveProjectPath(activeRelativePath)
  if (!activeProjectPath) {
    throw new Error('useInteractiveProject requires an active interactive project file')
  }
  const { projectRoot, projectName } = activeProjectPath
  const typeLanguageActive = isTypeScriptPath(activeProjectPath.projectRelativePath)
  const [snapshot, setSnapshot] = useState<InteractiveProjectSnapshot | null>(null)
  const [projectDiagnostics, setProjectDiagnostics] = useState<InteractiveDiagnostic[]>([])
  const [languageDiagnostics, setLanguageDiagnostics] = useState<InteractiveDiagnostic[]>([])
  const [intelligenceStatus, setIntelligenceStatus] = useState<TypeIntelligenceStatus>('idle')
  const [intelligenceMessage, setIntelligenceMessage] = useState<string | null>(null)
  const [clientRevision, setClientRevision] = useState(0)
  const [retryRevision, setRetryRevision] = useState(0)
  const [revealRequest, setRevealRequest] = useState<TextFileRevealRequest | null>(null)
  const [metrics, setMetrics] = useState({
    coldReadyMs: null as number | null,
    firstDiagnosticsMs: null as number | null,
    warmCompletionMs: null as number | null
  })
  const clientRef = useRef<InteractiveLanguageWorkerClient | null>(null)
  const snapshotRef = useRef<InteractiveProjectSnapshot | null>(null)
  const activeContentRef = useRef(activeContent)
  const activePathRef = useRef(activeRelativePath)
  const loadEpochRef = useRef(0)
  const versionRef = useRef(0)
  const revealSequenceRef = useRef(0)
  activeContentRef.current = activeContent
  activePathRef.current = activeRelativePath

  useEffect(() => {
    const loadEpoch = loadEpochRef.current + 1
    loadEpochRef.current = loadEpoch
    const startedAt = performance.now()
    clientRef.current?.terminate()
    clientRef.current = null
    setSnapshot(null)
    setLanguageDiagnostics([])
    setIntelligenceMessage(null)
    setIntelligenceStatus(typeLanguageActive ? 'checking' : 'idle')

    const projectFiles = treeFiles.filter((file) => {
      const resolved = resolveInteractiveProjectPath(file.relativePath)
      return resolved?.projectRoot === projectRoot
    })

    void Promise.all(
      projectFiles.map(async (file) => ({
        relativePath: file.relativePath.slice(projectRoot.length + 1),
        content:
          file.relativePath === activePathRef.current
            ? activeContentRef.current
            : await window.vaultApi.readTextFile(file.relativePath)
      }))
    )
      .then(async (files) => {
        if (loadEpoch !== loadEpochRef.current) {
          return
        }
        versionRef.current += 1
        const nextSnapshot = createInteractiveProjectSnapshot({
          projectRoot,
          version: versionRef.current,
          files
        })
        snapshotRef.current = nextSnapshot
        setSnapshot(nextSnapshot)
        setProjectDiagnostics(nextSnapshot.diagnostics)

        if (!typeLanguageActive) {
          return
        }
        const client = new InteractiveLanguageWorkerClient(undefined, (message) => {
          if (loadEpoch !== loadEpochRef.current) {
            return
          }
          setIntelligenceStatus('unavailable')
          setIntelligenceMessage(message)
          setLanguageDiagnostics([
            createUnavailableDiagnostic(projectRoot, 'TypeScript worker stopped unexpectedly.')
          ])
        })
        clientRef.current = client
        await client.initialize(nextSnapshot)
        if (loadEpoch !== loadEpochRef.current) {
          client.terminate()
          return
        }
        setMetrics((current) => ({
          ...current,
          coldReadyMs: performance.now() - startedAt
        }))
        const diagnosticsStartedAt = performance.now()
        const diagnostics = await client.diagnostics()
        if (loadEpoch !== loadEpochRef.current) {
          return
        }
        setLanguageDiagnostics(diagnostics.filter((item) => item.source === 'typescript'))
        setMetrics((current) => ({
          ...current,
          firstDiagnosticsMs: performance.now() - diagnosticsStartedAt
        }))
        setIntelligenceStatus('ready')
        setClientRevision((current) => current + 1)
      })
      .catch((error: unknown) => {
        if (loadEpoch !== loadEpochRef.current) {
          return
        }
        const message = error instanceof Error ? error.message : String(error)
        setIntelligenceStatus('unavailable')
        setIntelligenceMessage(message)
        setProjectDiagnostics([
          createUnavailableDiagnostic(projectRoot, `Interactive project unavailable: ${message}`)
        ])
      })

    return () => {
      loadEpochRef.current += 1
      clientRef.current?.terminate()
      clientRef.current = null
    }
  }, [projectRoot, retryRevision, treeFiles, typeLanguageActive, vaultSessionId])

  useEffect(() => {
    const currentSnapshot = snapshotRef.current
    const active = resolveInteractiveProjectPath(activeRelativePath)
    if (!currentSnapshot || active?.projectRoot !== projectRoot) {
      return
    }
    const currentFile = currentSnapshot.files.find(
      (file) => file.relativePath === active.projectRelativePath
    )
    if (currentFile?.content === activeContent) {
      return
    }

    const timer = window.setTimeout(() => {
      versionRef.current += 1
      const nextVersion = versionRef.current
      const files = currentSnapshot.files.filter(
        (file) => file.relativePath !== active.projectRelativePath
      )
      files.push({ relativePath: active.projectRelativePath, content: activeContent })

      let nextSnapshot: InteractiveProjectSnapshot
      try {
        nextSnapshot = createInteractiveProjectSnapshot({
          projectRoot,
          version: nextVersion,
          files
        })
      } catch (error) {
        setProjectDiagnostics([
          createUnavailableDiagnostic(
            projectRoot,
            error instanceof Error ? error.message : String(error)
          )
        ])
        return
      }
      snapshotRef.current = nextSnapshot
      setSnapshot(nextSnapshot)
      setProjectDiagnostics(nextSnapshot.diagnostics)

      if (!isTypeScriptPath(active.projectRelativePath) || !clientRef.current) {
        return
      }
      setIntelligenceStatus('checking')
      void clientRef.current
        .update(active.projectRelativePath, activeContent, nextVersion)
        .then(() => clientRef.current?.diagnostics())
        .then((diagnostics) => {
          if (!diagnostics || snapshotRef.current?.version !== nextVersion) {
            return
          }
          setLanguageDiagnostics(diagnostics.filter((item) => item.source === 'typescript'))
          setIntelligenceStatus('ready')
        })
        .catch((error: unknown) => {
          if (snapshotRef.current?.version !== nextVersion) {
            return
          }
          setIntelligenceStatus('unavailable')
          setIntelligenceMessage(error instanceof Error ? error.message : String(error))
        })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [activeContent, activeRelativePath, projectRoot])

  const navigateDefinition = useCallback(
    async (definition: InteractiveDefinition): Promise<void> => {
      if (definition.kind !== 'project' || !definition.relativePath) {
        return
      }
      if (!(await openOrActivate(definition.relativePath))) {
        return
      }
      revealSequenceRef.current += 1
      setRevealRequest({
        requestId: revealSequenceRef.current,
        from: definition.from,
        to: definition.to
      })
    },
    [openOrActivate]
  )

  const navigateReference = useCallback(
    async (reference: InteractiveReference): Promise<void> => {
      if (!(await openOrActivate(reference.relativePath))) {
        return
      }
      revealSequenceRef.current += 1
      setRevealRequest({
        requestId: revealSequenceRef.current,
        from: reference.from,
        to: reference.to
      })
    },
    [openOrActivate]
  )

  const intelligence = useMemo<InteractiveCodeIntelligence | null>(() => {
    const active = resolveInteractiveProjectPath(activeRelativePath)
    const client = clientRef.current
    if (
      !active ||
      active.projectRoot !== projectRoot ||
      !isTypeScriptPath(active.projectRelativePath) ||
      !client ||
      intelligenceStatus === 'unavailable'
    ) {
      return null
    }
    const relativePath = active.projectRelativePath
    return {
      relativePath: activeRelativePath,
      completion: async (position) => {
        const startedAt = performance.now()
        const result = await client.completion(relativePath, position)
        setMetrics((current) => ({
          ...current,
          warmCompletionMs: performance.now() - startedAt
        }))
        return result
      },
      completionDetails: (position, completion) =>
        client.completionDetails(relativePath, position, completion),
      hover: (position) => client.hover(relativePath, position),
      signature: (position) => client.signature(relativePath, position),
      definition: (position) => client.definition(relativePath, position),
      references: (position) => client.references(relativePath, position),
      rename: (position, newName) => client.rename(relativePath, position, newName),
      codeActions: (from, to) => client.codeActions(relativePath, from, to),
      navigateDefinition,
      navigateReference
    }
  }, [
    activeRelativePath,
    clientRevision,
    intelligenceStatus,
    navigateDefinition,
    navigateReference,
    projectRoot
  ])

  const openProblem = useCallback(
    async (diagnostic: InteractiveDiagnostic): Promise<void> => {
      await navigateInteractiveProblem(diagnostic, {
        openOrActivate,
        reveal: ({ from, to }) => {
          revealSequenceRef.current += 1
          setRevealRequest({
            requestId: revealSequenceRef.current,
            from,
            to
          })
        }
      })
    },
    [openOrActivate]
  )

  const retryIntelligence = useCallback((): void => {
    setRetryRevision((current) => current + 1)
  }, [])

  return {
    projectRoot,
    projectName,
    snapshot,
    diagnostics: deduplicateDiagnostics([...projectDiagnostics, ...languageDiagnostics]),
    intelligence,
    intelligenceStatus,
    intelligenceMessage,
    revealRequest,
    openProblem,
    retryIntelligence,
    metrics
  }
}

function isTypeScriptPath(relativePath: string): boolean {
  const extension = relativePath.split('.').at(-1)?.toLowerCase()
  return extension === 'ts' || extension === 'tsx'
}

function createUnavailableDiagnostic(projectRoot: string, message: string): InteractiveDiagnostic {
  return {
    source: 'project',
    severity: 'error',
    code: 'TYPE_INTELLIGENCE_UNAVAILABLE',
    message,
    relativePath: `${projectRoot}/component.tsx`,
    from: null,
    to: null,
    line: null,
    column: null
  }
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
