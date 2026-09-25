export interface GraphSaveScheduler {
  schedule: () => void
  cancel: () => void
}

interface GraphSaveSchedulerClock {
  setTimeout: (callback: () => void, delay: number) => unknown
  clearTimeout: (handle: unknown) => void
}

const systemClock: GraphSaveSchedulerClock = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
}

export function createGraphSaveScheduler(
  flush: () => void,
  delay = 240,
  clock: GraphSaveSchedulerClock = systemClock
): GraphSaveScheduler {
  let handle: unknown = null

  return {
    schedule: () => {
      if (handle !== null) clock.clearTimeout(handle)
      handle = clock.setTimeout(() => {
        handle = null
        flush()
      }, delay)
    },
    cancel: () => {
      if (handle === null) return
      clock.clearTimeout(handle)
      handle = null
    }
  }
}
