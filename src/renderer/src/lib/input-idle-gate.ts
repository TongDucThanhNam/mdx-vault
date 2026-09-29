interface IdleClock {
  now(): number
  setTimeout(callback: () => void, delay: number): number
  clearTimeout(id: number): void
  requestIdle(callback: () => void): number
  cancelIdle(id: number): void
}

/** Start once at idle, never within quietMs of the latest user input. */
export class InputIdleGate {
  private ready = false
  private started = false
  private disposed = false
  private lastInput = Number.NEGATIVE_INFINITY
  private timer: number | null = null
  private idle: number | null = null

  constructor(
    private readonly clock: IdleClock,
    private readonly start: () => void,
    private readonly quietMs = 1000
  ) {}

  setReady(): void {
    this.ready = true
    this.schedule()
  }

  onInput(): void {
    this.lastInput = this.clock.now()
    this.schedule()
  }

  dispose(): void {
    this.disposed = true
    this.clearPending()
  }

  private clearPending(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer)
    if (this.idle !== null) this.clock.cancelIdle(this.idle)
    this.timer = null
    this.idle = null
  }

  private schedule(): void {
    if (!this.ready || this.started || this.disposed) return
    this.clearPending()
    const remaining = this.quietMs - (this.clock.now() - this.lastInput)
    if (remaining > 0) {
      this.timer = this.clock.setTimeout(() => {
        this.timer = null
        this.schedule()
      }, remaining)
      return
    }
    this.idle = this.clock.requestIdle(() => {
      this.idle = null
      if (this.clock.now() - this.lastInput < this.quietMs) {
        this.schedule()
        return
      }
      this.started = true
      this.start()
    })
  }
}
