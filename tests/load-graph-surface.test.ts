import { expect, test } from 'bun:test'
import { loadGraphSurface } from '../src/renderer/src/graph/load-graph-surface'

test('graph warmup and explicit open share one module promise', async () => {
  const pending = loadGraphSurface()
  expect(loadGraphSurface()).toBe(pending)
  expect(typeof (await pending).GraphSurface).toBe('function')
  expect(loadGraphSurface()).toBe(pending)
})
