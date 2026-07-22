import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseNoteToExportIr } from '../src/main/services/export-ir'
import { SandboxExportBridge } from '../src/main/services/export-sandbox-bridge'
import { ExportService } from '../src/main/services/export-service'
import { createInteractiveNoteExportStylesheet } from '../src/main/services/export-template'
import { SandboxService } from '../src/main/services/sandbox-service'
import { VaultService } from '../src/main/services/vault-service'
import { componentRegistry } from '../src/renderer/src/preview/registry'

describe('GOAL-19 safe export IR', () => {
  test('preserves literal arrays, objects, nulls, nested source order, and stable IDs', () => {
    const source = `<WidgetFrame title="Distinct frame">
  <PredictionGate
    question="Distinct question"
    options={["alpha", "beta"]}
    answer="beta"
    explain="Distinct explanation"
  />
  <CellGrid
    columns={2}
    cells={[{ label: "A", state: "hit" }, { label: "B", state: "miss" }]}
    groupSize={2}
    groupLabels={["PAIR"]}
  />
  <Interactive src="../interactives/demo" config={{ enabled: true, count: -2, note: null }} />
</WidgetFrame>`

    const first = parseNoteToExportIr(source, 'notes/fixture.mdx', 'Fixture')
    const second = parseNoteToExportIr(source, 'notes/fixture.mdx', 'Fixture')
    const widget = first.ir.children[0]

    expect(first.meta.diagnostics).toEqual([])
    expect(first.ir).toEqual(second.ir)
    expect(JSON.parse(JSON.stringify(first.ir))).toEqual(first.ir)
    expect(widget.type).toBe('component')
    if (widget.type !== 'component') throw new Error('Expected WidgetFrame root')
    expect(widget.name).toBe('WidgetFrame')
    expect(widget.children.map((child) => child.type)).toEqual([
      'component',
      'component',
      'sandbox'
    ])

    const gate = widget.children[0]
    const grid = widget.children[1]
    const sandbox = widget.children[2]
    expect(gate.type === 'component' ? gate.props.options : null).toEqual(['alpha', 'beta'])
    expect(grid.type === 'component' ? grid.props.cells : null).toEqual([
      { label: 'A', state: 'hit' },
      { label: 'B', state: 'miss' }
    ])
    expect(sandbox.type === 'sandbox' ? sandbox.props.config : null).toEqual({
      enabled: true,
      count: -2,
      note: null
    })
    expect(new Set(collectIds(first.ir.children)).size).toBe(collectIds(first.ir.children).length)
  })

  test('rejects executable and prototype-polluting expressions without side effects', () => {
    ;(globalThis as Record<string, unknown>).__goal19SideEffect = 0
    const cases = [
      'value={dangerousCall()}',
      'value={identifier}',
      'value={source.member}',
      'value={() => 1}',
      'value={{ ...source }}',
      'value={{ [source.key]: 1 }}',
      'value={{ __proto__: { polluted: true } }}',
      ['value={', '`prefix-$', '{dangerousCall()}`', '}'].join(''),
      '{...source}'
    ]

    for (const attribute of cases) {
      const source = `<Interactive src="../interactives/demo" ${attribute} />`
      const result = parseNoteToExportIr(source, 'notes/unsafe.mdx', 'Unsafe')
      expect(result.meta.diagnostics.some((entry) => entry.severity === 'blocking')).toBe(true)
    }

    const esm = parseNoteToExportIr(
      'export const value = dangerousCall()\n\n# Content',
      'notes/unsafe-esm.mdx',
      'Unsafe ESM'
    )
    expect(esm.meta.diagnostics.map((entry) => entry.code)).toContain('UNSUPPORTED_MDX_ESM')
    expect((globalThis as Record<string, unknown>).__goal19SideEffect).toBe(0)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  test('keeps one colocated export policy for every live registry entry', async () => {
    expect(componentRegistry).toHaveLength(22)
    expect(new Set(componentRegistry.map((entry) => entry.name)).size).toBe(22)

    for (const entry of componentRegistry) {
      expect(entry.exportPolicy.interactive).toBe('hydrate')
      expect(entry.exportPolicy.static.length).toBeGreaterThan(0)
      expect(entry.exportPolicy.entryExport.length).toBeGreaterThan(0)
      await expect(stat(join(process.cwd(), entry.exportPolicy.modulePath))).resolves.toBeDefined()
    }
  })
})

describe('GOAL-19 composed export integration', () => {
  test('renders authored static disclosures and an offline interactive composed root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mdx-vault-goal19-'))
    const notes = join(root, 'notes')
    const staticTarget = join(root, 'static.html')
    const interactiveTarget = join(root, 'interactive.html')

    try {
      await mkdir(notes, { recursive: true })
      await writeFile(
        join(notes, 'fidelity.mdx'),
        `---
title: Distinct export fixture
theme: interactive-note
---

# Distinct export prose

<WidgetFrame title="Distinct frame" misconception="Distinct misconception">
  <PredictionGate
    question="Distinct question"
    options={["alpha", "beta", "gamma"]}
    answer="beta"
    explain="Distinct explanation"
  />
  <Recap>
    <ComparisonBars items={[{ label: "Distinct bar", value: 7, display: "seven" }]} />
  </Recap>
</WidgetFrame>

<SelfTest>
  <SelfTestItem level={4} question="Distinct self-test">Distinct answer</SelfTestItem>
</SelfTest>

<CellGrid columns={2} cells={[{ label: "C0", state: "hit" }, { label: "C1", state: "miss" }]} />
<FlowSequence nodes={[{ label: "Start" }, { label: "Finish", accent: true }]} edgeLabels={["then"]} />
`,
        'utf8'
      )

      const vault = new VaultService(root)
      const service = new ExportService(vault, new SandboxExportBridge(new SandboxService(vault)))
      const scan = await service.scan('notes/fidelity.mdx')
      expect(scan.diagnostics).toEqual([])

      const staticResult = await service.run(
        {
          noteRelativePath: 'notes/fidelity.mdx',
          mode: 'static',
          target: { absolutePath: staticTarget },
          confirmedOversized: true
        },
        () => undefined
      )
      const staticHtml = await readFile(staticTarget, 'utf8')
      expect(staticResult.size).toBe(Buffer.byteLength(staticHtml, 'utf8'))
      expect(staticHtml).toContain('Distinct export prose')
      expect(staticHtml).toContain('Distinct question')
      expect(staticHtml).toContain('Distinct explanation')
      expect(staticHtml).toContain('Distinct self-test')
      expect(staticHtml).toContain('Distinct answer')
      expect(staticHtml).toContain('<details')
      expect(staticHtml).toContain('C0')
      expect(staticHtml).toContain('Finish')
      expect(staticHtml).not.toContain('Unknown component')
      expect(staticHtml).not.toContain('Register this component')
      expect(staticHtml).not.toContain('Which invariant makes binary search valid?')
      expect(staticHtml).not.toContain('<button')
      expect(staticHtml).toContain('--in-paper: #f9f9f7')

      const interactiveResult = await service.run(
        {
          noteRelativePath: 'notes/fidelity.mdx',
          mode: 'interactive',
          target: { absolutePath: interactiveTarget },
          confirmedOversized: true
        },
        () => undefined
      )
      const interactiveHtml = await readFile(interactiveTarget, 'utf8')
      expect(interactiveResult.size).toBe(Buffer.byteLength(interactiveHtml, 'utf8'))
      expect(interactiveHtml).toContain('data-export-root-id')
      expect(interactiveHtml).toContain('mdx-vault-export-data')
      expect(interactiveHtml).toContain('Distinct question')
      expect(interactiveHtml).not.toContain('Which invariant makes binary search valid?')
      expect(interactiveHtml).not.toMatch(
        /<(?:img|script|link|iframe)[^>]+(?:src|href)=["']https?:/i
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)

  test('derives export theme selectors and system font fallbacks from the authoritative CSS', () => {
    const source = `.mdx-preview { font-family: 'Lora', serif; }
.mdx-preview.theme-interactive-note h1 { font-family: 'Playfair Display', serif; }
.mdx-preview .in-trace { font-family: 'Courier Prime', monospace; }`
    const result = createInteractiveNoteExportStylesheet(source)

    expect(result).toContain('.mdx-vault-export.theme-interactive-note h1')
    expect(result).toContain("Georgia, 'Times New Roman', serif")
    expect(result).toContain("'Courier New', Consolas, monospace")
    expect(result).not.toContain('.mdx-preview')
    expect(result).not.toContain('fonts.googleapis.com')
  })
})

function collectIds(nodes: Array<{ id: string; type: string; children?: unknown[] }>): string[] {
  return nodes.flatMap((node) => [
    node.id,
    ...(Array.isArray(node.children)
      ? collectIds(node.children as Array<{ id: string; type: string; children?: unknown[] }>)
      : [])
  ])
}
