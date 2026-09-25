interface MdxCompileCacheOptions {
  maxEntries: number
  maxSourceLength: number
}

/**
 * A small renderer-local LRU for expensive MDX compile results.
 *
 * The source string is the cache key because the compiler output depends on the
 * complete document. Entry and source-size limits keep a large vault from
 * turning navigation history into unbounded renderer memory.
 */
export class MdxCompileCache<Result> {
  private readonly entries = new Map<string, Result>()
  private readonly inFlight = new Map<string, Promise<Result>>()

  constructor(private readonly options: MdxCompileCacheOptions) {
    if (!Number.isInteger(options.maxEntries) || options.maxEntries < 1) {
      throw new Error('maxEntries must be a positive integer')
    }

    if (!Number.isInteger(options.maxSourceLength) || options.maxSourceLength < 1) {
      throw new Error('maxSourceLength must be a positive integer')
    }
  }

  getOrCompile(source: string, compile: (source: string) => Promise<Result>): Promise<Result> {
    const hasCached = this.entries.has(source)
    const cached = this.entries.get(source)

    if (hasCached) {
      this.entries.delete(source)
      this.entries.set(source, cached as Result)
      return Promise.resolve(cached as Result)
    }

    const pending = this.inFlight.get(source)
    if (pending) {
      return pending
    }

    const promise = Promise.resolve()
      .then(() => compile(source))
      .then((result) => {
        if (source.length <= this.options.maxSourceLength) {
          this.entries.set(source, result)
          this.evictOverflow()
        }

        return result
      })
      .finally(() => {
        if (this.inFlight.get(source) === promise) {
          this.inFlight.delete(source)
        }
      })

    this.inFlight.set(source, promise)
    return promise
  }

  private evictOverflow(): void {
    while (this.entries.size > this.options.maxEntries) {
      const oldestSource = this.entries.keys().next().value

      if (oldestSource === undefined) {
        return
      }

      this.entries.delete(oldestSource)
    }
  }
}
