/// <reference lib="webworker" />

import type {
  InteractiveLanguageRequest,
  InteractiveLanguageResponse
} from '../../../shared/interactive-language-protocol'
import { InteractiveLanguageWorkerRuntime } from './interactive-language-worker-runtime'
import { loadWorkerInteractiveTypeLibraries } from './interactive-type-libraries.worker'

const workerScope = self as unknown as DedicatedWorkerGlobalScope
const runtime = new InteractiveLanguageWorkerRuntime(loadWorkerInteractiveTypeLibraries())

workerScope.addEventListener('message', (event: MessageEvent<InteractiveLanguageRequest>) => {
  const response: InteractiveLanguageResponse = runtime.handle(event.data)
  workerScope.postMessage(response)
})
