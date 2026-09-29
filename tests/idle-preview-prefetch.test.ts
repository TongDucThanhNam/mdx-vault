import { describe, expect, test } from 'bun:test'
import { IdlePreviewPrefetch } from '../src/renderer/src/preview/idle-preview-prefetch'

describe('idle preview prefetch', () => {
  test('bounds queued work and compiles only at idle', async () => {
    const callbacks = new Map<number, () => void>()
    const compiled: string[] = []
    let nextId = 0
    const queue = new IdlePreviewPrefetch(
      async (source) => {
        compiled.push(source)
      },
      (callback) => {
        callbacks.set(++nextId, callback)
        return nextId
      },
      (id) => {
        callbacks.delete(id)
      },
      2
    )
    queue.enqueue(['a', 'a', '', 'b', 'c'])
    expect(compiled).toEqual([])
    callbacks.get(1)?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(compiled).toEqual(['a'])
    callbacks.get(2)?.()
    await Promise.resolve()
    expect(compiled).toEqual(['a', 'b'])
    expect(nextId).toBe(2)
  })

  test('cancels queued work and accepts a fresh generation after stale completion', async () => {
    const callbacks = new Map<number, () => void>()
    const compiled: string[] = []
    let nextId = 0
    let finishFirst: (() => void) | undefined
    const queue = new IdlePreviewPrefetch(
      (source) => {
        compiled.push(source)
        return source === 'old'
          ? new Promise<void>((resolve) => {
              finishFirst = resolve
            })
          : Promise.resolve()
      },
      (callback) => {
        callbacks.set(++nextId, callback)
        return nextId
      },
      (id) => {
        callbacks.delete(id)
      }
    )
    queue.enqueue(['old', 'stale'])
    callbacks.get(1)?.()
    queue.cancel()
    queue.enqueue(['fresh'])
    finishFirst?.()
    await Promise.resolve()
    await Promise.resolve()
    callbacks.get(2)?.()
    await Promise.resolve()
    expect(compiled).toEqual(['old', 'fresh'])
  })
})
