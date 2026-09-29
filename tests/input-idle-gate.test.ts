import { describe, expect, test } from 'bun:test'
import { InputIdleGate } from '../src/renderer/src/lib/input-idle-gate'

function fakeClock() {
  let now = 0
  let nextId = 0
  const timers = new Map<number, { callback: () => void; delay: number }>()
  const idle = new Map<number, () => void>()
  return {
    timers,
    idle,
    advanceTo: (value: number) => {
      now = value
    },
    now: () => now,
    setTimeout: (callback: () => void, delay: number) => {
      const id = ++nextId
      timers.set(id, { callback, delay })
      return id
    },
    clearTimeout: (id: number) => {
      timers.delete(id)
    },
    requestIdle: (callback: () => void) => {
      const id = ++nextId
      idle.set(id, callback)
      return id
    },
    cancelIdle: (id: number) => {
      idle.delete(id)
    }
  }
}

describe('input idle gate', () => {
  test('cancels pending work and waits one second after the latest input', () => {
    const clock = fakeClock()
    let starts = 0
    const gate = new InputIdleGate(clock, () => starts++)
    gate.setReady()
    expect(clock.idle.size).toBe(1)

    clock.advanceTo(10)
    gate.onInput()
    expect(clock.idle.size).toBe(0)
    expect([...clock.timers.values()][0]?.delay).toBe(1000)

    clock.advanceTo(500)
    gate.onInput()
    expect(clock.timers.size).toBe(1)
    clock.advanceTo(1500)
    const timer = [...clock.timers.entries()][0]
    if (timer) {
      clock.timers.delete(timer[0])
      timer[1].callback()
    }
    expect(clock.idle.size).toBe(1)
    expect(starts).toBe(0)
    const idleCallback = [...clock.idle.values()][0]
    idleCallback?.()
    expect(starts).toBe(1)
    gate.onInput()
    gate.setReady()
    expect(starts).toBe(1)
    expect(clock.timers.size).toBe(0)
  })

  test('records input before readiness and disposal prevents later starts', () => {
    const clock = fakeClock()
    let starts = 0
    const gate = new InputIdleGate(clock, () => starts++)
    gate.onInput()
    expect(clock.timers.size).toBe(0)
    gate.setReady()
    expect(clock.timers.size).toBe(1)
    gate.dispose()
    expect(clock.timers.size).toBe(0)
    gate.setReady()
    clock.advanceTo(1000)
    expect(starts).toBe(0)
    expect(clock.idle.size).toBe(0)
  })
})
