import type { MdxStructureHeading } from '../../../shared/markdown-source'
import type { MdxSourceIssue } from './mdx-source-diagnostics'

export type EditorAnalysisKind = 'outline' | 'diagnostics'
export interface EditorAnalysisRequest {
  id: number
  kind: EditorAnalysisKind
  source: string
}
export interface EditorAnalysisResult {
  headings: MdxStructureHeading[]
  issues: readonly MdxSourceIssue[]
}
export interface EditorAnalysisResponse {
  id: number
  result: EditorAnalysisResult | null
}
interface Job {
  request: EditorAnalysisRequest
  resolve: (result: EditorAnalysisResult | null) => void
}

/** At most one running job and one replacement: rapid typing cannot grow a worker queue. */
export class EditorAnalysisClient {
  private worker: Worker | null = null
  private active: Job | null = null
  private queued: Job | null = null
  private sequence = 0
  private disposed = false

  constructor(
    private readonly kind: EditorAnalysisKind,
    private readonly createWorker: () => Worker = () =>
      new Worker(new URL('./editor-analysis.worker.ts', import.meta.url), {
        type: 'module',
        name: `mdx-vault-${kind}`
      })
  ) {}

  analyze(source: string): Promise<EditorAnalysisResult | null> {
    this.active?.resolve(null)
    this.queued?.resolve(null)
    this.queued = null
    if (this.disposed || source.length > 2 * 1024 * 1024) return Promise.resolve(null)
    return new Promise((resolve) => {
      const job = { request: { id: ++this.sequence, kind: this.kind, source }, resolve }
      if (this.active) this.queued = job
      else this.send(job)
    })
  }

  dispose(): void {
    this.disposed = true
    this.stop()
  }

  private send(job: Job): void {
    try {
      if (!this.worker) {
        this.worker = this.createWorker()
        this.worker.addEventListener('message', this.receive)
        this.worker.addEventListener('error', this.stop)
        this.worker.addEventListener('messageerror', this.stop)
      }
      this.active = job
      this.worker.postMessage(job.request)
    } catch {
      job.resolve(null)
      this.stop()
    }
  }

  private receive = (event: MessageEvent<EditorAnalysisResponse>): void => {
    if (!this.active || event.data.id !== this.active.request.id) return
    this.active.resolve(this.queued ? null : event.data.result)
    this.active = null
    const next = this.queued
    this.queued = null
    if (next) this.send(next)
  }

  private stop = (): void => {
    this.worker?.removeEventListener('message', this.receive)
    this.worker?.removeEventListener('error', this.stop)
    this.worker?.removeEventListener('messageerror', this.stop)
    this.worker?.terminate()
    this.worker = null
    this.active?.resolve(null)
    this.queued?.resolve(null)
    this.active = null
    this.queued = null
  }
}
