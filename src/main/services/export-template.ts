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
