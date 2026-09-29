# GOAL-35 verification — Theme paper, panel sizing, content-fit islands

## Outcome and constraints

The resolved app theme selects the Reading and hover-preview paper by default; `readingPaper: light` retains the old light paper in dark chrome. Trusted islands inherit note tokens, Mermaid receives the resolved paper edition through its existing inert SVG document path, and untrusted custom frames retain a light card without a new permission or message. Export and print remain light. The workbench remains single-pane; GOAL-32 last-good Rendering and GOAL-34's scroll-surface `translateZ(0)` and body portal remain intact. `package.json`, `bun.lock`, preload, `example-vault/`, sandbox attributes, sanitizer and CSP are unchanged. Main-process production diffs are only the two additive settings files.

## Production visual evidence

`python .tmp/goal35/visual.py` passed against the built Electron app, using a disposable copy of `example-vault/` and a separate user-data directory under `.tmp/goal35/`. Its 15 screenshots are all **1920×1080** under `.tmp/screens/goal35/`: `dark-dns-top.png`, `dark-dns-mid.png`, `dark-registry-quiz.png`, `dark-registry-chart-tooltip.png`, `dark-registry-equation.png`, `dark-mermaid.png`, `dark-footnotes.png`, `dark-counter-fit.png`, `dark-hover-preview.png`, `light-dns-unchanged.png`, `dark-chrome-light-paper.png`, `panels-resized-drag.png`, `panels-keyboard-focus.png`, `panels-right-ai-resized.png`, and `exported-interactive-light.png`. Raw computed-style and interaction values are in `.tmp/goal35/visual-evidence.json`.

| Dark-paper text sample | Measured contrast |
| --- | ---: |
| Body, heading, table text, callout text, footnotes, KaTeX | 13.35:1 |
| Link, red accent label, callout title, footnote reference | 7.65:1 |
| Code text on code fill | 13.35:1 |
| Mark text on accent fill and selection text on accent fill | 7.65:1 |
| Pending Reading chip | 13.35:1 |

These measured samples exceed the 4.5:1 AA text floor. The computed dark chrome/paper seam is **1.08:1** (`rgb(18,25,33)` / `rgb(23,33,42)`), below the 3:1 target. The visual captures show a lifted editorial sheet rather than a cream slab, with themed chart tooltip and Mermaid SVG. The custom Counter frame settled at **80px** after its validated resize, versus the old 120px floor; its pending reservation remains 260px. The hover page preview reported `data-reading-paper="dark"`.

The interactive registry fixture was exported while the live app used dark paper. `.tmp/goal35/registry-export.html` contained the light paper stylesheet and opened with body `rgb(249,249,247)` in Chromium. The same app page under print media computed `rgb(249,249,247)`. No export-only main-process change was needed. All sandboxed export results were successful with no warnings or skipped items.

Explorer width moved to 21.5rem by drag, then 23.5rem by Shift+ArrowRight; context moved to 22rem and assistant to 25.5rem by drag. The compact 980px probe resized Explorer to 25rem. Pointer capture, keyboard focus, clamping and Enter/double-click reset are covered by implementation and reducer tests; the screenshots show hover/focus rule and document width.

## Performance and checks

`python .tmp/goal34/perf.py goal35-confirm` reran the GOAL-34 production harness after the final layout fit change (10 samples per metric). Raw output: `.tmp/goal34/perf-goal35-confirm.json`. An earlier final-build run, `.tmp/goal34/perf-goal35-final.json`, had a borderline DNS edit median miss of 143.7ms (12.1% above GOAL-34); its warm-open median was 114.7ms. The confirmation run passed, and the combined 20-sample edit median across those two runs was 134.6ms. The miss is retained as variability evidence, not hidden.

The first repository lint rerun included generated Electron user-data profiles and copied vaults under `.tmp/`, producing 4,580 errors, 8,597 warnings and 92 infos. After moving those disposable harness artifacts outside the repository and formatting the generated measurement JSON, the exact `bun run lint` command returned the final 386 errors and 1 warning shown below. No production source or test was excluded from lint.

| Metric | GOAL-34 after | GOAL-35 | +10% ceiling |
| --- | ---: | ---: | ---: |
| Warm DNS open median | 112.8ms | **103.0ms** | 124.1ms |
| DNS Reading edit→visible median | 128.2ms | **120.2ms** | 141.0ms |

| Command | Result |
| --- | --- |
| `bun run typecheck` | Passed |
| `bun test --parallel=4` | 501 passed, 0 failed, 116 files; includes settings/IPC, pure layout and separator, island policy and token coverage |
| `bun run build` | Passed; pre-existing bundler warnings only |
| `bunx biome check <changed TS/TSX/CSS files>` | 0 errors |
| `bun run lint` | 386 repository errors plus 1 generated-export size warning, exit 1; 387 diagnostics total, within ≤387 cap; changed-file Biome reports none |
| `git diff --check` | Passed |

Self-review fixes: moved the new settings service test into `tests/` so production `src/main/` diffs stay inside the two allowed files; kept pointer-move DOM work to one rAF-throttled CSS-variable write; added viewport fitting so saved widths cannot consume the 30rem document floor at the 800/1360px breakpoints; validated print lightness and all three panel edges in the final Electron run. Disposable Electron profiles and copied vaults generated by the harnesses were moved outside the repository before the final lint run; screenshot, export, measurement and harness files remain at the paths above. The repository-wide lint baseline remains nonzero and is outside this goal's authorization to rewrite.
