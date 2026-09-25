/// <reference lib="webworker" />

import type {
  EditorAnalysisRequest,
  EditorAnalysisResponse,
  EditorAnalysisResult
} from './editor-analysis-client'

const scope = self as unknown as DedicatedWorkerGlobalScope
scope.addEventListener('message', (event: MessageEvent<EditorAnalysisRequest>) => {
  const { id, kind, source } = event.data
  if (!Number.isSafeInteger(id) || typeof source !== 'string' || source.length > 2 * 1024 * 1024) {
    return
  }
  const analyze = async (): Promise<EditorAnalysisResult | null> => {
    if (kind === 'outline') {
      const { analyzeMdxStructure } = await import('../../../shared/markdown-source')
      return { headings: analyzeMdxStructure(source).headings, issues: [] }
    }
    if (kind === 'diagnostics') {
      const { diagnoseMdxSource } = await import('./mdx-source-diagnostics')
      return { headings: [], issues: await diagnoseMdxSource(source) }
    }
    return null
  }
  // Both paths parse source as data; no imports, expressions or components from
  // the note are evaluated. Failures leave the editable buffer available.
  void analyze().then(
    (result) => scope.postMessage({ id, result } satisfies EditorAnalysisResponse),
    () => scope.postMessage({ id, result: null } satisfies EditorAnalysisResponse)
  )
})
