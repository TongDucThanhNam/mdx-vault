import type { PreviewWarning } from './preview-metadata'

export interface MdxCompileWorkerRequest {
  requestId: string
  source: string
}

export interface MdxCompileWorkerResult {
  code: string
  warnings: PreviewWarning[]
}

export interface MdxCompileWorkerDiagnostic {
  message: string
  line?: number
  column?: number
  source?: string
  ruleId?: string
}

export type MdxCompileWorkerResponse =
  | {
      type: 'result'
      requestId: string
      result: MdxCompileWorkerResult
    }
  | {
      type: 'error'
      requestId: string
      diagnostic: MdxCompileWorkerDiagnostic
    }
