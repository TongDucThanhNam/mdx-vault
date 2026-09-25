import { describe, expect, test } from 'bun:test'
import { run } from '@mdx-js/mdx'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'

import { MdxCompileCache } from '../src/renderer/src/preview/mdx-compile-cache'
import type {
  MdxCompileWorkerRequest,
  MdxCompileWorkerResponse
} from '../src/renderer/src/preview/mdx-compile-protocol'
import { MdxCompileWorkerClient } from '../src/renderer/src/preview/mdx-compile-worker-client'
import { compileMdxFunctionBody } from '../src/renderer/src/preview/mdx-compile-worker-runtime'
import { readPreviewFrontmatter } from '../src/renderer/src/preview/preview-metadata'

describe('MDX preview compilation', () => {
  test('collects import warnings during the same pass that compiles MDX', async () => {
    const source = `---
theme: interactive-note
---

import Example from './Example'

# Preview
`

    const result = await compileMdxFunctionBody(source)
    const module = await run(result.code, { Fragment, jsx, jsxs })

    expect(module.default).toBeFunction()
    expect(result.warnings).toEqual([
      {
        message:
          'Import statements in notes are discouraged. Use the registry or interactives/ instead.',
        line: 5
      }
    ])
    expect(readPreviewFrontmatter(source)).toEqual({ theme: 'interactive-note' })
  })

  test('deduplicates concurrent work and reuses the compiled result', async () => {
    const cache = new MdxCompileCache<object>({ maxEntries: 2, maxSourceLength: 100 })
    let compileCount = 0
    const compile = async (): Promise<object> => {
      compileCount += 1
      await Promise.resolve()
      return { compileCount }
    }

    const [first, concurrent] = await Promise.all([
      cache.getOrCompile('same source', compile),
      cache.getOrCompile('same source', compile)
    ])
    const cached = await cache.getOrCompile('same source', compile)

    expect(compileCount).toBe(1)
    expect(concurrent).toBe(first)
    expect(cached).toBe(first)
  })

  test('evicts least-recently-used entries and does not cache oversized sources', async () => {
    const cache = new MdxCompileCache<string>({ maxEntries: 2, maxSourceLength: 3 })
    const compileCounts = new Map<string, number>()
    const compile = async (source: string): Promise<string> => {
      const count = (compileCounts.get(source) ?? 0) + 1
      compileCounts.set(source, count)
      return `${source}:${count}`
    }

    await cache.getOrCompile('a', compile)
    await cache.getOrCompile('b', compile)
    await cache.getOrCompile('a', compile)
    await cache.getOrCompile('c', compile)
    await cache.getOrCompile('b', compile)
    await cache.getOrCompile('long', compile)
    await cache.getOrCompile('long', compile)

    expect(compileCounts.get('a')).toBe(1)
    expect(compileCounts.get('b')).toBe(2)
    expect(compileCounts.get('long')).toBe(2)
  })

  test('does not cache failed compilations', async () => {
    const cache = new MdxCompileCache<string>({ maxEntries: 2, maxSourceLength: 100 })
    let attempts = 0
    const compile = async (): Promise<string> => {
      attempts += 1
      if (attempts === 1) throw new Error('invalid MDX')
      return 'recovered'
    }

    await expect(cache.getOrCompile('source', compile)).rejects.toThrow('invalid MDX')
    await expect(cache.getOrCompile('source', compile)).resolves.toBe('recovered')
    expect(attempts).toBe(2)
  })

  test('routes worker results and preserves structured diagnostics', async () => {
    const worker = new FakeCompileWorker()
    const client = new MdxCompileWorkerClient(() => worker as unknown as Worker)
    const success = client.compile('# Result')
    const successRequest = worker.requests.at(-1)

    expect(successRequest?.source).toBe('# Result')
    worker.respond({
      type: 'result',
      requestId: successRequest?.requestId ?? '',
      result: { code: 'return {}', warnings: [] }
    })
    await expect(success).resolves.toEqual({ code: 'return {}', warnings: [] })

    const failure = client.compile('<Broken>')
    const failureRequest = worker.requests.at(-1)
    worker.respond({
      type: 'error',
      requestId: failureRequest?.requestId ?? '',
      diagnostic: { message: 'Unexpected end of file', line: 1, column: 9 }
    })

    try {
      await failure
      throw new Error('Expected worker compilation to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Unexpected end of file')
      expect((error as unknown as { line?: number }).line).toBe(1)
      expect((error as unknown as { column?: number }).column).toBe(9)
    }

    client.terminate()
    expect(worker.terminated).toBe(true)
  })
})

class FakeCompileWorker extends EventTarget {
  readonly requests: MdxCompileWorkerRequest[] = []
  terminated = false

  postMessage(request: MdxCompileWorkerRequest): void {
    this.requests.push(request)
  }

  respond(response: MdxCompileWorkerResponse): void {
    this.dispatchEvent(new MessageEvent('message', { data: response }))
  }

  terminate(): void {
    this.terminated = true
  }
}
