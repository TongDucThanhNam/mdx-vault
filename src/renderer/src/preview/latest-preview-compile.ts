/** One active worker request and at most one not-yet-started request per Reading surface. */
export class SupersededPreviewCompile extends Error {
  constructor() {
    super('Preview compile superseded')
  }
}

interface Queued<Result> {
  source: string
  resolve: (result: Result) => void
  reject: (reason: unknown) => void
}

export class LatestPreviewCompile<Result> {
  private active = false
  private activeRequest: Queued<Result> | null = null
  private queued: Queued<Result> | null = null

  constructor(private readonly compile: (source: string) => Promise<Result>) {}

  request(source: string): Promise<Result> {
    return new Promise((resolve, reject) => {
      this.activeRequest?.reject(new SupersededPreviewCompile())
      this.queued?.reject(new SupersededPreviewCompile())
      this.queued = { source, resolve, reject }
      this.startNext()
    })
  }

  private startNext(): void {
    if (this.active || !this.queued) return
    const request = this.queued
    this.queued = null
    this.active = true
    this.activeRequest = request
    void Promise.resolve()
      .then(() => this.compile(request.source))
      .then(
        (result) => {
          if (this.activeRequest === request) request.resolve(result)
        },
        (error: unknown) => {
          if (this.activeRequest === request) request.reject(error)
        }
      )
      .finally(() => {
        this.active = false
        this.activeRequest = null
        this.startNext()
      })
  }
}
