import { describe, expect, test } from 'bun:test'
import { createGraphTopologyRequestKey } from '../src/renderer/src/graph/graph-query-settings'
import { createGraphRequestCoordinator } from '../src/renderer/src/graph/graph-request-coordinator'
import { createGraphSaveScheduler } from '../src/renderer/src/graph/graph-save-scheduler'
import { DEFAULT_GRAPH_VIEW_SETTINGS } from '../src/shared/graph'

describe('GOAL-24 stale-safe graph controller', () => {
  test('allows only the newest query token to own a result', () => {
    const coordinator = createGraphRequestCoordinator()
    const first = coordinator.begin()
    const second = coordinator.begin()

    expect(coordinator.isCurrent(first)).toBe(false)
    expect(coordinator.isCurrent(second)).toBe(true)
  })

  test('invalidates in-flight ownership on scope or vault replacement', () => {
    const coordinator = createGraphRequestCoordinator()
    const pending = coordinator.begin()
    coordinator.invalidate()

    expect(coordinator.isCurrent(pending)).toBe(false)
    const nextVault = coordinator.begin()
    expect(coordinator.isCurrent(nextVault)).toBe(true)
  })

  test('debounces graph configuration writes and supports cleanup cancellation', () => {
    const callbacks = new Map<number, () => void>()
    const cleared: number[] = []
    let nextHandle = 1
    let flushes = 0
    const scheduler = createGraphSaveScheduler(
      () => {
        flushes += 1
      },
      240,
      {
        setTimeout: (callback, delay) => {
          expect(delay).toBe(240)
          const handle = nextHandle
          nextHandle += 1
          callbacks.set(handle, callback)
          return handle
        },
        clearTimeout: (handle) => {
          cleared.push(Number(handle))
          callbacks.delete(Number(handle))
        }
      }
    )

    scheduler.schedule()
    scheduler.schedule()
    expect(cleared).toEqual([1])
    callbacks.get(2)?.()
    expect(flushes).toBe(1)

    scheduler.schedule()
    scheduler.cancel()
    callbacks.get(3)?.()
    expect(cleared).toEqual([1, 3])
    expect(flushes).toBe(1)
  })

  test('does not requery topology for display-only or force-only changes', () => {
    const scope = { kind: 'global' } as const
    const baseline = createGraphTopologyRequestKey(scope, DEFAULT_GRAPH_VIEW_SETTINGS, [])
    const displayOnly = createGraphTopologyRequestKey(
      scope,
      {
        ...DEFAULT_GRAPH_VIEW_SETTINGS,
        arrows: false,
        nodeSize: 24,
        centerForce: 2,
        repelForce: 4_096
      },
      []
    )
    const membershipChange = createGraphTopologyRequestKey(
      scope,
      { ...DEFAULT_GRAPH_VIEW_SETTINGS, existingOnly: true },
      []
    )

    expect(displayOnly).toBe(baseline)
    expect(membershipChange).not.toBe(baseline)
  })
})
