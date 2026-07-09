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

const nodeRequire = createRequire(__filename)
const KATEX_EXPORT_STYLESHEET = loadKatexExportStylesheet()

export const STATIC_STYLESHEET = `
:root {
  color-scheme: light dark;
  --mdx-bg: #ffffff;
  --mdx-fg: #111827;
  --mdx-muted: #6b7280;
  --mdx-border: #e5e7eb;
  --mdx-muted-bg: #f3f4f6;
  --mdx-accent: #1f2937;
  --mdx-link: #2563eb;
  --mdx-code-keyword: #b91c1c;
  --mdx-code-title: #1d4ed8;
  --mdx-code-string: #8a5a00;
  --mdx-code-special: #6b21a8;
  --mdx-radius: 0.5rem;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --mdx-bg: #0b0f19;
    --mdx-fg: #f3f4f6;
    --mdx-muted: #9ca3af;
    --mdx-border: #1f2937;
    --mdx-muted-bg: #111827;
    --mdx-accent: #f3f4f6;
    --mdx-link: #93c5fd;
    --mdx-code-keyword: #f87171;
    --mdx-code-title: #93c5fd;
    --mdx-code-string: #facc15;
    --mdx-code-special: #c4b5fd;
  }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--mdx-bg); color: var(--mdx-fg); }
body { line-height: 1.65; font-size: 0.95rem; }
main.mdx-export { max-width: 48rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
header.mdx-export-header {
  border-bottom: 1px solid var(--mdx-border);
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  background: var(--mdx-bg);
}
header.mdx-export-header .mdx-export-meta {
  font-size: 0.75rem;
  color: var(--mdx-muted);
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
  border: 1px solid var(--mdx-border);
  border-radius: var(--mdx-radius);
  overflow: hidden;
}
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
.mdx-vault-frontmatter {
  margin: 1rem 0 1.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--mdx-radius);
  border: 1px solid var(--mdx-border);
  background: var(--mdx-muted-bg);
  font-size: 0.85rem;
}
.mdx-vault-frontmatter dt {
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--mdx-muted);
}
.mdx-vault-frontmatter dd { margin: 0 0 0.5rem; }
${KATEX_EXPORT_STYLESHEET}
`

export const HYDRATION_SCRIPT = `
(function () {
  function hydrate() {
    var nodes = document.querySelectorAll('mdx-vault-component[data-component]');
    if (!nodes.length) return;
    var registry = window.__mdxVaultIslands;
    var runtime = window.__mdxVaultReact;
    if (!registry || !runtime) return;
    var React = runtime.React;
    var createRoot = runtime.createRoot;
    nodes.forEach(function (node) {
      var name = node.getAttribute('data-component');
      if (!name) return;
      var Component = registry[name];
      if (!Component) return;
      var propsAttr = node.getAttribute('data-props');
      var props = {};
      try { props = propsAttr ? JSON.parse(propsAttr) : {}; } catch (err) { props = {}; }
      var container = document.createElement('div');
      node.replaceWith(container);
      var root = createRoot(container);
      root.render(React.createElement(Component, props));
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
`

export interface RenderTemplateInput {
  title: string
  bodyHtml: string
  /** Front-matter map (stringified safely) — rendered as a small key/value block. */
  frontmatter?: Record<string, unknown>
  /** Inline CSS — defaults to STATIC_STYLESHEET. */
  stylesheet?: string
  /** Optional hydration script (interactive mode). */
  hydrationScript?: string
  /** Optional registry IIFE bundle script. */
  registryBundle?: string
  /** Optional generated timestamp ISO string. */
  generatedAt?: string
}

export function renderExportTemplate({
  title,
  bodyHtml,
  frontmatter,
  stylesheet = STATIC_STYLESHEET,
  hydrationScript,
  registryBundle,
  generatedAt
}: RenderTemplateInput): string {
  const safeTitle = escapeHtml(title)
  const frontmatterBlock = frontmatter ? renderFrontmatter(frontmatter) : ''
  const stamp = generatedAt ?? new Date().toISOString()
  const inlineRegistry = registryBundle ? `<script>\n${registryBundle}\n</script>` : ''
  const inlineHydration = hydrationScript ? `<script>\n${hydrationScript}\n</script>` : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="mdx-vault export">
<title>${safeTitle}</title>
<style>${stylesheet}</style>
</head>
<body>
<header class="mdx-export-header">
  <strong>${safeTitle}</strong>
  <span class="mdx-export-meta">Exported by mdx-vault · ${escapeHtml(stamp)}</span>
</header>
<main class="mdx-export">
${frontmatterBlock}
<article class="mdx-vault-export">
${bodyHtml}
</article>
</main>
${inlineRegistry}
${inlineHydration}
</body>
</html>
`
}

function renderFrontmatter(frontmatter: Record<string, unknown>): string {
  const entries = Object.entries(frontmatter).filter(([, value]) => value !== undefined)
  if (entries.length === 0) {
    return ''
  }

  const items = entries
    .map(([key, value]) => {
      const safeKey = escapeHtml(key)
      const displayValue = escapeHtml(formatFrontmatterValue(value))
      return `<dt>${safeKey}</dt><dd>${displayValue}</dd>`
    })
    .join('')

  return `<dl class="mdx-vault-frontmatter">${items}</dl>`
}

function formatFrontmatterValue(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (Array.isArray(value)) {
    return value.map(formatFrontmatterValue).join(', ')
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
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
