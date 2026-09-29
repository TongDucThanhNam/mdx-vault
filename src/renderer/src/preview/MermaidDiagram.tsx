import { useEffect, useMemo, useState } from 'react'

import { mermaidSecureConfig } from '../../../shared/mermaid-config'

const sandboxCsp = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  "connect-src 'none'",
  "font-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

let mermaidRuntimePromise: Promise<MermaidRuntime> | null = null

interface MermaidDiagramProps {
  chart: string
}

type MermaidState =
  | { status: 'loading' }
  | { status: 'ready'; srcDoc: string; height: number }
  | { status: 'error'; message: string }

interface MermaidRuntime {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, chart: string) => Promise<{ svg: string }>
}

interface SanitizedSvg {
  svg: string
  width: number | null
  height: number | null
}

export function MermaidDiagram({ chart }: MermaidDiagramProps): React.JSX.Element {
  const instanceId = useMemo(() => window.crypto.randomUUID(), [])
  const [state, setState] = useState<MermaidState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    void renderMermaidChart(chart, instanceId)
      .then((result) => {
        if (!cancelled) {
          setState({
            status: 'ready',
            srcDoc: createMermaidSandboxDocument(result.svg),
            height: estimateFrameHeight(result)
          })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: formatError(error) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [chart, instanceId])

  return (
    <section className="mdx-mermaid my-5 overflow-hidden border-2 border-foreground bg-background shadow-[3px_3px_0_0_var(--foreground)]">
      <div className="border-b-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Mermaid
      </div>
      <div
        className="min-h-[260px] overflow-hidden motion-safe:transition-[height] motion-safe:duration-150"
        style={{ height: state.status === 'ready' ? Math.max(260, state.height) : 260 }}
      >
        {state.status === 'ready' ? (
          <iframe
            key={instanceId}
            title="Mermaid diagram"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={state.srcDoc}
            className="block size-full border-0 bg-background"
          />
        ) : state.status === 'error' ? (
          <pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap border-0 bg-background p-4 font-mono text-xs text-destructive shadow-none">
            {state.message}
          </pre>
        ) : (
          <div className="flex size-full items-center justify-center px-4 font-mono text-[12px] uppercase tracking-wider text-muted-foreground">
            Rendering diagram.
          </div>
        )}
      </div>
    </section>
  )
}

async function loadMermaidRuntime(): Promise<MermaidRuntime> {
  mermaidRuntimePromise ??= import('mermaid').then((module) => {
    const runtime = (module.default ?? module) as unknown as Partial<MermaidRuntime>

    if (typeof runtime.initialize !== 'function' || typeof runtime.render !== 'function') {
      throw new Error('Mermaid runtime did not expose initialize/render.')
    }

    return runtime as MermaidRuntime
  })

  return mermaidRuntimePromise
}

async function renderMermaidChart(chart: string, instanceId: string): Promise<SanitizedSvg> {
  const mermaid = await loadMermaidRuntime()
  mermaid.initialize(createMermaidRuntimeConfig())

  const result = await mermaid.render(
    `mdx-mermaid-${instanceId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    chart
  )

  return sanitizeMermaidSvg(result.svg)
}

function createMermaidRuntimeConfig(): Record<string, unknown> {
  return {
    ...mermaidSecureConfig,
    secure: [...mermaidSecureConfig.secure],
    themeVariables: { ...mermaidSecureConfig.themeVariables },
    flowchart: { ...mermaidSecureConfig.flowchart }
  }
}

function createMermaidSandboxDocument(svg: string): string {
  const imageSrc = svgToDataUrl(svg)

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(sandboxCsp)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root { color-scheme: light; }
html, body { margin: 0; min-height: 100%; background: #f9f9f7; color: #111111; }
body { overflow: hidden; padding: 16px; }
img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}
</style>
</head>
<body>
<img src="${imageSrc}" alt="Mermaid diagram">
</body>
</html>`
}

function sanitizeMermaidSvg(svg: string): SanitizedSvg {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const parserError = document.querySelector('parsererror')

  if (parserError) {
    throw new Error('Mermaid produced invalid SVG.')
  }

  const svgElement = document.documentElement

  if (svgElement.tagName.toLowerCase() !== 'svg') {
    throw new Error('Mermaid output was not an SVG document.')
  }

  document
    .querySelectorAll('script, foreignObject, iframe, object, embed, link')
    .forEach((node) => {
      node.remove()
    })

  document.querySelectorAll('style').forEach((styleNode) => {
    if (containsUnsafeCss(styleNode.textContent ?? '')) {
      styleNode.remove()
    }
  })

  for (const element of [svgElement, ...Array.from(svgElement.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()

      if (
        name.startsWith('on') ||
        ((name === 'href' || name.endsWith(':href')) && isUnsafeUri(attribute.value)) ||
        (name === 'style' && containsUnsafeCss(attribute.value))
      ) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  return {
    svg: new XMLSerializer().serializeToString(svgElement),
    width: readSvgNumber(svgElement.getAttribute('width')),
    height: readSvgNumber(svgElement.getAttribute('height')) ?? readSvgViewBoxHeight(svgElement)
  }
}

function svgToDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg)
  const chunks: string[] = []

  for (let index = 0; index < bytes.length; index += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + 0x8000)))
  }

  return `data:image/svg+xml;base64,${window.btoa(chunks.join(''))}`
}

function estimateFrameHeight({ width, height }: SanitizedSvg): number {
  if (height && height > 0) {
    return Math.min(720, Math.max(180, Math.ceil(height + 32)))
  }

  if (width && width > 0) {
    return 260
  }

  return 260
}

function readSvgNumber(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Number.parseFloat(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readSvgViewBoxHeight(svgElement: Element): number | null {
  const viewBox = svgElement.getAttribute('viewBox')

  if (!viewBox) {
    return null
  }

  const parts = viewBox.split(/\s+/).map((part) => Number.parseFloat(part))
  const height = parts[3]

  return Number.isFinite(height) && height > 0 ? height : null
}

function containsUnsafeCss(value: string): boolean {
  const normalized = removeAsciiWhitespaceAndControls(value).toLowerCase()

  return (
    normalized.includes('@import') ||
    normalized.includes('expression(') ||
    normalized.includes('javascript:') ||
    normalized.includes('vbscript:') ||
    normalized.includes('data:text/html')
  )
}

function isUnsafeUri(value: string): boolean {
  const normalized = removeAsciiWhitespaceAndControls(value).toLowerCase()

  return (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:text/html')
  )
}

function removeAsciiWhitespaceAndControls(value: string): string {
  let normalized = ''

  for (const char of value) {
    if (char.charCodeAt(0) > 0x20) {
      normalized += char
    }
  }

  return normalized
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
