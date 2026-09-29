import { useEffect, useMemo, useState } from 'react'
import { LatestPreviewCompile, SupersededPreviewCompile } from './latest-preview-compile'
import { type CompiledMdxPreview, compileMdxPreview } from './mdx-preview-compiler'

export interface PreviewDiagnostic {
  message: string
  line?: number
  column?: number
  source?: string
  ruleId?: string
}

export interface RenderState {
  notePath: string
  source: string
  result: CompiledMdxPreview | null
  failure: { source: string; diagnostic: PreviewDiagnostic } | null
}

export function visibleRenderState(
  state: RenderState | null,
  notePath: string,
  source: string
): { result: CompiledMdxPreview | null; failure: PreviewDiagnostic | null; pending: boolean } {
  if (!state || state.notePath !== notePath) {
    return { result: null, failure: null, pending: true }
  }
  return {
    result: state.result,
    failure: state.failure?.source === source ? state.failure.diagnostic : null,
    pending: state.source !== source && state.failure?.source !== source
  }
}

export function useLastGoodRender(notePath: string, source: string) {
  const scheduler = useMemo(() => new LatestPreviewCompile(compileMdxPreview), [])
  const [state, setState] = useState<RenderState | null>(null)
  const [dismissedFailure, setDismissedFailure] = useState<string | null>(null)
  const visible = visibleRenderState(state, notePath, source)

  useEffect(() => {
    let cancelled = false
    void scheduler.request(source).then(
      (result) => {
        if (cancelled) return
        setState({ notePath, source, result, failure: null })
        setDismissedFailure(null)
      },
      (error: unknown) => {
        if (cancelled || error instanceof SupersededPreviewCompile) return
        setState((current) => ({
          notePath,
          source: current?.notePath === notePath && current.result ? current.source : '',
          result: current?.notePath === notePath ? current.result : null,
          failure: { source, diagnostic: createDiagnostic(error) }
        }))
        setDismissedFailure(null)
      }
    )
    return () => {
      cancelled = true
    }
  }, [notePath, scheduler, source])

  return {
    ...visible,
    hasError: visible.failure !== null,
    renderedSource: state?.notePath === notePath && state.result ? state.source : source,
    failure: dismissedFailure === source ? null : visible.failure,
    dismissFailure: () => setDismissedFailure(source)
  }
}

function createDiagnostic(error: unknown): PreviewDiagnostic {
  if (!(error instanceof Error)) return { message: String(error) }
  const properties = error as unknown as Record<string, unknown>
  return {
    message: error.message,
    ...(typeof properties.line === 'number' ? { line: properties.line } : {}),
    ...(typeof properties.column === 'number' ? { column: properties.column } : {}),
    ...(typeof properties.source === 'string' ? { source: properties.source } : {}),
    ...(typeof properties.ruleId === 'string' ? { ruleId: properties.ruleId } : {})
  }
}
