import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SandboxExportBridge } from '../src/main/services/export-sandbox-bridge'
import { ExportService } from '../src/main/services/export-service'
import { SandboxService } from '../src/main/services/sandbox-service'
import { VaultService } from '../src/main/services/vault-service'

const INTERACTIVE_NOTE_COMPONENTS = [
  'NotePrimer',
  'PrimerTerm',
  'HighlightBox',
  'FormulaLine',
  'MentalModel',
  'MentalModelRow',
  'TraceBlock',
  'WidgetFrame',
  'PredictionGate',
  'Recap',
  'SelfTest',
  'SelfTestItem',
  'EvidenceLog',
  'EvidenceItem',
  'ComparisonBars',
  'CellGrid',
  'FlowSequence'
].sort()

describe('GOAL-19 complete content fidelity', () => {
  test('renders all 17 interactive-note components meaningfully', async () => {
    await withVault(
      `---
title: Complete kit fixture
theme: interactive-note
---

# COMPLETE_KIT_PROSE

<NotePrimer>
  <PrimerTerm term="KIT_PRIMER" href="#complete">KIT_PRIMER_BODY</PrimerTerm>
</NotePrimer>
<HighlightBox title="KIT_HIGHLIGHT">KIT_HIGHLIGHT_BODY</HighlightBox>
<FormulaLine>KIT_FORMULA</FormulaLine>
<MentalModel>
  <MentalModelRow label="KIT_MODEL_ROW" conflict>KIT_MODEL_BODY</MentalModelRow>
</MentalModel>
<TraceBlock>KIT_TRACE</TraceBlock>
<WidgetFrame title="KIT_WIDGET" misconception="KIT_MISCONCEPTION">
  <PredictionGate
    question="KIT_PREDICTION"
    options={["KIT_ALPHA", "KIT_BETA"]}
    answer="KIT_BETA"
    explain="KIT_EXPLANATION"
  />
</WidgetFrame>
<Recap>
  <ComparisonBars items={[{ label: "KIT_BAR", value: 7, display: "KIT_SEVEN" }]} />
</Recap>
<SelfTest>
  <SelfTestItem level={5} question="KIT_QUESTION">KIT_ANSWER</SelfTestItem>
</SelfTest>
<EvidenceLog>
  <EvidenceItem cmd="KIT_COMMAND" />
</EvidenceLog>
<CellGrid columns={2} cells={[{ label: "KIT_CELL_A", state: "hit" }, { label: "KIT_CELL_B", state: "miss" }]} />
<FlowSequence nodes={[{ label: "KIT_SOURCE" }, { label: "KIT_DESTINATION", accent: true }]} edgeLabels={["KIT_EDGE"]} />
`,
      async ({ service, staticTarget }) => {
        const scan = await service.scan('notes/fixture.mdx')
        expect(scan.usedComponents).toEqual(INTERACTIVE_NOTE_COMPONENTS)
        expect(scan.diagnostics).toEqual([])

        await service.run(
          {
            noteRelativePath: 'notes/fixture.mdx',
            mode: 'static',
            target: { absolutePath: staticTarget },
            confirmedOversized: true
          },
          () => undefined
        )
        const html = await readFile(staticTarget, 'utf8')
        for (const sentinel of [
          'COMPLETE_KIT_PROSE',
          'KIT_PRIMER',
          'KIT_PRIMER_BODY',
          'KIT_HIGHLIGHT',
          'KIT_FORMULA',
          'KIT_MODEL_ROW',
          'KIT_TRACE',
          'KIT_WIDGET',
          'KIT_PREDICTION',
          'KIT_ALPHA',
          'KIT_EXPLANATION',
          'KIT_BAR',
          'KIT_QUESTION',
          'KIT_ANSWER',
          'KIT_COMMAND',
          '[CHƯA CÓ]',
          'KIT_CELL_A',
          'KIT_SOURCE',
          'KIT_DESTINATION',
          'KIT_EDGE'
        ]) {
          expect(html).toContain(sentinel)
        }
        expect(html).toContain('<details')
        expect(html).not.toContain('<button')
        expect(html).not.toContain('Unknown component')
      }
    )
  }, 30_000)

  test('keeps generic exports, local images, math, code, and callouts working in both modes', async () => {
    await withVault(
      `# GENERIC_PROSE

> [!NOTE]
> GENERIC_CALLOUT

![GENERIC_IMAGE](../assets/pixel.svg)

Inline math $x^2 + y^2$.

\`\`\`ts
const GENERIC_CODE = 41
\`\`\`

<Counter initial={41} />
<QuizBlock
  question="GENERIC_QUIZ"
  options={["GENERIC_WRONG", "GENERIC_RIGHT"]}
  answerIndex={1}
  explanation="GENERIC_EXPLANATION"
/>
<EquationSlider
  formula="GENERIC_FORMULA"
  compute="x + 1"
  variables={{ x: { min: 0, max: 4, default: 2, step: 1 } }}
/>
<DataChart
  type="line"
  data={[{ x: 0, y: 1 }, { x: 1, y: 3 }]}
  x="x"
  y="y"
  title="GENERIC_CHART"
/>
<AlgorithmVisualizer algorithm="bubble-sort" data={[3, 1, 2]} speed={150} />
`,
      async ({ root, service, staticTarget, interactiveTarget }) => {
        await mkdir(join(root, 'assets'), { recursive: true })
        await writeFile(
          join(root, 'assets', 'pixel.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg"><rect width="2" height="2" /></svg>'
        )

        const scan = await service.scan('notes/fixture.mdx')
        expect(scan.usedComponents).toEqual([
          'AlgorithmVisualizer',
          'Counter',
          'DataChart',
          'EquationSlider',
          'QuizBlock'
        ])
        expect(scan.diagnostics).toEqual([])

        for (const [mode, target] of [
          ['static', staticTarget],
          ['interactive', interactiveTarget]
        ] as const) {
          await service.run(
            {
              noteRelativePath: 'notes/fixture.mdx',
              mode,
              target: { absolutePath: target },
              confirmedOversized: true
            },
            () => undefined
          )
          const html = await readFile(target, 'utf8')
          expect(html).toContain('GENERIC_PROSE')
          expect(html).toContain('GENERIC_CALLOUT')
          expect(html).toContain('data:image/svg+xml;base64,')
          expect(html).toContain('katex')
          expect(html).toContain('GENERIC_CODE')
          expect(html).toContain('GENERIC_QUIZ')
          expect(html).toContain('GENERIC_FORMULA')
          expect(html).toContain('GENERIC_CHART')
          const initialMarkup = html.slice(0, html.indexOf('<script id="mdx-vault-export-data"'))
          expect(initialMarkup).not.toContain('Which invariant makes binary search valid?')
          expect(html).not.toMatch(/<(?:img|script|link|iframe)[^>]+(?:src|href)=["']https?:/i)
        }
      }
    )
  }, 30_000)
})

async function withVault(
  source: string,
  run: (fixture: {
    root: string
    service: ExportService
    staticTarget: string
    interactiveTarget: string
  }) => Promise<void>
): Promise<void> {
  const parent = await mkdtemp(join(tmpdir(), 'mdx-vault-goal19-content-'))
  const root = join(parent, 'vault')
  const staticTarget = join(parent, 'static.html')
  const interactiveTarget = join(parent, 'interactive.html')

  try {
    await mkdir(join(root, 'notes'), { recursive: true })
    await writeFile(join(root, 'notes', 'fixture.mdx'), source)
    const vault = new VaultService(root)
    const service = new ExportService(vault, new SandboxExportBridge(new SandboxService(vault)))
    await run({ root, service, staticTarget, interactiveTarget })
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
}
