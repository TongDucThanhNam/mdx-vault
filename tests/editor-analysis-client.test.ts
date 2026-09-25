import { describe, expect, test } from 'bun:test'
import {
  EditorAnalysisClient,
  type EditorAnalysisRequest,
  type EditorAnalysisResponse,
  type EditorAnalysisResult
} from '../src/renderer/src/editor/editor-analysis-client'

class FakeWorker {
  requests: EditorAnalysisRequest[] = []
  terminated = false
  listeners = new Map<string, Set<(event: never) => void>>()
  addEventListener(type: string, listener: (event: never) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)?.add(listener)
  }
  removeEventListener(type: string, listener: (event: never) => void): void {
    this.listeners.get(type)?.delete(listener)
  }
  postMessage(request: EditorAnalysisRequest): void {
    this.requests.push(request)
  }
  terminate(): void {
    this.terminated = true
  }
  receive(response: EditorAnalysisResponse): void {
    for (const listener of this.listeners.get('message') ?? [])
      listener({ data: response } as never)
  }
  crash(): void {
    for (const listener of this.listeners.get('error') ?? []) listener({} as never)
  }
}

const result: EditorAnalysisResult = {
  headings: [],
  issues: [{ offset: 3, message: 'Invalid MDX' }]
}

describe('editor analysis worker lifecycle', () => {
  test('lazy, bounded, latest-wins queue ignores out-of-order responses', async () => {
    const worker = new FakeWorker()
    let created = 0
    const client = new EditorAnalysisClient('outline', () => {
      created++
      return worker as unknown as Worker
    })
    expect(created).toBe(0)
    const first = client.analyze('# First')
    const second = client.analyze('# Second')
    const third = client.analyze('# Third')
    expect(await first).toBeNull()
    expect(await second).toBeNull()
    expect(worker.requests.map((request) => request.source)).toEqual(['# First'])
    worker.receive({ id: 99, result })
    expect(worker.requests).toHaveLength(1)
    worker.receive({ id: 1, result })
    expect(worker.requests.map((request) => request.source)).toEqual(['# First', '# Third'])
    worker.receive({ id: 3, result })
    expect(await third).toEqual(result)
    expect(created).toBe(1)
    client.dispose()
  })

  test('destroy settles all callers, releases the worker, and cannot restart it', async () => {
    const worker = new FakeWorker()
    const client = new EditorAnalysisClient('diagnostics', () => worker as unknown as Worker)
    const first = client.analyze('first')
    const last = client.analyze('last')
    client.dispose()
    expect(await first).toBeNull()
    expect(await last).toBeNull()
    expect(worker.terminated).toBe(true)
    expect(await client.analyze('after destroy')).toBeNull()
    expect(worker.requests).toHaveLength(1)
    expect(worker.listeners.get('message')?.size).toBe(0)
  })

  test('worker failure cancels analysis and allows a later independent attempt', async () => {
    const workers: FakeWorker[] = []
    const client = new EditorAnalysisClient('outline', () => {
      const worker = new FakeWorker()
      workers.push(worker)
      return worker as unknown as Worker
    })
    const failed = client.analyze('first')
    workers[0]?.crash()
    expect(await failed).toBeNull()
    const recovered = client.analyze('next')
    workers[1]?.receive({ id: 2, result })
    expect(await recovered).toEqual(result)
    client.dispose()
  })

  test('oversized documents and startup failures settle without blocking editing', async () => {
    let created = 0
    const client = new EditorAnalysisClient('outline', () => {
      created++
      throw new Error('worker unavailable')
    })
    expect(await client.analyze('x'.repeat(2 * 1024 * 1024 + 1))).toBeNull()
    expect(created).toBe(0)
    expect(await client.analyze('note')).toBeNull()
    expect(created).toBe(1)
    client.dispose()
  })
})
