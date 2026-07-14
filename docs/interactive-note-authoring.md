# Authoring Interactive Notes in MDX

Interactive Note Format B is an explorable reference note: prose remains the backbone, every section stays visible in a freely scrolling document, and at most three interactions challenge a specific misconception. In mdx-vault, the note is ordinary MDX plus trusted registry components. Authors no longer copy a page-sized CSS block, write gate/reveal JavaScript, or assemble an HTML shell for every note.

Start from `example-vault/templates/interactive-note.mdx`. The required opt-in is:

```yaml
---
title: Your note title
tags: [interactive-note]
theme: interactive-note
prerequisites: []
---
```

`theme: interactive-note` applies the Format B prose typography and paper palette. Without that exact value, the existing preview theme is unchanged. Kit components keep their component styling in an otherwise ordinary note.

## What the kit owns

The app provides:

- the source editorial palette and Playfair Display, Lora, and Courier Prime typography;
- sharp borders, hard shadows, primer, trace, formula, comparison, recap, question, and evidence styling;
- commit-once prediction state and immediate verdicts;
- local reveal state for self-test answers;
- Zod validation for every component at the registry boundary;
- an honest `[CHƯA CÓ]` state when an `EvidenceItem` has no result;
- a complete MDX skeleton through the vault template system.

The author or authoring agent still owns:

- concept scope, source fidelity, and the six-phase plan;
- term taxonomy and prerequisite closure;
- every misconception line, prediction question, answer, and explanation;
- spoiler ordering and the static recap after a gate;
- choosing whether a claim needs prose, a static visual, an interactive model, or real evidence;
- real benchmark commands and observed results. Never invent evidence.

## Six-phase workflow

### Phase 0 — Plan before editing MDX

Read the complete source note and create a written plan.

1. Confirm that the note is one concept node. Split sources with multiple major concepts or more than roughly eight sections.
2. Classify source blocks as text `[T]`, widget candidate `[W]`, evidence `[E]`, or self-test `[Q]`. Text should remain the majority.
3. Specify no more than three widgets. Each needs an exact misconception and a pattern: prediction gate, step-through model, parameter explorer, or toggle.
4. List Tier 2 visuals for quantitative comparisons, spatial layouts, and sequences.
5. Close the term taxonomy. A term is defined in this note, linked as a prerequisite, or removed. Every term used by a gate or visual label must be defined above it.

### Phase 1 — Create the note and port all prose

Create the note from `interactive-note.mdx`, complete its frontmatter, title, primer, and section headings, then move every `[T]` block into MDX before adding interactions. Leave MDX comments such as `{/* TIER2: latency comparison */}` and `{/* WIDGET-1: row versus column traversal */}` where later work belongs.

Keep behavior outside the note. Do not add component imports, exported values, functions, or long JSX bodies. A Format B note should remain readable as prose plus concise component tags.

### Phase 2 — Add static visuals

Use the cheapest medium that preserves the model:

- `MentalModel` and `MentalModelRow` for Extends, Conflicts, Requires, and Misapplication;
- `TraceBlock` for a whitespace-preserving mechanism sequence;
- `FormulaLine` for one formula or result line;
- `ComparisonBars` for quantitative comparisons;
- Markdown tables for structured tradeoffs and failure modes;
- `HighlightBox` for a version boundary or evidence caveat.

Adding a visual label introduces a term. Recheck taxonomy immediately. A one-liner needs no visual, and a self-test must not include a visual that reveals its answer.

### Phase 3 — Add widgets

Wrap a discrete-outcome interaction in `WidgetFrame`, state the targeted misconception, and put `PredictionGate` before the result:

```mdx
<WidgetFrame
  title="Widget 01 · Prediction-gated"
  misconception="Cùng số phép toán → cùng tốc độ"
>
  <PredictionGate
    question="Column-major traversal will produce which hit ratio?"
    options={["75%", "50%", "0%"]}
    answer="0%"
    explain="Each access moves to a different cache line."
  />
  <Interactive src="../interactives/cache-row-col" />
</WidgetFrame>

<Recap>Row-major fills four lines; column-major fills sixteen.</Recap>
```

A gate commits the first selection and cannot be changed after feedback appears. Its frame moves from `LOCKED` to `READY`. Put the literal answer and full summary after the gate, never above it.

`WidgetFrame` context applies only to trusted children in the same React tree. An `Interactive` runs in its own sandboxed iframe and cannot receive that context. Gate-to-iframe control wiring is not part of this kit; the sandbox remains the security boundary described in `docs/security.md`.

For a parameter explorer, ask readers to predict before manipulating it, but do not manufacture a hard gate when the source pattern is honor-system. Always provide a static conclusion after the interactive point.

### Phase 4 — Add the retrieval layer

Add an Evidence Log, exactly three self-test questions, links, and the note footer.

```mdx
<EvidenceLog>
  <EvidenceItem cmd="perf stat -e cache-misses ./benchmark" />
</EvidenceLog>

<SelfTest>
  <SelfTestItem level={3} question="Explain the mechanism.">Mechanism answer.</SelfTestItem>
  <SelfTestItem level={4} question="Where does the tradeoff reverse?">Tradeoff answer.</SelfTestItem>
  <SelfTestItem level={5} question="Diagnose the production case.">Applied answer.</SelfTestItem>
</SelfTest>
```

Leave an `EvidenceItem` childless until a real command has been run. The red `[CHƯA CÓ]` marker is a useful statement of maturity, not an empty state to hide.

### Phase 5 — Audit the result

Audit no more than three correction rounds:

1. Compare every source section against the MDX note; do not accept missing prose.
2. Confirm all gate/control/visual terms are defined above first use.
3. Confirm each widget names a misconception and stays within the three-widget budget.
4. Confirm no literal answer appears above its gate and every gate has a static recap after it.
5. Exercise commit-once prediction, self-test reveal, and empty evidence behavior in preview.
6. Create a note through the template flow and compile it.
7. Run `bun test`, `bun run typecheck`, and `bun run lint`.
8. Export once and record the observed fidelity. Export support can lag in-app registry and theme support; report placeholders or missing theme CSS instead of claiming parity.

## HTML-to-MDX mapping

| Previous Format B HTML | MDX kit |
| --- | --- |
| `.primer` | `NotePrimer` |
| `.primer-row` | `PrimerTerm` |
| `.highlight-box` | `HighlightBox` |
| `.formula-line` | `FormulaLine` |
| `.mm-grid` | `MentalModel` |
| `.mm-key` plus value cell | `MentalModelRow` |
| `.trace` | `TraceBlock` |
| `.widget`, `.widget-head`, `.widget-status` | `WidgetFrame` |
| `.gate`, `.gate-btn`, `.gate-verdict` plus custom JavaScript | `PredictionGate` |
| post-widget `.cmp-block` | `Recap` |
| `.lat-ladder` or quantitative `.cmp-block` | `ComparisonBars` |
| `.q-item` plus reveal JavaScript | `SelfTest` and `SelfTestItem` |
| Evidence table and `.cmd` | `EvidenceLog` and `EvidenceItem` |
| custom iframe HTML | `Interactive` with a vault-relative `src` |
| copied page CSS and font link | `theme: interactive-note` |
| copied HTML skeleton | `templates/interactive-note.mdx` |

All kit components are trusted Level 2 registry components. Their props are validated before rendering; invalid props show `ComponentValidationWarning` instead of crashing the preview. User or AI-authored executable code still belongs under `interactives/` and remains subject to the manifest and sandbox rules.
