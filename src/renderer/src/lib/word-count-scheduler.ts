import { computeWordCount, type WordCount } from './word-count'

export interface WordCountClock {
  setTimeout(callback: () => void, delay: number): number
  clearTimeout(id: number): void
  requestIdleCallback?(callback: () => void, options: { timeout: number }): number
  cancelIdleCallback?(id: number): void
}

/** Move full-document analysis out of the keydown/render path, bounded to 240 ms idle. */
export class WordCountScheduler {
  private timer: number | null = null
  private idle: number | null = null

  constructor(
    private readonly clock: WordCountClock,
    private readonly publish: (source: string, count: WordCount) => void
  ) {}

  schedule(source: string): void {
    this.cancel()
    this.timer = this.clock.setTimeout(() => {
      this.timer = null
      const compute = (): void => {
        this.idle = null
        this.publish(source, computeWordCount(source))
      }
      if (this.clock.requestIdleCallback) {
        this.idle = this.clock.requestIdleCallback(compute, { timeout: 120 })
      } else {
        compute()
      }
    }, 120)
  }

  cancel(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer)
    if (this.idle !== null) this.clock.cancelIdleCallback?.(this.idle)
    this.timer = null
    this.idle = null
  }
}
