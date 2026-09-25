# GOAL-19 — Publishing-grade Interactive Note export fidelity

> Executing agent: read this entire file before doing anything.
> Also read and follow [AGENTS.md](../AGENTS.md), [docs/security.md](../docs/security.md),
> and [goals/README.md](README.md). This goal changes export and sandbox-adjacent code;
> the security model is a hard invariant.

---

## Objective

Make a canonical `theme: interactive-note` note faithfully shareable as one self-contained
HTML file.

Both **Static HTML** and **Interactive HTML** exports must preserve authored prose, literal
props, nested trusted-component structure, editorial styling, assets, and source order.
Interactive export must keep trusted React behavior working offline and keep every vault
custom island inside its existing sandbox boundary. Static export must provide useful,
honest, no-JavaScript representations instead of blank roots, generic unknown-component
cards, or controls that appear usable but do nothing.

The export pipeline must never evaluate arbitrary MDX in the main process, silently replace
authored values with demo defaults, retain remote runtime dependencies, or broaden an
island's permissions.

This is the existing reserved GOAL-19 from [goals/README.md](README.md), not a new competing
goal number.

---

## Why this is the next product goal

mdx-vault's core loop is currently incomplete:

1. The user can write a prose-first MDX note.
2. GOAL-17 and GOAL-21 can turn it into an explorable article inside the app.
3. The existing export command reports success, but the resulting file loses much of that
   article's content, composition, behavior, and visual identity.

The missing third step weakens a stated product moat: portable files plus high-quality
interactive UX plus export/share. Adding more components before fixing this boundary would
increase registry/export drift.

### Product reference decision

The interactive Liveblocks article
[“How CRDTs and sync engines keep realtime lists ordered with fractional indexing”](https://liveblocks.io/blog/how-crdts-and-sync-engines-keep-realtime-lists-ordered-with-fractional-indexing)
is a quality reference for the **reading experience**, not a request for CRDTs or realtime
collaboration.

Adopt these qualities:

- prose introduces one concept at a time;
- a small direct-manipulation model immediately lets the reader test that concept;
- later sections reuse the same visual language for conflicts, comparisons, scale, and edge
  cases;
- the article remains coherent from introduction through a real implementation;
- the shared browser artifact feels intentional, not like an app screenshot with broken
  controls.

Do not adopt its product domain. Custom sync engines, multiplayer editing, CRDTs, presence,
and collaboration remain outside mdx-vault's current product scope.

---

## Context

- **Created**: 2026-07-22.
- **Depends on**: GOAL-05, GOAL-07, GOAL-17, and GOAL-21. GOAL-22 may already be
  complete; this lower number is intentional because GOAL-19 was a reserved slot, not an
  execution-order claim.
- **Executor**: an autonomous coding agent; no human review is expected between plan steps.
- **Canonical product fixture**: `example-vault/notes/Cache Hierarchy & Locality.mdx`.
- **Required output format**: a single `.html` file that opens directly through `file://` in
  a modern Chromium browser without a server or network access.
- **Existing size policy**: warn above 5 MiB and hard-block above 25 MiB. Preserve those
  thresholds unless repository evidence requires a separately documented decision.

At goal creation, the worktree contains unrelated modified and untracked user work,
including `DESIGN.md`, `docs/roadmap.md`, `goals/README.md`, example-vault notes,
interactives, templates, and an experimental `interactive-mdx` skill. Inspect current status
again before implementation. Do not revert, overwrite, format, stage, or commit unrelated
changes.

---

## Evidence Snapshot — 2026-07-22

| Area | Repository evidence | Consequence |
| --- | --- | --- |
| Registry coverage | [`registry/index.tsx`](../src/renderer/src/preview/registry/index.tsx) registers 22 trusted components. [`export-bundler.ts`](../src/main/services/export-bundler.ts), [`export-static-snapshot.ts`](../src/main/services/export-static-snapshot.ts), and [`export-service.ts`](../src/main/services/export-service.ts) independently know only the original 5 | All 17 GOAL-17/21 components drift to unknown or empty output |
| Authored props | `runInteractive()` substitutes `DEFAULT_PROPS_BY_COMPONENT`; static export passes `props: undefined` | A successful export can show unrelated sample content instead of the note |
| Literal expressions | `tryParseExpressionValue()` retains primitives but drops array/object literals | `options`, `items`, `cells`, `nodes`, and other important props disappear |
| Nested composition | `remarkReplaceMdxJsxWithPlaceholder()` replaces a component without serializing its descendants | `WidgetFrame → PredictionGate → SandboxedHTML`, `MentalModel → MentalModelRow`, `SelfTest → SelfTestItem`, and `Recap → ComparisonBars` cannot round-trip |
| React context | Hydration mounts every placeholder as a separate React root | `WidgetFrame` context cannot reach `PredictionGate`, even if both survive parsing |
| Sandbox identity | Registry and sandbox names are re-associated with surviving placeholders by parallel ordering | A removed nested placeholder can pair the wrong sandbox with the wrong source position |
| Theme | [`interactive-note-theme.css`](../src/renderer/src/preview/interactive-note-theme.css) is renderer-only; export always uses the generic stylesheet in [`export-template.ts`](../src/main/services/export-template.ts) | Paper/ink palette, hard shadows, typography hierarchy, and `.in-*` component styles are absent |
| Vault React islands | The sandbox runner waits for a parent `init` message; standalone export has no equivalent host bridge | An approved React island can render a blank iframe |
| Sandbox HTML islands | The iframe remains `sandbox="allow-scripts"`, but export does not process resize messages | Security is retained, but content can be clipped |
| Datasets and fallback | Datasets are counted but not delivered; static export ignores manifest fallback; fallback resolution can use the note directory instead of the island directory | Offline examples can be incomplete or misleading |
| Asset containment | Asset totals omit base64/bundle overhead; remote URLs can remain; ordinary reads do not prove real paths remain under the vault | Final files can violate size/offline claims or inline bytes through a symlink escape |
| Verification | No deterministic export test suite was found; `scripts/verify-export.ts` writes artifacts but does not assert their contents or behavior | Regressions can ship while export still reports success |
| Documentation | [`interactive-note-authoring.md`](../docs/interactive-note-authoring.md) explicitly tells authors to report missing export fidelity | The limitation is known and intentionally reserved for this goal |

These are starting hypotheses. The executor must reproduce them with focused tests before
changing architecture and update this snapshot in the completion report if any claim is
wrong.

---

## Target State

### 1. A safe, lossless export representation

Replace the lossy placeholder/parallel-array association with one explicit, versioned,
JSON-serializable export representation built from the parsed MDX AST.

It must preserve:

- prose and safe Markdown/HTML descendants in source order;
- each trusted registry component's exact name;
- authored literal props, including strings, booleans, finite numbers, `null`, arrays, and
  plain objects;
- nested trusted-component trees;
- nested sandbox nodes with stable identity and source position;
- text/element children needed by layout components;
- diagnostic source location when parsing cannot safely represent a value.

Literal extraction may recursively interpret only safe ESTree literal forms. It must reject
or diagnose identifiers, calls, member access, computed keys, spreads, functions, template
execution, imports/exports, prototype-polluting keys, and any other expression that would
require code execution. Do not use `eval`, `Function`, dynamic `import()`, MDX `evaluate()`,
or renderer execution to obtain export props.

An unsupported value is never replaced by a default. The export scan must return a typed,
actionable diagnostic naming the component, prop, and source line. A fidelity-blocking issue
must prevent a misleading “successful” export; if an intentional fallback is allowed, the
dialog and generated file must both state it explicitly.

### 2. Exhaustive registry export policy

Every trusted entry in `componentRegistry` must have an explicit export policy for both
static and interactive modes. The architecture may use a shared serializable manifest,
colocated descriptors, or a generated adapter, but it must provide one auditable contract
instead of three hand-maintained name/default maps.

Required invariants:

- adding or removing a renderer registry entry fails a coverage test until export behavior
  is declared;
- the export policy cannot silently invent different default props from the renderer;
- props pass the same effective validation rules as in-app preview before rendering;
- the interactive bundle includes only components used by the exported note plus shared
  runtime dependencies;
- unsupported/browser-only static behavior is a named policy with a meaningful fallback,
  not an accidental “Unknown component” result;
- component import paths and CSS inclusion cannot drift unnoticed.

The fidelity target is especially strict for all 17 interactive-note entries:
`NotePrimer`, `PrimerTerm`, `HighlightBox`, `FormulaLine`, `MentalModel`,
`MentalModelRow`, `TraceBlock`, `WidgetFrame`, `PredictionGate`, `Recap`, `SelfTest`,
`SelfTestItem`, `EvidenceLog`, `EvidenceItem`, `ComparisonBars`, `CellGrid`, and
`FlowSequence`.

The original five registry components remain regression-covered. This goal does not require
inventing new chart types or component APIs.

### 3. Static HTML fidelity

Static export must render the complete authored component tree server-side or through an
equivalently deterministic no-JavaScript strategy.

- Static/layout components preserve authored props, children, ordering, labels, captions,
  and nested prose.
- `PredictionGate` retains its question and options and offers an honest no-JavaScript
  answer/explanation disclosure, such as semantic `<details>`, without presenting an inert
  commit button.
- `SelfTestItem` preserves its question, level, and an accessible answer disclosure.
- `WidgetFrame` does not claim a runtime state that cannot change in static mode.
- `ComparisonBars`, `CellGrid`, and `FlowSequence` retain their data-driven visual meaning;
  their text remains available to assistive technology.
- `EvidenceItem` retains the existing “missing evidence” honesty rule.
- Browser-dependent original components retain their authored data in a meaningful explicit
  fallback (for example, a table, initial-state figure, or labeled summary), even if the live
  control cannot run.
- A sandbox island uses its manifest fallback resolved relative to the island directory. If
  no valid fallback exists, show a descriptive card with the island name and reason; never a
  blank frame.

No kit component in the canonical fixture may degrade to “Unknown component”, “Register this
component”, an empty custom element, or missing prose.

### 4. Interactive HTML fidelity

Interactive export must rebuild each top-level trusted subtree as one React root so normal
parent/child semantics and context survive.

At minimum:

- authored array/object props reach components exactly;
- `WidgetFrame` contains its real `PredictionGate` and sandbox child in source order;
- committing a prediction once changes the frame from `LOCKED` to `READY`; the committed
  choice cannot be changed;
- `SelfTestItem` reveal works;
- `CellGrid`, `FlowSequence`, `ComparisonBars`, and all prose/layout children render with the
  same semantic content as preview;
- multiple instances of one component remain independent;
- hydration has no uncaught console errors and does not require a server;
- static markup is useful before hydration and hydration does not duplicate or erase it.

Do not add gate-to-iframe lifecycle orchestration in this goal. The current in-app contract
only requires `PredictionGate` and `WidgetFrame` to compose correctly; a future goal may add
`READY → RUNNING → DONE` coordination with a sandbox experiment.

### 5. Standalone sandbox host bridge

Interactive export must include the smallest host-owned adapter needed to run already
approved Level 3/4 islands offline under the same permission model.

It must:

- preserve one source node ↔ one resolved manifest ↔ one iframe identity;
- emit the validated initialization message required by vault React islands;
- pass exact authored serializable props;
- listen for and apply validated resize messages for both React and HTML islands;
- answer only manifest-approved embedded dataset requests;
- route a message only to the iframe that owns the request;
- keep denied, prompt, missing, hash-mismatched, or unsupported islands on an explicit safe
  fallback path;
- remain deterministic when two or more islands are nested among registry components.

Each iframe must remain `sandbox="allow-scripts"` with no `allow-same-origin`. Keep a
restrictive sandbox-document CSP. Validate message shape with Zod and verify `event.source`;
because an opaque sandbox origin can be `null`, also use a per-frame unguessable capability
or equivalent binding rather than trusting origin text alone. Do not expose raw
`postMessage`, filesystem APIs, Electron APIs, or arbitrary parent DOM access to island code.

Export does not grant network access. An island that fundamentally requires a remote network
must receive an explicit offline diagnostic/fallback; do not leave a hidden runtime request.

### 6. Editorial theme and responsive presentation

When frontmatter contains `theme: interactive-note`, the generated document must opt into an
export-scoped version of the real interactive-note theme:

- paper/ink/accent/result palette;
- sharp borders and hard shadows;
- display/body/monospace hierarchy;
- prose headings, tables, code, callouts, formulas, and all `.in-*` components;
- focus-visible states and accessible contrast;
- wide-reading layout plus a usable narrow viewport without horizontal page overflow.

Avoid a second manually copied theme that can silently drift. Extract, transform, or bundle
the existing theme through a deterministic build path and cover key selectors/tokens with a
test.

The final file must not load Google Fonts or any other remote font at runtime. If exact font
files are added, they must be locally packaged, license-compatible, and embedded as data
URIs. Otherwise use a deterministic documented system fallback while retaining the intended
three-voice hierarchy. Do not download assets during export.

Notes without `theme: interactive-note` keep the existing generic export presentation and
gain only correctness/security fixes required by the shared pipeline.

### 7. Truly self-contained assets and size accounting

The final HTML must contain everything it needs:

- trusted React runtime and tree bundle;
- export/component/theme CSS;
- locally packaged fonts, if used;
- local Markdown images;
- manifest fallbacks;
- manifest-approved datasets;
- approved custom-island source/bundle;
- static math/code assets already supported by export.

No `http:`, `https:`, protocol-relative, vault-relative, app-relative, or machine-absolute
runtime **subresource dependency** may remain. Ordinary external `<a>` hyperlinks may remain
as inert navigation references, but they must not be prefetched and are not exercised during
the offline pass. A remote image, script, style, font, frame, fetch, or other runtime source in
the note is a typed blocking diagnostic or an explicit local fallback, never a claim of
offline completeness.

Asset reads must resolve symlinks/junctions and prove the final real path remains under the
vault or the specifically approved island root before reading bytes. Preserve MIME allowlists
and reject unsupported data types. Do not inline unrelated note or vault content.

The 5 MiB warning and 25 MiB hard limit must account for the actual UTF-8 output size after
base64 expansion, CSS, fonts, trusted bundles, and sandbox bundles—not only raw source asset
bytes. A blocked/failed export must not leave a partial target file.

### 8. Honest export UX and diagnostics

Keep the existing Export dialog and progress model; do not redesign the application shell.
Extend the scan/result contract only as needed so the user can see before writing:

- blocking unsupported expressions/components;
- denied or unavailable sandboxes;
- missing/invalid fallbacks or datasets;
- remote dependencies;
- size warnings;
- intentional static-mode fidelity limitations.

Messages must identify the note location and explain the next action. Do not expose absolute
paths, secrets, source hashes, or raw stack traces in renderer-visible errors. After success,
the dialog reports the real final size and any non-blocking fallbacks used.

---

## Required Behavior Matrix

| Source construct | Static HTML | Interactive HTML |
| --- | --- | --- |
| Markdown, safe HTML, math, code, image | Preserve content/order; inline local assets | Same |
| Static trusted component | Render exact authored tree and visual | Hydrate exact authored tree with useful initial markup |
| Stateful trusted component | Explicit semantic no-JS fallback; no fake control | Original behavior works; state isolated per instance |
| Nested trusted components | Preserve one composed tree | Hydrate as one root so context/children work |
| `SandboxedHTML` with approval | Manifest fallback or explicit unavailable card | Approved source runs in `allow-scripts` iframe and resizes |
| `Interactive` React island with approval | Manifest fallback or explicit unavailable card | Host initializes it with exact props/data; it mounts and resizes |
| Denied/prompt/hash-mismatched island | Explicit safe fallback and diagnostic | Explicit safe fallback and diagnostic; no source execution |
| Approved dataset | Represented in fallback if relevant | Embedded and returned only to its owning approved iframe |
| Unsupported expression or unknown component | Blocking typed diagnostic unless an explicit policy exists | Same; never substitute demo defaults |
| Remote runtime asset | Blocking offline diagnostic or explicit local fallback | Same; zero network requests |
| Oversized final artifact | Warning above 5 MiB; block above 25 MiB | Same |

---

## Constraints

- [ ] Preserve every invariant in [docs/security.md](../docs/security.md). Security wins over
  fidelity and the execution plan.
- [ ] Do not execute/evaluate note expressions in main, preload, export helpers, or the outer
  exported document.
- [ ] Do not add `allow-same-origin`, raw `file://` vault access, Node integration, Electron
  bridges, arbitrary parent DOM access, or broader sandbox permissions.
- [ ] Do not weaken approved-content hash checks, manifest allowlists, path validation, CSP,
  IPC sender validation, Zod validation, or leak scanning.
- [ ] Do not silently use component defaults when the note authored a value that export could
  not parse.
- [ ] Do not solve registry drift with another untested hand-maintained component-name list.
- [ ] Do not fetch fonts, images, scripts, styles, packages, or datasets from the network at
  export time or artifact runtime.
- [ ] Prefer existing React, MDX/unified, esbuild, Zod, and test infrastructure. Add no new
  runtime dependency unless the executor proves the existing stack cannot satisfy a required
  behavior and documents the security/bundle trade-off first.
- [ ] Preserve current 5 MiB warning and 25 MiB hard-limit semantics while correcting their
  accounting.
- [ ] Use atomic target writing or an equivalent temp-write/rename flow so failed export does
  not corrupt an existing destination.
- [ ] Automated tests must use a temporary vault/destination and must not modify
  `example-vault` or the user's real vault.
- [ ] Preserve unrelated dirty work. Do not run broad formatters over user-modified files;
  stage only goal-owned hunks when committing.
- [ ] Do not expand this goal into authoring AI, new widgets, collaboration, publishing, or
  application-shell redesign.
- [ ] If a required behavior conflicts with a security invariant or cannot be verified, stop
  and report the blocker instead of shipping a silent downgrade.

---

## Success Criteria and Required Evidence

| ID | Criterion | Required evidence |
| --- | --- | --- |
| IR-01 | Authored primitive, array, and plain-object literals survive exactly | Parser/IR unit tests using `options`, `items`, `cells`, `nodes`, nested objects, booleans, numbers, and `null` |
| IR-02 | Unsafe expressions never execute | Negative tests for calls, identifiers, member access, functions, spreads, computed keys, prototype keys, and import/export; assert typed diagnostics and zero side effects |
| IR-03 | Nested source order and identity are stable | Fixture with repeated/nested registry and sandbox nodes; assert exact serialized tree and source IDs |
| REG-01 | All current 22 registry entries declare static and interactive export behavior | Drift/coverage test comparing the live registry contract with export policy |
| REG-02 | No authored prop is replaced by a hard-coded sample default | Integration assertion against distinctive fixture values plus absence of legacy default text |
| STA-01 | Canonical static export retains all prose and all 17 kit components meaningfully | HTML assertions for section sentinel text, labels/captions, no unknown/empty placeholders, and no inert fake controls |
| STA-02 | Prediction and self-test content remains usable without JS | Browser test with JavaScript disabled verifies native disclosures and accessible text |
| INT-01 | Composed trusted behavior works | `WidgetFrame` contains `PredictionGate`; one commit locks choice and changes `LOCKED → READY`; refresh resets predictably |
| INT-02 | Stateful/visual kit works | Self-test reveal; CellGrid/FlowSequence/ComparisonBars render authored data; multiple instances do not share state |
| SBX-01 | Correct HTML and React islands occupy the correct source positions | Fixture contains at least two distinct islands; DOM/content assertions prove no identity swap |
| SBX-02 | Approved React island mounts with exact props and both island kinds resize | File-URL browser interaction plus iframe dimension assertions; no blank root or clipping |
| SBX-03 | Approved embedded dataset works offline and is capability-scoped | Island requests declared dataset successfully; undeclared/cross-frame request is rejected |
| SBX-04 | Static fallback resolves from the island directory | Fixture with a nested island/fallback path and byte/content assertion |
| THEME-01 | Interactive-note export retains editorial visual language | Key token/selector tests plus screenshots at desktop and narrow viewport; no generic rounded export shell inside the article |
| OFF-01 | Artifact is genuinely standalone | Copy exported HTML away from the temp vault, make source unavailable, open through `file://`, block network, and exercise required interactions |
| OFF-02 | Artifact makes zero external requests | Browser request log asserts no `http(s)` requests; source scan asserts no unresolved runtime URLs/paths |
| SIZE-01 | Limits use final encoded bytes | Boundary tests include base64 inflation, CSS, registry bundle, sandbox bundle, and optional fonts |
| SEC-01 | Sandbox isolation is unchanged | Assert exact iframe sandbox tokens, restrictive CSP, parent-document access failure, validated source-bound messages, and no `allow-same-origin` |
| SEC-02 | Path/leak protections hold | Tests reject an in-vault symlink/junction to outside bytes and scan for vault absolute paths, API-key fixtures, and unrelated-note sentinels |
| UX-01 | Failures and fallbacks are visible and actionable | Export-dialog test for blocking issue, size warning, sandbox fallback, and successful real-size report |
| REGRESS-01 | Existing generic exports still work | Static/interactive fixture using original registry components, Markdown image, math, code, and callout |
| QUAL-01 | Repository checks pass | `bun test`, `bun run typecheck`, `bun run lint`, `bun run build`, and `git diff --check` |

No criterion may be marked complete using only code inspection. Store deterministic test logs
and live-pass notes in the final execution report; screenshots may go in a temporary evidence
directory and must not be committed unless project convention requires it.

### Required Live Electron and Browser Pass

After automated tests pass:

1. Launch the real Electron app with an isolated temporary vault containing the canonical
   interactive-note fixture plus one approved HTML island and one approved React island.
2. Export both Static HTML and Interactive HTML through the actual Export dialog.
3. Confirm the dialog shows the correct inventory/diagnostics and final encoded file size.
4. Open the Static HTML via `file://` with JavaScript disabled. Verify complete prose,
   editorial styling, prediction/self-test disclosures, visual components, and sandbox
   fallbacks.
5. Copy the Interactive HTML outside the temporary vault, then make that temporary source
   vault unavailable. Never move/delete the repository's `example-vault` or a user vault.
6. Open the copied artifact via `file://` in a Chromium browser with network requests blocked
   and logged.
7. Exercise PredictionGate commit-once and `LOCKED → READY`, SelfTest reveal, the HTML island,
   the React island, and a manifest-approved dataset.
8. Confirm both iframe types resize, the two island fixtures remain in their intended source
   positions, and the browser console has no uncaught errors.
9. Attempt undeclared dataset access and parent-document access from the sandbox fixture;
   both must fail without affecting the outer document.
10. Inspect desktop and narrow screenshots for editorial hierarchy, focus visibility, readable
    code/tables, and absence of horizontal page overflow.
11. Confirm the request log contains zero external requests and the artifact contains no local
    absolute path, secret fixture, or unrelated-note sentinel.
12. Close the app/browser and clean only the verified temporary directories.

If the in-app Browser cannot load `file://`, perform the same pass with the project's
Playwright/browser test infrastructure and record that limitation. Do not replace the live
pass with static HTML inspection alone.

---

## Execution Plan

1. **Reproduce and freeze the failures.** Read the complete export, registry, MDX parse,
   sandbox bridge/service, asset, leak, IPC, and ExportDialog paths. Add focused failing tests
   for nested children, authored arrays/objects, stable sandbox identity, canonical note text,
   React sandbox initialization, resize, dataset delivery, theme absence, symlink escape, and
   final-size accounting.
2. **Define the export representation and diagnostics.** Introduce the safe versioned IR and
   literal ESTree decoder. Preserve locations and stable node IDs. Extend shared Zod schemas
   and IPC only where required; test both accepted and rejected syntax before replacing the
   old placeholder logic.
3. **Consolidate registry export policy.** Establish the auditable static/interactive contract,
   remove or derive the three duplicated maps, add all 17 kit entries, and make registry drift
   fail tests.
4. **Render composed trusted trees.** Make static mode render meaningful complete trees and
   interactive mode bundle/hydrate each composed top-level subtree as one root. Preserve
   authored props/children and useful pre-hydration markup.
5. **Bundle visual fidelity.** Produce an export-scoped generic/component stylesheet and the
   opt-in interactive-note theme from authoritative sources. Resolve the offline font choice,
   responsive behavior, and accessibility without runtime network access.
6. **Complete the standalone sandbox host.** Preserve identity; initialize React islands;
   validate and handle resize/dataset messages; resolve fallbacks relative to island roots;
   retain approval hashes, iframe sandboxing, CSP, and permission denial behavior.
7. **Harden assets, CSP, leaks, and writes.** Use realpath-aware containment, remove unresolved
   remote dependencies, embed permitted resources, calculate actual final bytes, preserve
   limits, strengthen outer-document CSP, and write atomically.
8. **Make failures visible.** Wire typed scan diagnostics and fallback/size reporting into the
   existing Export dialog without redesigning app chrome.
9. **Run the full test matrix.** Use temporary fixtures; verify all 22 policies, both modes,
   offline/file-URL behavior, sandbox security, regression fixtures, tests, typecheck, lint,
   build, and diff checks.
10. **Perform the required live pass.** Record observed results against every success ID and
    retain only intentional evidence.
11. **Update documentation.** Replace the export-fidelity caveat in
    [`interactive-note-authoring.md`](../docs/interactive-note-authoring.md), document the
    supported literal subset and fallback semantics, and update goal/roadmap bookkeeping only
    after preserving any concurrent user edits.
12. **Commit intentionally.** Recheck the dirty worktree, stage only GOAL-19 changes, use
    conventional commits, and report any pre-existing or intentionally uncommitted files.

Constraints override this plan. A discovered security or data-loss blocker stops execution;
do not bypass it to reach a green screenshot.

---

## Out of Scope

- CRDTs, realtime sync, multiplayer editing, presence, comments, or collaboration.
- Publishing/hosting, accounts, public URLs, analytics, or a deployment service.
- Whole-vault or multi-note static-site generation.
- PDF, EPUB, image, presentation, or print-layout export.
- Importing/caching arbitrary remote assets or dependencies.
- New registry widgets, chart types, visual builders, or a redesign of existing component APIs.
- AI-generated note planning, “Make explorable” prompt changes, automatic widget generation,
  or authoring-agent workflows.
- Gate ↔ sandbox lifecycle orchestration, experiment outcomes, persistent learner progress,
  or `READY → RUNNING → DONE` state. Those require a separate interaction-contract goal.
- General app dark mode or a complete export-theme selector. Only existing generic export and
  `theme: interactive-note` fidelity are required.
- Changing vault file format, MDX conventions, registry trust levels, or permission semantics.
- Loosening the 25 MiB hard limit to fit a test fixture.

---

## Reference Artifacts

### Repository

- [Product vision](../docs/product-vision.md)
- [Architecture](../docs/architecture.md)
- [Security model](../docs/security.md)
- [MDX conventions](../docs/mdx-conventions.md)
- [Interactive-note authoring guide](../docs/interactive-note-authoring.md)
- [GOAL-07 — Export and share](GOAL-07-export-and-share.md)
- [GOAL-17 — Interactive Note MDX kit](GOAL-17-interactive-note-mdx-kit.md)
- [GOAL-21 — Tier-2 spatial visuals](GOAL-21-tier2-spatial-visuals.md)
- [`src/main/services/export-service.ts`](../src/main/services/export-service.ts)
- [`src/main/services/export-renderer.ts`](../src/main/services/export-renderer.ts)
- [`src/main/services/export-bundler.ts`](../src/main/services/export-bundler.ts)
- [`src/main/services/export-static-snapshot.ts`](../src/main/services/export-static-snapshot.ts)
- [`src/main/services/export-template.ts`](../src/main/services/export-template.ts)
- [`src/main/services/export-asset-collector.ts`](../src/main/services/export-asset-collector.ts)
- [`src/main/services/export-sandbox-bridge.ts`](../src/main/services/export-sandbox-bridge.ts)
- [`src/renderer/src/preview/registry/index.tsx`](../src/renderer/src/preview/registry/index.tsx)
- [`src/renderer/src/preview/interactive-note-theme.css`](../src/renderer/src/preview/interactive-note-theme.css)
- [`src/renderer/src/export/ExportDialog.tsx`](../src/renderer/src/export/ExportDialog.tsx)
- [`example-vault/notes/Cache Hierarchy & Locality.mdx`](../example-vault/notes/Cache%20Hierarchy%20%26%20Locality.mdx)

### External inspiration

- [Liveblocks fractional-indexing interactive article](https://liveblocks.io/blog/how-crdts-and-sync-engines-keep-realtime-lists-ordered-with-fractional-indexing) — progressive explanation and standalone interaction quality only; not a sync/collaboration requirement.

---

## Agent Instructions

1. Read this file, `AGENTS.md`, `goals/README.md`, and `docs/security.md` completely before
   making changes.
2. Inspect `git status` and preserve all unrelated user work.
3. Treat the Evidence Snapshot as hypotheses to reproduce, not memories to trust.
4. Follow Constraints over the Execution Plan whenever they conflict.
5. Work test-first at each security/fidelity seam; do not accept “the export file was written”
   as evidence that it is correct.
6. After each meaningful change, run the focused tests plus `bun run typecheck` and
   `bun run lint` as required by project instructions.
7. Do not mark a checkbox or success ID complete without the required evidence.
8. Stop on security, path-containment, data-loss, or unresolvable dirty-worktree conflicts;
   report the exact blocker instead of inventing a workaround.
9. On completion, report every success ID, live-pass result, test command, residual warning,
   changed file, and preserved unrelated change.
10. Commit only goal-owned work with conventional commit messages.
