import type { InteractiveProjectSnapshot } from './interactive-authoring'
import type {
  InteractiveCodeAction,
  InteractiveCompletion,
  InteractiveCompletionDetails,
  InteractiveDefinition,
  InteractiveHover,
  InteractiveReferenceResult,
  InteractiveRenameResult,
  InteractiveSignatureHelp
} from './interactive-language'

interface InteractiveLanguageRequestBase {
  requestId: string
  projectId: string
  version: number
}

export type InteractiveLanguageRequest =
  | (InteractiveLanguageRequestBase & {
      operation: 'initialize'
      snapshot: InteractiveProjectSnapshot
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'update'
      relativePath: string
      content: string
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'diagnostics'
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'completion'
      relativePath: string
      position: number
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'completion-details'
      relativePath: string
      position: number
      completion: Pick<InteractiveCompletion, 'name' | 'source' | 'data'>
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'hover'
      relativePath: string
      position: number
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'signature'
      relativePath: string
      position: number
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'definition'
      relativePath: string
      position: number
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'references'
      relativePath: string
      position: number
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'rename'
      relativePath: string
      position: number
      newName?: string
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'code-actions'
      relativePath: string
      from: number
      to: number
    })
  | (InteractiveLanguageRequestBase & {
      operation: 'dispose'
    })

export interface InteractiveLanguageResultMap {
  initialize: { ready: true }
  update: { updated: true }
  diagnostics: ReturnType<
    import('./interactive-language').InteractiveLanguageProject['getDiagnostics']
  >
  completion: InteractiveCompletion[]
  'completion-details': InteractiveCompletionDetails | null
  hover: InteractiveHover | null
  signature: InteractiveSignatureHelp | null
  definition: InteractiveDefinition[]
  references: InteractiveReferenceResult
  rename: InteractiveRenameResult
  'code-actions': InteractiveCodeAction[]
  dispose: { disposed: true }
}

export type InteractiveLanguageOperation = keyof InteractiveLanguageResultMap

export type InteractiveLanguageResponse =
  | {
      type: 'result'
      requestId: string
      projectId: string
      version: number
      operation: InteractiveLanguageOperation
      result: InteractiveLanguageResultMap[InteractiveLanguageOperation]
    }
  | {
      type: 'error'
      requestId: string
      projectId: string
      version: number
      operation: InteractiveLanguageOperation
      code:
        | 'INVALID_REQUEST'
        | 'PROJECT_NOT_INITIALIZED'
        | 'PROJECT_MISMATCH'
        | 'STALE_VERSION'
        | 'WORKER_FAILURE'
      message: string
    }
