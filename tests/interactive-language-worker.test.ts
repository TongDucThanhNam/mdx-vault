import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { loadNodeInteractiveTypeLibraries } from '../src/main/services/interactive-type-libraries'
import { InteractiveLanguageWorkerClient } from '../src/renderer/src/interactive/interactive-language-client'
import { InteractiveLanguageWorkerRuntime } from '../src/renderer/src/interactive/interactive-language-worker-runtime'
import {
  createInteractiveProjectSnapshot,
  INTERACTIVE_PROJECT_MAX_FILES,
  type InteractiveProjectSnapshot
} from '../src/shared/interactive-authoring'
import type {
  InteractiveLanguageRequest,
  InteractiveLanguageResponse
} from '../src/shared/interactive-language-protocol'

describe('GOAL-25 TypeScript worker boundary', () => {
  test('keeps one versioned project, updates unsaved source, and rejects stale requests', () => {
    const runtime = new InteractiveLanguageWorkerRuntime(loadNodeInteractiveTypeLibraries())
    const snapshot = createSnapshot('const value: number = 1\nexport default value\n')

    expect(runtime.handle(initializeRequest(snapshot))).toMatchObject({
      type: 'result',
      operation: 'initialize',
      projectId: snapshot.projectId,
      version: 1
    })

    const stale = runtime.handle({
      operation: 'diagnostics',
      requestId: 'stale',
      projectId: snapshot.projectId,
      version: 0
    })
    expect(stale).toMatchObject({ type: 'error', code: 'STALE_VERSION' })

    const updated = runtime.handle({
      operation: 'update',
      requestId: 'update',
      projectId: snapshot.projectId,
      version: 2,
      relativePath: 'component.tsx',
      content: "const value: number = 'bad'\nexport default value\n"
    })
    expect(updated).toMatchObject({ type: 'result', version: 2 })

    const diagnostics = runtime.handle({
      operation: 'diagnostics',
      requestId: 'diagnostics',
      projectId: snapshot.projectId,
      version: 2
    })
    expect(diagnostics).toMatchObject({ type: 'result', version: 2 })
    if (diagnostics.type === 'result' && diagnostics.operation === 'diagnostics') {
      expect(diagnostics.result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'TS2322',
            relativePath: 'interactives/counter/component.tsx'
          })
        ])
      )
      expect(JSON.stringify(diagnostics.result)).not.toContain(process.cwd())
    }
    runtime.dispose()
  })

  test('turns file-count and update limits into bounded request errors', () => {
    const runtime = new InteractiveLanguageWorkerRuntime(loadNodeInteractiveTypeLibraries())
    const oversizedSnapshot = {
      ...createSnapshot('export default 1\n'),
      files: Array.from({ length: INTERACTIVE_PROJECT_MAX_FILES + 1 }, (_, index) => ({
        relativePath: `file-${index}.ts`,
        content: 'export {}\n'
      }))
    }

    expect(runtime.handle(initializeRequest(oversizedSnapshot))).toMatchObject({
      type: 'error',
      code: 'INVALID_REQUEST',
      message: expect.stringContaining(`${INTERACTIVE_PROJECT_MAX_FILES}`)
    })

    const snapshot = createSnapshot('export default 1\n')
    runtime.handle(initializeRequest(snapshot))
    expect(
      runtime.handle({
        operation: 'update',
        requestId: 'escape',
        projectId: snapshot.projectId,
        version: 2,
        relativePath: '../outside.ts',
        content: 'export default 2\n'
      })
    ).toMatchObject({
      type: 'error',
      code: 'INVALID_REQUEST'
    })
    runtime.dispose()
  })

  test('creates the worker lazily and discards mismatched responses', async () => {
    const fakeWorker = new FakeWorker()
    let factoryCalls = 0
    const client = new InteractiveLanguageWorkerClient(() => {
      factoryCalls += 1
      return fakeWorker as unknown as Worker
    })
    const snapshot = createSnapshot('export default 1\n')

    expect(factoryCalls).toBe(0)
    const ready = client.initialize(snapshot)
    expect(factoryCalls).toBe(1)
    const request = fakeWorker.messages[0]
    expect(request?.operation).toBe('initialize')
    if (!request) {
      throw new Error('Expected initialize request')
    }
    fakeWorker.respond({
      type: 'result',
      requestId: request.requestId,
      projectId: request.projectId,
      version: request.version + 1,
      operation: 'initialize',
      result: { ready: true }
    })

    await expect(ready).rejects.toThrow('stale type intelligence response')
    client.terminate()
    expect(fakeWorker.terminated).toBe(true)
  })

  test('uses build-time local type assets instead of an empty root-absolute Vite glob', async () => {
    const source = await readFile(
      'src/renderer/src/interactive/interactive-type-libraries.worker.ts',
      'utf8'
    )
    expect(source).toContain('../../../../node_modules/typescript/lib/lib.*.d.ts')
    expect(source).toContain('../../../../node_modules/@types/react/*.d.ts')
    expect(source).not.toContain("'/node_modules/typescript")
    expect(source).not.toContain('fetch(')
  })
})

class FakeWorker extends EventTarget {
  messages: InteractiveLanguageRequest[] = []
  terminated = false

  postMessage(message: InteractiveLanguageRequest): void {
    this.messages.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  respond(response: InteractiveLanguageResponse): void {
    this.dispatchEvent(new MessageEvent('message', { data: response }))
  }
}

function initializeRequest(
  snapshot: InteractiveProjectSnapshot
): Extract<InteractiveLanguageRequest, { operation: 'initialize' }> {
  return {
    operation: 'initialize',
    requestId: 'initialize',
    projectId: snapshot.projectId,
    version: snapshot.version,
    snapshot
  }
}

function createSnapshot(componentSource: string): InteractiveProjectSnapshot {
  return createInteractiveProjectSnapshot({
    projectRoot: 'interactives/counter',
    version: 1,
    files: [
      { relativePath: 'component.tsx', content: componentSource },
      {
        relativePath: 'manifest.json',
        content: JSON.stringify({
          name: 'Counter',
          version: '1.0.0',
          runtime: 'react',
          permissions: { network: false, filesystem: false, dataPaths: [] },
          propsSchema: {},
          dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }
        })
      }
    ]
  })
}
