# GOAL-34 verification — production speed and raster integrity

## Method and evidence

Production Electron builds at `066c166` plus GOAL-34 changes, Windows 11, 1366×768 for latency and 1920×1080 for raster. `.tmp/goal34/perf.py` launches ten fresh CDP/user-data sessions. It measures process start to the first ready Welcome Reading surface; first and warm small/DNS opens; Reading source-change to target DOM change plus two animation frames; Source/Live keydown to next frame; palette and finder open. Each metric has ten samples. `.tmp/goal34/tree.py` measures ten Vault panel opens. This is a reproducible paint proxy, not photon/display latency. A disposable copy of `example-vault/` is recreated under `.tmp/goal34/vault`; the source files are reset before each run. The first exploratory run was discarded because typing autosaved into that disposable copy. No `example-vault/` file was changed.

Raw latency samples, long-task lists, and before/after sampled CPU-profile top-frame summaries are in `.tmp/goal34/results.zip` (the JSON filenames are `perf-before`, `perf-after`, `tree-before`, `tree-after`, `profile-before`, `profile-after`, and raster probe results). Full `.cpuprofile` traces were not retained. Probe scripts remain in `.tmp/goal34/`; screenshots are under `.tmp/screens/goal34/`.

| Operation (ms; n=10) | Before median / p90 | After median / p90 | Goal |
| --- | ---: | ---: | --- |
| Cold process → Welcome Reading ready | 2303.8 / 2652.2 | 2021.7 / 2279.5 | Improve; aim ≤1500 |
| First small open | 158.2 / 211.4 | 113.7 / 134.5 | — |
| First DNS open | 508.4 / 558.1 | 417.5 / 471.8 | median ≤250 **miss** |
| Warm small open | 121.5 / 130.6 | 90.5 / 111.4 | ≤60 / ≤100 **miss** |
| Warm DNS open | 148.8 / 197.2 | 112.8 / 128.8 | ≤100 / ≤150 (median **miss**) |
| Small Reading edit → visible | 32.6 / 36.9 | 26.0 / 30.4 | median ≤100 **pass** |
| DNS Reading edit → visible | 157.8 / 194.4 | 128.2 / 181.7 | median ≤150 **pass** |
| Source keydown → next frame, DNS | 13.2 / 15.8 | 8.1 / 9.9 | p90 ≤16 **pass** |
| Live keydown → next frame, DNS | 9.8 / 14.8 | 7.7 / 8.2 | p90 ≤16 **pass** |
| Command palette open | 29.0 / 43.1 | 20.1 / 24.3 | Record |
| File finder open | 31.6 / 43.5 | 21.2 / 27.8 | Record |
| Vault panel open | 43.9 / 50.2 | 46.2 / 59.2 | Record; slight regression |

The production CPU profile's largest attributable renderer open sample was in `MdxPreview`'s layout-ready effect stack (131.9 ms before, 122.4 ms after); `getBoundingClientRect` accounted for only 3.7/3.2 ms. Thus the discovery's dev-only ~52 ms geometry hypothesis did **not** justify replacing active-heading tracking. The first DNS open still includes worker compilation plus full MDX mount/layout: a separate same-source Bun worker-function probe took ~212 ms on its first compile and ~78–109 ms after warmup; that probe is supporting evidence, not an Electron timing. The production Reading-edit profile was mostly worker/native/idle time, with small renderer reconciliation samples. The Live typing profile included 11.6 ms aggregate `computeWordCount` before and none in its post-change top 20. Largest sampled long tasks were 192/189 ms before and 177/108 ms after. These are sampled aggregates, not a decomposition of a single latency.

Changes targeted those observations: stable per-note MDX component identities and current-source callbacks avoid unrelated island remounts; counts now debounce 120 ms then use idle time with a 120 ms timeout; completed worker output publishes promptly while GOAL-32 last-good/supersession remains; startup index and first-note reads run concurrently; Settings loads on first open rather than initial paint. The main IPC and file-read contract was not changed. The remaining open gap appears dominated by first worker compile and full-document commit/layout; no speculative IPC cache or renderer-side compilation was introduced. The cold-start improvement is measurable but the 1.5 s aim remains unmet.

An additional production status probe (`.tmp/goal34/status.py`) typed five separate words into DNS Source and observed the new word count 285.3–298.0 ms after the final key, within the approximate 300 ms requirement. Its browser polling adds measurement overhead; the scheduler itself requests a 120 ms debounce plus a 120 ms idle timeout.

## Raster and UI integrity

`.tmp/goal34/raster.py` navigated to the sample sandboxed interactive note and scrolled on every attempt. In the blank-paper artifact region, dark-pixel counts distinguished the visible diagonal marks: baseline CSS zoom 1 marked 7/10 attempts; removing zoom marked 12/20, rejecting the zoom hypothesis. `translateZ(0)` on `.mdx-preview` marked 16/20, on its live layer 11/20, and on the Reading **scroll surface** 0/20. The built GOAL-34 renderer, without runtime style overrides, marked **0/20**. Screenshots: `zoom1-*.png`, `nozoom-*.png`, `preview-transform-*.png`, `layer-transform-*.png`, `scroll-transform-*.png`, and `final-*.png` under `.tmp/screens/goal34/`. The evidence narrows the defect to Chromium compositing of the scroll surface after sandboxed iframe navigation; the precise Chromium invalidation bug is not established. The hint is scoped to that surface only.

`compile-error-sticky.png` shows the last-good DNS content and compile-error bar after scrolling 500 px; the bar top and scroll-root top both measured 116 px. `pending-chip-sticky.png` shows the pending chip during a large valid recompile. `fixed-selection-toolbar.png` shows the selection toolbar at the selected text; DOM inspection confirmed its portal parent is `document.body`, so the transformed scroll root does not reposition the fixed control. Text appears sharp at 100% in the final screenshot; this is visual inspection, not a font-raster metrology claim. Existing Reading zoom tests remain unchanged.

The production island smoke (`.tmp/goal34/island-smoke.py`) answered Welcome's `QuizBlock`, used **Reading view: Zoom in** to rerender the preview, and confirmed the selected radio DOM node was identical and remained checked. This directly checks that an unrelated preview rerender does not remount that island.

## Graph and constraints

The app's existing template convention is root `templates/*.mdx`; title placeholders (`{{…}}` and `{…}`) are also detectable without new frontmatter. A default-off **Show template notes** checkbox is in Graph settings. The renderer filters template nodes and incident edges consistently in the canvas and accessible navigator. Production UI smoke: 49 default returned nodes / 0 `{{title}}` labels, then 53 / 2 after enabling the toggle; `graph-templates-shown.png` records the state. The toggle is session-scoped. Because filtering is after the existing bounded query, hidden templates can still consume a server result slot in a truncated graph; changing that would require an IPC contract change outside this goal.

No new dependencies, `Bun.*` in `src`, main/preload change, `allow-same-origin`, or `dangerouslySetInnerHTML` were introduced. `package.json`, `bun.lock`, `example-vault/`, and preload remain unchanged. The workbench remains single-pane.

## Checks

| Command | Result |
| --- | --- |
| `bun run typecheck` | Pass |
| `bun test --parallel=4` | 495 pass, 0 fail, 113 files |
| `bun test --parallel=4` (eight sandbox/security/IPC files) | 30 pass, 0 fail |
| `bun run build` | Pass; existing bundler warnings only |
| `bunx biome check <changed TS/TSX files>` | Pass: 14 files, 0 errors |
| `bun run lint` | 387 non-GOAL-34 diagnostics (exit 1), at the ≤387 cap; no changed-file diagnostics |
| `python .tmp/goal34/island-smoke.py` | Pass: QuizBlock DOM identity and state retained |

Self-review fixes: corrected the initial disposable-vault autosave contamination and reran the complete baseline; moved the fixed toolbar to a body portal after the scroll-surface transform; added the missing status-effect dependency and formatted the changed files. The strict S1 opens and 1.5 s cold-start aim remain the material performance limitations; the Vault-panel p90 regressed slightly in this sample.
