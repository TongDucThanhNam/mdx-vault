import { describe, expect, test } from 'bun:test'
import {
  type WordCountClock,
  WordCountScheduler
} from '../src/renderer/src/lib/word-count-scheduler'

function fakeClock() {
  let nextId = 0
  const timers = new Map<number, () => void>()
  const idle = new Map<number, () => void>()
  const delays: number[] = []
  const timeouts: number[] = []
  const clock: WordCountClock = {
    setTimeout(callback, delay) {
      delays.push(delay)
      const id = ++nextId
      timers.set(id, callback)
      return id
    },
    clearTimeout(id) {
      timers.delete(id)
    },
    requestIdleCallback(callback, options) {
      timeouts.push(options.timeout)
      const id = ++nextId
      idle.set(id, callback)
      return id
    },
    cancelIdleCallback(id) {
      idle.delete(id)
    }
  }
  const flush = (pending: Map<number, () => void>): void => {
    const callbacks = [...pending.values()]
    pending.clear()
    for (const callback of callbacks) callback()
  }
  return { clock, delays, timeouts, flushTimers: () => flush(timers), flushIdle: () => flush(idle) }
}

describe('GOAL-34 idle word count', () => {
  test('publishes only the latest analysis after a 120 ms debounce and 120 ms idle bound', () => {
    const { clock, delays, timeouts, flushTimers, flushIdle } = fakeClock()
    const published: Array<{ source: string; words: number; chars: number }> = []
    const scheduler = new WordCountScheduler(clock, (source, count) => {
      published.push({ source, words: count.words, chars: count.chars })
    })

    scheduler.schedule('stale')
    scheduler.schedule('---\ntitle: Example\n---\n# Two words')
    flushTimers()
    expect(published).toEqual([])
    flushIdle()
    expect(published).toEqual([
      { source: '---\ntitle: Example\n---\n# Two words', words: 2, chars: 11 }
    ])
    expect(delays).toEqual([120, 120])
    expect(timeouts).toEqual([120])
  })

  test('cancels an idle analysis when a newer edit arrives', () => {
    const { clock, flushTimers, flushIdle } = fakeClock()
    const published: string[] = []
    const scheduler = new WordCountScheduler(clock, (source) => published.push(source))
    scheduler.schedule('old')
    flushTimers()
    scheduler.schedule('new')
    flushIdle()
    expect(published).toEqual([])
    flushTimers()
    flushIdle()
    expect(published).toEqual(['new'])
    scheduler.schedule('discarded')
    scheduler.cancel()
    flushTimers()
    flushIdle()
    expect(published).toEqual(['new'])
  })
})
