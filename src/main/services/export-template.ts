/**
 * Self-contained HTML template for mdx-vault exports.
 *
 * Two modes share most of the template:
 * - Static: only prose + island snapshots; no React hydration.
 * - Interactive: prose + island snapshots/placeholders + an IIFE bundle that
 *   mounts registry components into `<mdx-vault-component>` placeholders,
 *   and srcdoc iframes for sandboxed islands.
 *
 * Both modes keep sandboxed code in `<iframe sandbox="allow-scripts">` —
 * the same trust model used in-app.
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join } from 'node:path'
import registryUtilitySource from '../../renderer/src/preview/export-registry.css?inline'
import interactiveNoteThemeSource from '../../renderer/src/preview/interactive-note-theme.css?raw'
import { scopeRegistryStylesheet } from './export-registry-style'

const nodeRequire = createRequire(__filename)
const KATEX_EXPORT_STYLESHEET = loadKatexExportStylesheet()
const INTERACTIVE_NOTE_EXPORT_STYLESHEET = createInteractiveNoteExportStylesheet(
  interactiveNoteThemeSource
)
const REGISTRY_EXPORT_STYLESHEET = scopeRegistryStylesheet(registryUtilitySource)
const NOTE_EXPORT_FONT_STYLESHEET = loadNoteExportFontStylesheet()

export const STATIC_STYLESHEET = `
:root {
  color-scheme: light;
  --mdx-bg: #f9f9f7;
  --mdx-fg: #111111;
  --mdx-muted: #111111;
  --mdx-border: #111111;
  --mdx-muted-bg: #efefea;
  --mdx-accent: #d32f2f;
  --mdx-link: #d32f2f;
  --mdx-code-keyword: #d32f2f;
  --mdx-code-title: #111111;
  --mdx-code-string: #111111;
  --mdx-code-special: #111111;
  --mdx-radius: 0;
  font-family: 'Lora', serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--mdx-bg); color: var(--mdx-fg); }
body { line-height: 1.65; font-family: 'Lora', serif; font-size: 0.95rem; }
main.mdx-export { max-width: 48rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
header.mdx-export-header {
  min-height: 40px;
  border-bottom: 2px solid var(--mdx-border);
  padding: 0.55rem 1.5rem;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  background: var(--mdx-fg);
  color: var(--mdx-bg);
  font-family: 'Courier Prime', monospace;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
header.mdx-export-header .mdx-export-meta {
  font-size: 0.75rem;
  color: #d32f2f;
}
.mdx-export-static-notice {
  margin: 0 0 1rem;
  color: var(--mdx-muted);
  font-family: 'Courier Prime', monospace;
  font-size: 0.75rem;
  border-bottom: 1px solid var(--mdx-border);
  padding-bottom: 0.5rem;
}
.mdx-vault-export h1, .mdx-vault-export h2, .mdx-vault-export h3 {
  font-weight: 650;
  line-height: 1.2;
  margin-top: 1.6rem;
  margin-bottom: 0.6rem;
}
.mdx-vault-export h1 { font-size: 1.8rem; margin-top: 0.4rem; }
.mdx-vault-export h2 { font-size: 1.35rem; }
.mdx-vault-export h3 { font-size: 1.1rem; }
.mdx-vault-export p { margin: 0.8rem 0; }
.mdx-vault-export ul, .mdx-vault-export ol { padding-left: 1.35rem; }
.mdx-vault-export ul { list-style: disc; }
.mdx-vault-export ol { list-style: decimal; }
.mdx-vault-export li + li { margin-top: 0.25rem; }
.mdx-vault-export mark {
  background: color-mix(in srgb, #b8860b 24%, transparent);
  color: var(--mdx-fg);
  padding: 0 0.18em;
}
.mdx-vault-export a {
  color: var(--mdx-link);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.mdx-vault-export code {
  background: var(--mdx-muted-bg);
  border-radius: 0.25rem;
  padding: 0.12rem 0.28rem;
  font-size: 0.86em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.mdx-vault-export pre {
  overflow: auto;
  border-radius: var(--mdx-radius);
  border: 1px solid var(--mdx-border);
  background: var(--mdx-muted-bg);
  padding: 1rem;
}
.mdx-vault-export pre code { background: transparent; padding: 0; }
.mdx-vault-export pre code.hljs { display: block; }
.mdx-vault-export .hljs-comment,
.mdx-vault-export .hljs-quote { color: var(--mdx-muted); font-style: italic; }
.mdx-vault-export .hljs-keyword,
.mdx-vault-export .hljs-selector-tag,
.mdx-vault-export .hljs-subst { color: var(--mdx-code-keyword); font-weight: 700; }
.mdx-vault-export .hljs-title,
.mdx-vault-export .hljs-section,
.mdx-vault-export .hljs-function .hljs-title,
.mdx-vault-export .hljs-title.function_ { color: var(--mdx-code-title); font-weight: 700; }
.mdx-vault-export .hljs-string,
.mdx-vault-export .hljs-attr,
.mdx-vault-export .hljs-attribute,
.mdx-vault-export .hljs-symbol,
.mdx-vault-export .hljs-template-variable,
.mdx-vault-export .hljs-variable { color: var(--mdx-code-string); }
.mdx-vault-export .hljs-number,
.mdx-vault-export .hljs-literal,
.mdx-vault-export .hljs-built_in,
.mdx-vault-export .hljs-builtin-name,
.mdx-vault-export .hljs-type,
.mdx-vault-export .hljs-meta { color: var(--mdx-code-special); }
.mdx-vault-export .hljs-deletion { color: var(--mdx-code-keyword); }
.mdx-vault-export .hljs-addition { color: var(--mdx-code-title); }
.mdx-vault-export .mdx-callout {
  --callout-accent: var(--mdx-fg);
  --callout-bg: color-mix(in srgb, var(--callout-accent) 8%, var(--mdx-bg));
  margin: 1.25rem 0;
  border: 2px solid var(--callout-accent);
  border-left-width: 8px;
  background: var(--callout-bg);
  box-shadow: 3px 3px 0 var(--callout-accent);
  padding: 0.85rem 1rem 1rem;
}
.mdx-vault-export .mdx-callout[data-callout='info'] { --callout-accent: var(--mdx-muted); }
.mdx-vault-export .mdx-callout[data-callout='tip'] { --callout-accent: var(--mdx-link); }
.mdx-vault-export .mdx-callout[data-callout='warning'] { --callout-accent: #b8860b; }
.mdx-vault-export .mdx-callout[data-callout='danger'] { --callout-accent: #dc2626; }
.mdx-vault-export .mdx-callout-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--callout-accent);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.35;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.mdx-vault-export .mdx-callout-title::before {
  display: inline-flex;
  width: 1.2rem;
  height: 1.2rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--callout-accent);
  background: var(--mdx-bg);
  color: var(--callout-accent);
  box-shadow: 2px 2px 0 var(--callout-accent);
  content: 'N';
  font-size: 0.8rem;
  line-height: 1;
}
.mdx-vault-export .mdx-callout[data-callout='info'] .mdx-callout-title::before { content: 'i'; }
.mdx-vault-export .mdx-callout[data-callout='tip'] .mdx-callout-title::before { content: '+'; }
.mdx-vault-export .mdx-callout[data-callout='warning'] .mdx-callout-title::before { content: '!'; }
.mdx-vault-export .mdx-callout[data-callout='danger'] .mdx-callout-title::before { content: 'X'; }
.mdx-vault-export .mdx-callout > * + * { margin-top: 0.6rem; }
.mdx-vault-export .mdx-mermaid-fallback {
  margin: 1.25rem 0;
  border: 2px solid var(--mdx-fg);
  background: var(--mdx-muted-bg);
  box-shadow: 3px 3px 0 var(--mdx-fg);
  padding: 0;
}
.mdx-vault-export .mdx-mermaid-fallback figcaption {
  border-bottom: 2px solid var(--mdx-fg);
  padding: 0.55rem 0.75rem;
  color: var(--mdx-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.mdx-vault-export .mdx-mermaid-fallback pre {
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.mdx-vault-export table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.mdx-vault-export th, .mdx-vault-export td {
  border: 1px solid var(--mdx-border);
  padding: 0.5rem 0.65rem;
  text-align: left;
}
.mdx-vault-export th { background: var(--mdx-muted-bg); font-weight: 600; }
.mdx-vault-export details {
  border-radius: var(--mdx-radius);
  border: 1px solid var(--mdx-border);
  padding: 0.75rem 1rem;
  background: var(--mdx-muted-bg);
}
.mdx-vault-export summary { cursor: pointer; font-weight: 600; }
.mdx-vault-export blockquote {
  margin: 1rem 0;
  padding: 0.25rem 1rem;
  border-left: 3px solid var(--mdx-border);
  color: var(--mdx-muted);
}
.mdx-vault-export img { max-width: 100%; height: auto; }
.mdx-vault-export hr { border: none; border-top: 1px solid var(--mdx-border); margin: 1.5rem 0; }

.mdx-vault-snapshot, .mdx-vault-snapshot-placeholder {
  margin: 1.25rem 0;
  padding: 1rem;
  border: 1px solid var(--mdx-border);
  border-radius: var(--mdx-radius);
  background: var(--mdx-bg);
}
.mdx-vault-snapshot-placeholder { background: var(--mdx-muted-bg); }
.mdx-vault-snapshot-placeholder-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.mdx-vault-snapshot-placeholder-body {
  font-size: 0.85rem;
  color: var(--mdx-muted);
}
.mdx-vault-sandbox {
  margin: 1.25rem 0;
  border: 2px solid var(--mdx-fg);
  box-shadow: 3px 3px 0 var(--mdx-fg);
  overflow: hidden;
}
.mdx-vault-sandbox-content { overflow: hidden; background: var(--mdx-bg); }
.mdx-vault-sandbox-frame {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
}
.mdx-vault-unresolved {
  color: var(--mdx-muted);
  border-bottom: 1px dashed currentColor;
  cursor: help;
}
.mdx-vault-component[data-mdx-component-id] {
  display: block;
}
.mdx-vault-static-control-summary,
.mdx-vault-static-data-summary,
.mdx-vault-static-quiz {
  margin: 1.25rem 0;
  border: 2px solid var(--mdx-fg);
  background: var(--mdx-bg);
  box-shadow: 3px 3px 0 var(--mdx-fg);
  padding: 1rem;
}
.mdx-vault-export .mdx-vault-static-island { margin: 1.25rem 0; }
.mdx-vault-export .mdx-vault-static-island > :is(figure, section) { margin-top: 0; }
.mdx-vault-static-control-summary figcaption,
.mdx-vault-static-data-summary figcaption {
  margin-bottom: 0.65rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.mdx-vault-static-control-summary output { font-size: 1.4rem; font-weight: 700; }
.mdx-vault-static-options { margin: 0.65rem 0; }
.mdx-vault-sandbox-fallback-slot { margin: 1.25rem 0; }
.mdx-vault-sandbox-fallback { margin: 0; }
.mdx-vault-sandbox-fallback img { display: block; max-width: 100%; height: auto; }
.mdx-vault-export--interactive-note {
  --mdx-bg: #f9f9f7;
  --mdx-fg: #111111;
  --mdx-muted: #555555;
  --mdx-border: #111111;
  --mdx-muted-bg: #efefea;
  --mdx-link: #2b5797;
  max-width: 64rem;
}
@media (max-width: 42rem) {
  header.mdx-export-header { align-items: flex-start; flex-direction: column; }
  main.mdx-export { padding: 1.25rem 0.85rem 3rem; }
  .mdx-vault-export .in-mm-grid { grid-template-columns: minmax(6.5rem, 34%) 1fr; }
  .mdx-vault-export .in-comparison-row { grid-template-columns: minmax(6.5rem, 1fr) 1fr auto; }
  .mdx-vault-export .in-widget-body { padding: 0.85rem; }
  .mdx-vault-export .in-gate { padding: 0.85rem; }
  .mdx-vault-export table { display: block; max-width: 100%; overflow-x: auto; }
}
${KATEX_EXPORT_STYLESHEET}
`

export interface RenderTemplateInput {
  title: string
  bodyHtml: string
  /** Inline CSS — defaults to STATIC_STYLESHEET. */
  stylesheet?: string
  /** Optional hydration script (interactive mode). */
  hydrationScript?: string
  /** Optional registry IIFE bundle script. */
  registryBundle?: string
  /** Serialized hydration roots and standalone sandbox documents. */
  exportData?: unknown
  /** Preserve the legacy Format B class in addition to the global note theme. */
  interactiveNoteTheme?: boolean
  /** Optional generated timestamp ISO string. */
  generatedAt?: string
}

export function renderExportTemplate({
  title,
  bodyHtml,
  stylesheet,
  hydrationScript,
  registryBundle,
  exportData,
  interactiveNoteTheme = false,
  generatedAt
}: RenderTemplateInput): string {
  const safeTitle = escapeHtml(title)
  const stamp = generatedAt ?? new Date().toISOString()
  const inlineRegistry = registryBundle ? `<script>\n${registryBundle}\n</script>` : ''
  const inlineHydration = hydrationScript ? `<script>\n${hydrationScript}\n</script>` : ''
  const resolvedStylesheet =
    stylesheet ??
    `${NOTE_EXPORT_FONT_STYLESHEET}\n${STATIC_STYLESHEET}\n${INTERACTIVE_NOTE_EXPORT_STYLESHEET}\n${REGISTRY_EXPORT_STYLESHEET}`
  const exportDataBlock =
    exportData === undefined
      ? ''
      : `<script id="mdx-vault-export-data" type="application/json">${serializeInlineJson(exportData)}</script>`
  const contentSecurityPolicy = registryBundle
    ? "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'"
    : "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'"
  const articleClass = interactiveNoteTheme
    ? 'mdx-vault-export theme-editorial-note theme-interactive-note'
    : 'mdx-vault-export theme-editorial-note'
  const mainClass = 'mdx-export mdx-vault-export--interactive-note'
  const staticNotice =
    bodyHtml.includes('class="mdx-vault-static-island"') ||
    bodyHtml.includes('class="mdx-vault-sandbox-fallback-slot"')
      ? '<p class="mdx-export-static-notice">Static snapshots · Controls are available in the interactive export.</p>'
      : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
<meta name="generator" content="mdx-vault export">
<title>${safeTitle}</title>
<style>${resolvedStylesheet}</style>
</head>
<body>
<header class="mdx-export-header">
  <strong>${safeTitle}</strong>
  <span class="mdx-export-meta">Exported by mdx-vault · ${escapeHtml(stamp)}</span>
</header>
<main class="${mainClass}">
${staticNotice}
<article class="${articleClass}">
${bodyHtml}
</article>
</main>
${exportDataBlock}
${inlineRegistry}
${inlineHydration}
</body>
</html>
`
}

export function createInteractiveNoteExportStylesheet(source: string): string {
  return source.replaceAll('.mdx-preview', '.mdx-vault-export')
}

function serializeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('&', '\\u0026')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function loadNoteExportFontStylesheet(): string {
  const stylesheets = [
    '@fontsource/courier-prime/400.css',
    '@fontsource/courier-prime/700.css',
    '@fontsource/lora/400.css',
    '@fontsource/lora/400-italic.css',
    '@fontsource/playfair-display/700.css',
    '@fontsource/playfair-display/900.css'
  ]

  try {
    return stylesheets.map(inlineFontsourceStylesheet).join('\n')
  } catch {
    return ''
  }
}

function inlineFontsourceStylesheet(specifier: string): string {
  const cssPath = nodeRequire.resolve(specifier)
  const cssDirectory = dirname(cssPath)
  const css = readFileSync(cssPath, 'utf8')
  const fontFaces = css.match(/\/\*[^*]+\*\/\s*@font-face\s*\{[^}]+\}/g) ?? []

  return fontFaces
    .filter((fontFace) => /-(?:latin|latin-ext|vietnamese)-\d+-(?:normal|italic)/.test(fontFace))
    .map((fontFace) =>
      fontFace.replace(/src:\s*url\(([^)]+\.woff2)\)[^;]*;/, (_match, fontReference: string) => {
        const relativePath = fontReference.replace(/^['"]|['"]$/g, '')
        const fontPath = join(cssDirectory, relativePath)
        const font = readFileSync(fontPath)

        return `src: url(data:${fontMimeType(fontPath)};base64,${font.toString('base64')}) format('woff2');`
      })
    )
    .join('\n')
}

function loadKatexExportStylesheet(): string {
  try {
    const cssPath = nodeRequire.resolve('katex/dist/katex.min.css')
    const cssDirectory = dirname(cssPath)
    const css = readFileSync(cssPath, 'utf8')

    return css.replace(/url\((fonts\/[^)]+)\)/g, (_match, fontReference: string) => {
      const fontPath = join(cssDirectory, fontReference)
      const font = readFileSync(fontPath)
      return `url(data:${fontMimeType(fontReference)};base64,${font.toString('base64')})`
    })
  } catch {
    return ''
  }
}

function fontMimeType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.woff2':
      return 'font/woff2'
    case '.woff':
      return 'font/woff'
    case '.ttf':
      return 'font/ttf'
    default:
      return 'application/octet-stream'
  }
}
