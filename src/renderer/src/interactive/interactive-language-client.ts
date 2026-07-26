import type { InteractiveProjectSnapshot } from '../../../shared/interactive-authoring'
import type {
  InteractiveLanguageOperation,
  InteractiveLanguageRequest,
  InteractiveLanguageResponse,
  InteractiveLanguageResultMap
} from '../../../shared/interactive-language-protocol'

type WorkerFactory = () => Worker

interface PendingRequest {
  operation: InteractiveLanguageOperation
  projectId: string
  version: number
  resolve: (result: unknown) => void
  reject: (error: Error) => void
}

export class InteractiveLanguageWorkerClient {
  private worker: Worker | null = null
  private projectId: string | null = null
  private version = 0
  private sequence = 0
  private readonly pending = new Map<string, PendingRequest>()
  private readonly latestRequestByOperation = new Map<InteractiveLanguageOperation, string>()

  constructor(
    private readonly createWorker: WorkerFactory = () =>
      new Worker(new URL('./interactive-language.worker.ts', import.meta.url), {
        name: 'mdx-vault-interactive-language',
        type: 'module'
      }),
    private readonly onCrash: (message: string) => void = () => undefined
  ) {}

  async initialize(snapshot: InteractiveProjectSnapshot): Promise<void> {
    this.terminate()
    this.projectId = snapshot.projectId
    this.version = snapshot.version
    await this.request({
      operation: 'initialize',
      requestId: this.nextRequestId(),
      projectId: snapshot.projectId,
      version: snapshot.version,
      snapshot
    })
  }

  async update(relativePath: string, content: string, version: number): Promise<void> {
    const projectId = this.requireProject()
    await this.request({
      operation: 'update',
      requestId: this.nextRequestId(),
      projectId,
      version,
      relativePath,
      content
    })
    this.version = version
    this.cancelStaleQueries()
  }

  diagnostics(): Promise<InteractiveLanguageResultMap['diagnostics']> {
    return this.query('diagnostics', {})
  }

  completion(
    relativePath: string,
    position: number
  ): Promise<InteractiveLanguageResultMap['completion']> {
    return this.query('completion', { relativePath, position })
  }

  completionDetails(
    relativePath: string,
    position: number,
    completion: Extract<
      InteractiveLanguageRequest,
      { operation: 'completion-details' }
    >['completion']
  ): Promise<InteractiveLanguageResultMap['completion-details']> {
    return this.query('completion-details', { relativePath, position, completion })
  }

  hover(relativePath: string, position: number): Promise<InteractiveLanguageResultMap['hover']> {
    return this.query('hover', { relativePath, position })
  }

  signature(
    relativePath: string,
    position: number
  ): Promise<InteractiveLanguageResultMap['signature']> {
    return this.query('signature', { relativePath, position })
  }

  definition(
    relativePath: string,
    position: number
  ): Promise<InteractiveLanguageResultMap['definition']> {
    return this.query('definition', { relativePath, position })
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    this.projectId = null
    this.version = 0
    for (const request of this.pending.values()) {
      request.reject(new Error('Type intelligence session ended'))
    }
    this.pending.clear()
    this.latestRequestByOperation.clear()
  }

  private query<
    TOperation extends Exclude<InteractiveLanguageOperation, 'initialize' | 'update' | 'dispose'>
  >(
    operation: TOperation,
    input: Omit<
      Extract<InteractiveLanguageRequest, { operation: TOperation }>,
      'operation' | 'requestId' | 'projectId' | 'version'
    >
  ): Promise<InteractiveLanguageResultMap[TOperation]> {
    const projectId = this.requireProject()
    return this.request({
      operation,
      requestId: this.nextRequestId(),
      projectId,
      version: this.version,
      ...input
    } as Extract<InteractiveLanguageRequest, { operation: TOperation }>)
  }

  private request<TOperation extends InteractiveLanguageOperation>(
    request: Extract<InteractiveLanguageRequest, { operation: TOperation }>
  ): Promise<InteractiveLanguageResultMap[TOperation]> {
    const worker = this.ensureWorker()
    const previousRequestId = this.latestRequestByOperation.get(request.operation)
    if (previousRequestId) {
      this.pending
        .get(previousRequestId)
        ?.reject(new Error(`Superseded ${request.operation} request`))
      this.pending.delete(previousRequestId)
    }
    this.latestRequestByOperation.set(request.operation, request.requestId)

    return new Promise((resolve, reject) => {
      this.pending.set(request.requestId, {
        operation: request.operation,
        projectId: request.projectId,
        version: request.version,
        resolve: (result) => resolve(result as InteractiveLanguageResultMap[TOperation]),
        reject
      })
      worker.postMessage(request)
    })
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

  private readonly handleMessage = (event: MessageEvent<InteractiveLanguageResponse>): void => {
    const response = event.data
    const request = this.pending.get(response.requestId)
    if (!request) {
      return
    }
    this.pending.delete(response.requestId)
    if (this.latestRequestByOperation.get(request.operation) === response.requestId) {
      this.latestRequestByOperation.delete(request.operation)
    }

    if (
      response.projectId !== request.projectId ||
      response.version !== request.version ||
      response.operation !== request.operation ||
      (this.projectId !== response.projectId && response.operation !== 'initialize')
    ) {
      request.reject(new Error('Discarded stale type intelligence response'))
      return
    }
    if (response.type === 'error') {
      request.reject(new Error(`${response.code}: ${response.message}`))
      return
    }
    request.resolve(response.result)
  }

  private readonly handleError = (event: ErrorEvent): void => {
    const message = event.message || 'TypeScript worker crashed'
    this.terminate()
    this.onCrash(message)
  }

  private requireProject(): string {
    if (!this.projectId) {
      throw new Error('Type intelligence has not initialized a project')
    }
    return this.projectId
  }

  private nextRequestId(): string {
    this.sequence += 1
    return `language-${this.sequence}`
  }

  private cancelStaleQueries(): void {
    for (const [requestId, request] of this.pending) {
      if (
        request.operation !== 'initialize' &&
        request.operation !== 'update' &&
        request.version !== this.version
      ) {
        request.reject(new Error('Discarded stale type intelligence request'))
        this.pending.delete(requestId)
      }
    }
  }
}
