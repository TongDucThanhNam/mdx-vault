# GOAL-19 — Interactive note export fidelity completion report

Completed on 2026-07-22.

## Outcome

Static HTML and Interactive HTML exports now preserve safe authored MDX as one self-contained file. The pipeline builds a versioned, JSON-serializable IR without evaluating note code, uses a colocated export policy for every trusted registry component, renders composed trees with exact authored props, derives the interactive-note export theme from its authoritative stylesheet, embeds permitted local assets and datasets, and keeps custom islands in `sandbox="allow-scripts"` frames.

Static mode provides semantic no-JavaScript disclosures and explicit island fallbacks. Interactive mode hydrates each top-level trusted subtree as one root and supplies the validated standalone host bridge required by approved HTML and React islands. Scan and result diagnostics expose blocking fidelity problems, intentional fallbacks, and actual encoded size. Final writes are atomic.

## Evidence snapshot disposition

All starting hypotheses in GOAL-19 were reproduced by focused tests or direct source-path tracing. The original implementation had five-component export maps, default-prop substitution, primitive-only expression recovery, flattened component placeholders, one React root per placeholder, positional sandbox reassociation, generic-only CSS, no standalone React-island initialization, no exported resize/dataset host, note-relative fallback resolution, raw-input size accounting, and no deterministic assertion suite.

No starting hypothesis was disproved. The live Electron pass also found one adjacent Export dialog defect not listed in the snapshot: choosing a destination and starting an export required a second click, and switching modes could reuse and overwrite the previous destination. The dialog now runs immediately after destination selection and requires a fresh destination after a completed export.

## Success criteria

| ID | Result | Evidence |
| --- | --- | --- |
| IR-01 | Pass | `goal19-export-fidelity.test.ts` preserves primitive, array, nested object, boolean, number, and `null` props exactly. |
| IR-02 | Pass | Negative IR cases cover calls, identifiers, member access, functions, spreads, computed keys, prototype keys, and ESM; a side-effect sentinel remains unchanged. |
| IR-03 | Pass | Nested/repeated trusted and sandbox nodes assert exact order, structural nesting, locations, and stable source IDs. |
| REG-01 | Pass | Coverage compares all 22 live registry entries with their colocated static and interactive policies; every entry is declared. |
| REG-02 | Pass | Distinct authored values survive static and interactive output; legacy sample defaults are absent. |
| STA-01 | Pass | The all-kit content fixture renders all 17 interactive-note components, authored sentinels, and nested prose without unknown or empty placeholders. |
| STA-02 | Pass | Chromium with JavaScript disabled exercises three native disclosures and finds no interactive buttons. |
| INT-01 | Pass | File-URL Chromium verifies nested `WidgetFrame`/`PredictionGate`, `LOCKED → READY`, commit-once locking, independent gates, and predictable initial state. |
| INT-02 | Pass | Self-test reveal works; authored CellGrid, FlowSequence, and ComparisonBars content renders; independent state is unchanged. |
| SBX-01 | Pass | Distinct HTML and React identity sentinels remain at their intended source positions. |
| SBX-02 | Pass | Approved React island mounts with exact props; HTML and React frames both resize without blank or clipped roots. |
| SBX-03 | Pass | The declared embedded dataset is returned; undeclared and cross-frame requests are denied. |
| SBX-04 | Pass | A nested-island fixture asserts fallback bytes resolved relative to the island directory. |
| THEME-01 | Pass | Tests assert authoritative tokens/selectors and local system fallbacks; desktop/narrow screenshots retain the paper/ink/accent language with no page overflow. |
| OFF-01 | Pass | Both app-generated artifacts opened through `file://`; the interactive artifact remained fully functional after the temporary source vault was renamed unavailable. |
| OFF-02 | Pass | Blocked-network browser logs contain zero external requests; source scans find no unresolved runtime URL or machine path. |
| SIZE-01 | Pass | Boundary tests use actual final UTF-8 bytes, including base64 expansion, CSS, registry runtime, and sandbox bundles; 5 MiB warns and 25 MiB blocks. |
| SEC-01 | Pass | Both frames have the exact `allow-scripts` token, restrictive CSP, opaque origins, capability/source-bound messages, and denied parent access; no `allow-same-origin` appears. |
| SEC-02 | Pass | Junction escape is rejected; artifact scans reject vault paths, secret fixtures, and unrelated-note sentinels. |
| UX-01 | Pass | Typed scan/result coverage plus the live dialog show blocking issues, size warnings, named fallbacks, inventory, and actual final size. |
| REGRESS-01 | Pass | Original five components and Markdown image, math, code, and callout fixtures pass in both modes. |
| QUAL-01 | Pass | `bun test`, typecheck, lint, build, and `git diff --check` pass. |

## Automated verification

| Command | Result |
| --- | --- |
| `bun test tests/goal19-export-fidelity.test.ts tests/goal19-export-content.test.ts tests/goal19-export-hardening.test.ts` | 10 tests passed, 200 assertions passed |
| `bun test` | 255 tests passed, 1,921 assertions passed, 0 failures |
| `bun run typecheck` | Passed |
| `bun run lint` | Passed |
| `bun run build` | Passed |
| `git diff --check` | Passed |

The deterministic Playwright verifier additionally covered JavaScript-disabled static output, desktop and 390 px viewports, composed trusted interactions, two sandbox kinds, approved/denied dataset requests, parent isolation, resize, zero network traffic, console/page errors, source-vault unavailability, and artifact leak scans.

## Required live Electron and browser pass

The real Electron app was launched with isolated `userData` and a generated temporary vault. The note preview showed both approved islands. The Export dialog reported 7 used registry components, 2 sandbox islands, 0 images, 0 datasets referenced directly by the note, 0 links, and no blocking diagnostics.

- Interactive export completed through the native save dialog at 3,224,266 encoded bytes (reported as 3.1 MB).
- Static export completed through the native save dialog at 1,488,426 encoded bytes (reported as 1.4 MB) and named both intentional static island fallbacks.
- Static `file://` output with JavaScript disabled retained complete prose, editorial styling, three native disclosures, data-driven visuals, and both fallback representations.
- The interactive artifact was copied outside the vault, the source vault was renamed unavailable, and Chromium loaded it with network routing blocked.
- Prediction commit-once, `LOCKED → READY`, self-test reveal, exact HTML/React identities, exact React props, approved dataset delivery, both resize paths, undeclared/cross-frame denial, and parent access denial all passed.
- Both iframe sandbox attributes were exactly `allow-scripts`; the outer document remained uncompromised.
- Request, console-error, and page-error logs were empty. Desktop and narrow views had no horizontal page overflow.
- Artifact scans found no temporary vault path, API-key fixture, or unrelated-note sentinel.

Screenshots were retained outside the repository at `C:\Users\terasumi\.codex\visualizations\2026\07\22\019f877c-454e-70c0-a868-03cb383161bc\goal19`. Generated vaults, artifacts, browser state, and Electron `userData` were temporary and moved to the Windows Recycle Bin after verification.

## Changed files

- Export model and contracts: `src/shared/export.ts`, `src/main/services/export-ir.ts`, `src/preload/index.d.ts`, `src/main/ipc/export-ipc.ts`.
- Render/bundle pipeline: `export-renderer.ts`, `export-static-snapshot.ts`, `export-bundler.ts`, `export-template.ts`, and `export-service.ts` under `src/main/services/`.
- Sandbox/assets: `export-asset-collector.ts`, `export-sandbox-bridge.ts`, and `sandbox-service.ts` under `src/main/services/`.
- Export UI: `src/renderer/src/export/ExportDialog.tsx`.
- Registry contract: `src/renderer/src/preview/registry/types.ts`, the original entries `algorithm-visualizer.ts`, `counter.ts`, `data-chart.ts`, `equation-slider.ts`, and `quiz-block.ts`, plus all 17 files under `src/renderer/src/preview/registry/interactive-note/`.
- Verification: `tests/goal19-export-fidelity.test.ts`, `tests/goal19-export-content.test.ts`, `tests/goal19-export-hardening.test.ts`, `scripts/goal19-live-fixture.ts`, and `scripts/verify-goal19-export.py`.
- Documentation: `docs/interactive-note-authoring.md` and this report.

## Residual warnings and preserved work

The production build retains the repository's existing `gray-matter` eval warning and existing chunk/dynamic-import size warnings; no new build failure or runtime dependency was introduced. System font stacks are used deliberately, so the three-voice hierarchy remains offline without embedding licensed font binaries.

Pre-existing modified and untracked work in `DESIGN.md`, `docs/roadmap.md`, `goals/README.md`, `example-vault/`, `docs/research/interactive-note-skill/`, and the user-provided GOAL-19 file was left untouched and uncommitted.
