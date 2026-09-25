import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { SandboxManifest } from '../src/shared/sandbox'
import { SandboxExportBridge } from '../src/main/services/export-sandbox-bridge'
import { ExportService } from '../src/main/services/export-service'
import { SandboxService } from '../src/main/services/sandbox-service'
import { VaultService } from '../src/main/services/vault-service'

const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal19-live-'))
const vaultRoot = join(root, 'vault')
const artifactRoot = join(root, 'artifacts')
const htmlRoot = join(vaultRoot, 'interactives', 'html-fixture')
const reactRoot = join(vaultRoot, 'interactives', 'react-fixture')
const notePath = join(vaultRoot, 'notes', 'fidelity.mdx')
const staticPath = join(artifactRoot, 'fidelity.static.html')
const interactivePath = join(artifactRoot, 'fidelity.interactive.html')

await Promise.all([
  mkdir(join(vaultRoot, 'notes'), { recursive: true }),
  mkdir(join(vaultRoot, 'assets'), { recursive: true }),
  mkdir(htmlRoot, { recursive: true }),
  mkdir(reactRoot, { recursive: true }),
  mkdir(artifactRoot, { recursive: true })
])

const htmlManifest: SandboxManifest = {
  name: 'HTML identity fixture',
  version: '1.0.0',
  runtime: 'html',
  permissions: { network: false, filesystem: false, dataPaths: [] },
  propsSchema: {},
  dependencies: {},
  fallback: './fallback.svg'
}
const reactManifest: SandboxManifest = {
  name: 'React dataset fixture',
  version: '1.0.0',
  runtime: 'react',
  permissions: {
    network: false,
    filesystem: true,
    dataPaths: ['assets/live.json']
  },
  propsSchema: { label: 'string', datasetPath: 'string' },
  dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
  fallback: './fallback.svg'
}

await Promise.all([
  writeFile(notePath, noteSource(), 'utf8'),
  writeFile(
    join(vaultRoot, 'assets', 'live.json'),
    JSON.stringify({ source: 'embedded-approved-dataset', value: 42 }),
    'utf8'
  ),
  writeFile(
    join(vaultRoot, 'assets', 'unrelated.json'),
    'UNRELATED_NOTE_SENTINEL_MUST_NOT_EXPORT',
    'utf8'
  ),
  writeFile(join(htmlRoot, 'manifest.json'), JSON.stringify(htmlManifest), 'utf8'),
  writeFile(join(htmlRoot, 'index.html'), htmlIslandSource(), 'utf8'),
  writeFile(join(htmlRoot, 'fallback.svg'), fallbackSvg('HTML offline fallback'), 'utf8'),
  writeFile(join(reactRoot, 'manifest.json'), JSON.stringify(reactManifest), 'utf8'),
  writeFile(join(reactRoot, 'component.tsx'), reactIslandSource(), 'utf8'),
  writeFile(join(reactRoot, 'fallback.svg'), fallbackSvg('React offline fallback'), 'utf8')
])

const vault = new VaultService(vaultRoot)
const sandbox = new SandboxService(vault)
await allowSandbox(sandbox, 'html', '../interactives/html-fixture/index.html')
await allowSandbox(sandbox, 'interactive', '../interactives/react-fixture')

const service = new ExportService(vault, new SandboxExportBridge(sandbox))
const scan = await service.scan('notes/fidelity.mdx')
if (scan.diagnostics.some((entry) => entry.severity === 'blocking')) {
  throw new Error(`Fixture scan unexpectedly blocked: ${JSON.stringify(scan.diagnostics)}`)
}

const staticResult = await service.run(
  {
    noteRelativePath: 'notes/fidelity.mdx',
    mode: 'static',
    target: { absolutePath: staticPath },
    confirmedOversized: true
  },
  () => undefined
)
const interactiveResult = await service.run(
  {
    noteRelativePath: 'notes/fidelity.mdx',
    mode: 'interactive',
    target: { absolutePath: interactivePath },
    confirmedOversized: true
  },
  () => undefined
)

console.log(
  JSON.stringify({
    root,
    vaultRoot,
    artifactRoot,
    staticPath,
    interactivePath,
    scan,
    staticResult,
    interactiveResult
  })
)

async function allowSandbox(
  sandbox: SandboxService,
  kind: 'html' | 'interactive',
  src: string
): Promise<void> {
  const descriptor =
    kind === 'html'
      ? await sandbox.describeHtml(src, 'notes/fidelity.mdx')
      : await sandbox.describeInteractive(src, 'notes/fidelity.mdx')
  await sandbox.setPermission({
    kind,
    src,
    notePath: 'notes/fidelity.mdx',
    contentHash: descriptor.contentHash,
    decision: 'allow'
  })
}

function noteSource(): string {
  return `---
title: GOAL-19 offline fidelity
theme: interactive-note
---

# Offline fidelity sentinel

Authored prose stays before every interactive root.

<WidgetFrame title="Composed widget" misconception="Context disappears across export roots">
  <PredictionGate
    question="Which answer unlocks this frame?"
    options={["alpha", "beta", "gamma"]}
    answer="beta"
    explain="The first committed choice is final."
  />
  <SandboxedHTML src="../interactives/html-fixture/index.html" />
</WidgetFrame>

<PredictionGate
  question="Independent gate remains untouched?"
  options={["yes", "no"]}
  answer="yes"
/>

<Interactive
  src="../interactives/react-fixture"
  label="Exact React island prop"
  datasetPath="assets/live.json"
/>

<SelfTest>
  <SelfTestItem level={4} question="Can the static answer survive?">
    Exact self-test answer.
  </SelfTestItem>
</SelfTest>

<ComparisonBars items={[{ label: "Authored seven", value: 7, display: "seven" }]} />
<CellGrid columns={2} cells={[{ label: "A", state: "hit" }, { label: "B", state: "miss" }]} />
<FlowSequence nodes={[{ label: "Source" }, { label: "Artifact", accent: true }]} edgeLabels={["export"]} />
`
}

function htmlIslandSource(): string {
  return `<main id="html-island">
  <strong>Exact HTML island identity</strong>
  <div id="html-parent-access">checking</div>
  <div id="html-dataset-scope">checking</div>
  <div style="height: 260px">Resize sentinel</div>
</main>
<script>
window.addEventListener('load', async function () {
  try {
    window.parent.document.body.dataset.compromised = 'true'
    document.getElementById('html-parent-access').textContent = 'parent access unexpectedly allowed'
  } catch {
    document.documentElement.dataset.parentBlocked = 'true'
    document.getElementById('html-parent-access').textContent = 'parent access blocked'
  }
  try {
    await window.mdxVault.requestData('assets/live.json')
    document.getElementById('html-dataset-scope').textContent = 'cross-frame dataset unexpectedly allowed'
  } catch {
    document.getElementById('html-dataset-scope').textContent = 'cross-frame dataset denied'
  }
})
</script>`
}

function reactIslandSource(): string {
  return `import { useEffect, useState } from 'react'

export default function Fixture({ label, datasetPath }) {
  const [dataset, setDataset] = useState('loading')
  const [denied, setDenied] = useState('checking')

  useEffect(() => {
    window.mdxVault.requestData(datasetPath).then(setDataset, () => setDataset('failed'))
    window.mdxVault.requestData('assets/unrelated.json').then(
      () => setDenied('undeclared dataset unexpectedly allowed'),
      () => setDenied('undeclared dataset denied')
    )
  }, [datasetPath])

  return <main id="react-island" style={{ minHeight: 280 }}>
    <strong>{label}</strong>
    <div id="react-dataset">{dataset}</div>
    <div id="react-denied">{denied}</div>
    <div>Exact React island identity</div>
  </main>
}`
}

function fallbackSvg(label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="120" viewBox="0 0 640 120"><rect width="640" height="120" fill="#efefea"/><text x="24" y="68" font-family="monospace" font-size="24" fill="#111">${label}</text></svg>`
}
