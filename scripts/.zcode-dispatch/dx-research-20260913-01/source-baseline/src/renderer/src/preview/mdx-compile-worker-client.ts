import type {
  MdxCompileWorkerDiagnostic,
  MdxCompileWorkerRequest,
  MdxCompileWorkerResponse,
  MdxCompileWorkerResult
} from './mdx-compile-protocol'

type WorkerFactory = () => Worker

interface PendingCompile {
  resolve: (result: MdxCompileWorkerResult) => void
  reject: (error: Error) => void
}

export class MdxCompileWorkerClient {
  private worker: Worker | null = null
  private sequence = 0
  private readonly pending = new Map<string, PendingCompile>()

  constructor(
    private readonly createWorker: WorkerFactory = () =>
      new Worker(new URL('./mdx-compile.worker.ts', import.meta.url), {
        name: 'mdx-vault-preview-compiler',
        type: 'module'
      })
  ) {}

  compile(source: string): Promise<MdxCompileWorkerResult> {
    const worker = this.ensureWorker()
    const requestId = this.nextRequestId()
    const request: MdxCompileWorkerRequest = { requestId, source }

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      worker.postMessage(request)
    })
  }

  terminate(reason = 'MDX compiler worker stopped'): void {
    this.worker?.terminate()
    this.worker = null

    for (const request of this.pending.values()) {
      request.reject(new Error(reason))
    }
    this.pending.clear()
  }

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker
    }

    const worker = this.createWorker()
    worker.addEventListener('message', this.handleMessage)
    worker.addEventListener('error', this.handleError)
    this.worker = worker
    return worker
  }

  private readonly handleMessage = (event: MessageEvent<MdxCompileWorkerResponse>): void => {
    const response = event.data
    const request = this.pending.get(response.requestId)

    if (!request) {
      return
    }

    this.pending.delete(response.requestId)

    if (response.type === 'error') {
      request.reject(createWorkerDiagnosticError(response.diagnostic))
      return
    }

    request.resolve(response.result)
  }

  private readonly handleError = (event: ErrorEvent): void => {
    const location = event.filename
      ? ` (${event.filename}${event.lineno ? `:${event.lineno}:${event.colno}` : ''})`
      : ''
    this.terminate(`${event.message || 'MDX compiler worker crashed'}${location}`)
  }

  private nextRequestId(): string {
    this.sequence += 1
    return `mdx-compile-${this.sequence}`
  }
}

function createWorkerDiagnosticError(diagnostic: MdxCompileWorkerDiagnostic): Error {
  return Object.assign(new Error(diagnostic.message), {
    ...(diagnostic.line === undefined ? {} : { line: diagnostic.line }),
    ...(diagnostic.column === undefined ? {} : { column: diagnostic.column }),
    ...(diagnostic.source === undefined ? {} : { source: diagnostic.source }),
    ...(diagnostic.ruleId === undefined ? {} : { ruleId: diagnostic.ruleId })
  })
}
