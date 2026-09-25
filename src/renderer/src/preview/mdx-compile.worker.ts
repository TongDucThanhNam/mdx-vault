/// <reference lib="webworker" />

import type { MdxCompileWorkerRequest, MdxCompileWorkerResponse } from './mdx-compile-protocol'
import { compileMdxFunctionBody, createMdxCompileDiagnostic } from './mdx-compile-worker-runtime'

const workerScope = self as unknown as DedicatedWorkerGlobalScope

workerScope.addEventListener('message', (event: MessageEvent<MdxCompileWorkerRequest>) => {
  const { requestId, source } = event.data

  void compileMdxFunctionBody(source)
    .then((result) => {
      const response: MdxCompileWorkerResponse = { type: 'result', requestId, result }
      workerScope.postMessage(response)
    })
    .catch((error: unknown) => {
      const response: MdxCompileWorkerResponse = {
        type: 'error',
        requestId,
        diagnostic: createMdxCompileDiagnostic(error)
      }
      workerScope.postMessage(response)
    })
})
