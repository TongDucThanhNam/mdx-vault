type ScheduleIdle = (callback: () => void) => number
type CancelIdle = (id: number) => void

/** Bounded, cancellable queue; an already-running worker parse is not terminated. */
export class IdlePreviewPrefetch {
  private queue: string[] = []
  private idleId: number | null = null
  private active = false
  private generation = 0

  constructor(
    private readonly compile: (source: string) => Promise<void>,
    private readonly scheduleIdle: ScheduleIdle,
    private readonly cancelIdle: CancelIdle,
    private readonly maxQueued = 3
  ) {}

  enqueue(sources: readonly string[]): void {
    for (const source of sources) {
      if (this.queue.length >= this.maxQueued) break
      if (!source || source.length > 512 * 1024 || this.queue.includes(source)) continue
      this.queue.push(source)
    }
    this.scheduleNext()
  }

  cancel(): void {
    this.generation += 1
    this.queue = []
    if (this.idleId !== null) this.cancelIdle(this.idleId)
    this.idleId = null
  }

  private scheduleNext(): void {
    if (this.active || this.idleId !== null || this.queue.length === 0) return
    const generation = this.generation
    this.idleId = this.scheduleIdle(() => {
      this.idleId = null
      if (generation !== this.generation) return
      const source = this.queue.shift()
      if (!source) return
      this.active = true
      void this.compile(source)
        .catch(() => undefined)
        .finally(() => {
          this.active = false
          this.scheduleNext()
        })
    })
  }
}
