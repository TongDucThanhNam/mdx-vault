# GOAL-39 — production startup and first-open latency

## Verdict and clocks

**Complete on the controlled production Electron medians (2026-09-30).** All event-based targets pass in the final interleaved A/B, including first small and first DNS. This is a median result, not a claim that every individual click is under budget: first-small p90 is 64.4ms and max 82.1ms. The first-small-after-DNS subset has a 63.9ms median; first-small immediately after Welcome has a 41.5ms median. The next round can address that order-dependent tail without relabeling this target as missed.

`.tmp/goal39/paired_ab.py 12 final-round3b` built HEAD `bd85f84` in `.tmp/g39-head` and measured HEAD/current alternately, 12 times per side, with the same disposable vault and profile policy. A fresh profile is first launched and fully quit, then relaunched. The HEAD worktree had only the same *measurement-only* Welcome-frame mark added, and its registration was removed after measurement. No builds/tests/other Electron instances ran concurrently with A/B. Raw `.tmp/goal34/perf.py` is unchanged.

- **Cold relaunch target:** process-spawn wall time to a buffered renderer mark in the first rAF after Welcome's ready Reading DOM. It uses a previously launched, fully quit profile. **First-ever** uses a new profile with no V8/GPU cache and is reported without a target. The Playwright-observed spawn clock is separately reported; CDP connection and viewport work make it later than the visible-frame mark.
- **Open target:** capture-phase trusted `pointerdown.timeStamp` on the actual tree row (or `keydown` for keyboard actions) to the expected text inside `data-preview-layout-ready="true"`, then **one** rAF. Two rAFs and the old pre-Playwright-click raw clock are retained as diagnostics. The no-op floor clicks the active Welcome tab. The endpoint still means laid-out content, not merely a React flag.

## Final paired A/B (ms; n=12 per side)

| Metric, target clock | HEAD median | Current median | Paired median Δ | Current p90 / max | Target |
| --- | ---: | ---: | ---: | ---: | --- |
| Cold relaunch, visible frame | 1496.8 | **1287.4** | -210.3 | 1292.2 / 1303.8 | ≤1500, pass |
| First-ever, visible frame | 1508.7 | **1284.3** | -224.8 | 1287.6 / 1295.7 | report only; no regression |
| First small, one rAF | 68.0 | **52.5** | -14.4 | 64.4 / 82.1 | ≤60, pass |
| First DNS, one rAF | 333.6 | **211.9** | -123.5 | 232.0 / 245.0 | ≤250, pass |
| Warm small, one rAF | 45.6 | **38.5** | -8.1 | 41.5 / 45.0 | ≤60, pass |
| Warm DNS, one rAF | 72.7 | **67.1** | -3.6 | 72.1 / 79.0 | ≤100, pass |
| Graph shell, painted | 325.6 | **28.5** | -297.2 | 28.7 / 29.0 | ≤100, pass |
| Graph populated + interactive | 640.8 | **206.2** | -435.8 | 211.7 / 215.9 | ≤400, pass |
| Graph reopen, interactive | 257.6 | **96.1** | -162.4 | 97.8 / 99.4 | ≤200, pass |
| No-op event floor, one / two rAF | 4.3 / 11.7 | **4.0 / 11.6** | -0.3 / -0.2 | — | calibrated |

The paired cold-visible p90 is **1292.2ms vs HEAD 1509.8ms**, below both the 1500ms target and HEAD. First-ever-visible p90 is **1287.6ms vs HEAD 1525.4ms**. The Playwright-observer cold relaunch medians are 1994.5→1334.3ms, and first-ever observer medians 1998.1→1337.0ms; those are not the target clock. Event **two-rAF** medians HEAD→current: first small 72.9→55.8, first DNS 347.0→257.4, warm small 51.5→43.2, warm DNS 81.6→71.3ms. Paired **raw two-rAF** medians: first small 93.6→76.3, first DNS 366.0→276.2, warm small 74.0→67.3, warm DNS 106.8→94.4ms. The raw no-op current median is 143.2ms versus an event floor of 4.0ms, directly exposing Playwright actionability/CDP overhead. Full per-sample data and spreads: `.tmp/goal39/paired-ab-final-round3b.json`.

The unchanged standalone raw n=10 harness (`.tmp/goal34/perf.py goal39`, `.tmp/goal34/perf-goal39.json`) versus GOAL-37 (`perf-goal37.json`) gives cold **1990.7→1341.8** (p90 1998.9→1727.4), first small **91.7→84.5**, first DNS **368.1→279.1**, warm small **72.2→65.2**, warm DNS **90.6→82.4**. Its first-small p90 is still 234.6ms and first-DNS p90 437.8ms; these are not hidden. The controlled paired raw series improves on **all four** opens, and the old raw clock includes Playwright actionability. Independent event n=10 (`.tmp/goal39/perf-event-final-round3b.json`) confirms one-rAF medians first small 53.6, first DNS 210.4, warm small 36.5, warm DNS 57.8ms. DNS Reading edit is **122.9→87.2ms** (≤150); Source/Live key p90 is **9.8/7.1ms** (≤16). Palette/finder raw medians are 14.2/17.4ms.

## Startup and note-open waterfalls

Diagnostic process-spawn-relative medians (ms, n=10; `.tmp/goal39/waterfall-before2.json` and `waterfall-final-round3b.json`):

| Stage | Before | Final |
| --- | ---: | ---: |
| Main evaluated / `app.whenReady` | 446.3 / 473.3 | 418.6 / 446.5 |
| All IPC registered | 480.3 | 453.5 |
| BrowserWindow created / `loadFile` | 495.6 / 502.6 | 473.3 / 480.3 |
| Renderer module evaluated / React root commit | 1004.7 / 1044.6 | 751.3 / 1034.8 |
| Vault opened / index + first file ready | 1177.7 / 1232.8 | 1116.9 / 1169.1 |
| First compile / worker done / preview flag | 1260.2 / 1475.2 / 1478.3 | 1196.8 / 1234.8 / 1238.0 |
| Welcome visible frame | not instrumented before | 1301.2 |

These diagnostic runs have a different profile/order from paired A/B; use the paired visible-frame median for the target. The renderer's first App chunk shrank from ~5.73MB to ~5.16MB (`.tmp/goal39/bundle-profile-intact.txt`); the eager main chunk shrank ~966KB→376KB. Eager startup still includes Electron, security protocol, synchronous IPC registration, vault/index and SQLite; AI SDK (~591KB) and export (~282KB) load only inside already-registered handlers. Per-module *evaluation* time was not isolated; the aggregate marks and bundle sizes are the evidence.

Final diagnostic note-open marks (`waterfall-final-round3b.json`, relative to `g39:workbench-open-request`): small read 4.9, commit 5.3, compile cache hit/MDX run 20.8–20.9, preview mount/flag **31.5ms**; DNS read 4.1, commit 4.2, compile/MDX run 16.2–16.9, preview mount/flag **37.4ms**. The external input→frame interval is the paired table, not the flag. The earlier small trace (`.tmp/goal39/trace-small-tracefinal.json`) had flag at 41.5ms; the intermediate trace after tab-strip work (`trace-small-trace-round3.json`) had 43.9ms under tracing overhead. The final cached-label diagnostic's 31.5ms mark is consistent with the faster event result, but these different diagnostic runs are not a matched A/B themselves.

### Chromium trace and source-mapped CPU profile

First DNS trace `.tmp/goal39/trace-open.json` is **329.4ms under tracing overhead**: request 22.1, file read 29.3, commit 29.7, cache-hit compile 47.3, MDX run 48.0, preview flag 95.4, matching DOM observer 250.5, next frame 329.4ms. Chromium reports **207.9ms Layout** across seven passes (largest 144.8), 17.4ms UpdateLayoutTree, 5.2ms PrePaint, 2.5ms Paint and ~7.7ms parallel raster. Inclusive FunctionCall time overlaps layout and is not added. The full note is ~31k characters with ~30 islands; this trace explains the previous 264.2ms first-DNS residual. The final event median is now 211.9ms, so no residual exception is needed.

Small-note trace before the final label cache (`trace-small-trace-round3.json`) has request→read/commit **4.8/5.2ms**, compile cache hit/MDX run **17.3/17.4ms**, preview flag **43.9ms**; its traced one-rAF result is 88.4ms, versus an untraced paired median of 67.6ms at that stage. `Layout` `beginData`/`endData` identifies **`#document` as the sole root**, not an offscreen old preview: before mount, dirty/total objects are 30/719 and 22/656 with 15/1 UpdateLayoutTree elements; after mount, 195/839 with 107 elements takes 10.6ms. Later font arrivals dirty **793/839** and **816/862** objects and cause 4.9/5.9ms further layouts. The earlier trace's first post-mount root pass was 18.8ms and its total Layout was 36.7ms; eliminating duplicate tab-strip geometry reads/state updates reduced that first pass in the intermediate trace. The previous note is **unmounted** by `MainEditor`'s mutually exclusive selected-surface branches, rather than hidden in the DOM. Font loads, tree row work and the single root layout are supported; the trace does not identify finer child layout roots. It does not prove container queries or outline/ResizeObserver work individually dominate.

The throwaway sourcemap build (`MDX_VAULT_PERF=1 bun run build`) plus `.tmp/goal39/profile-small.cpuprofile`, `profile-small-trace.json` and `profile-summary.mjs` measured JS self-time between trusted pointerdown and mount. Samples map to `displayFileName` **5.7ms**, Preact/Pierre tree work (multiple ~1–4ms frames), `getBoundingClientRect` **3.7ms**, React `renderWithHooks` ~2.0ms and `EditorTabs` ~1.0ms in that profiled open. CPU sampling and tracing inflate wall time; these figures are diagnostic, not sums or target measurements. They confirm active selection redraws tree rows and repeatedly resolves their labels. A path-set-scoped lazy label cache removes those repeated scans without precomputing every row at startup; a new path set creates a new cache. The final A/B improves first small 67.6→52.5ms across rounds, with both note orders improving (immediate small 55.0→41.5; small after DNS 77.3→63.9). The remaining order-dependent tail points to tree/React mount and root style/layout as the next lever, not a hidden old preview. `content-visibility: auto` and below-fold island deferral were not shipped: the required ±4px outline landing, active tracking, wikilink/hover jumps, tab scroll restore, Reading/Source/Live find, print and export proof matrix for section virtualization is incomplete. Export uses a separate main pipeline and is unaffected by Reading preview CSS.

### Graph outlier trace and tail

Before this round, two of ten graph opens immediately after Welcome had 329/331ms shell and 484/490ms interactive: input prevented the one-second idle preload from starting. HEAD's representative CDP outlier (`.tmp/goal39/trace-graph-trace-round3.json`) records trusted pointerdown, GraphSurface chunk request **5.4ms** later and response/finish at **27.3/31.0ms**; the shell does not paint until ~320ms, consistent with module evaluation/React work. The graph query/layout then runs to ~497ms; the 961KB Cytoscape chunk requests at ~503ms, finishes at ~524ms, and first canvas render completes near ~640ms. This is not a second IPC registration or duplicate handler.

Graph idle warmup and explicit open now share one retryable module Promise; typing `graph` into the command palette starts the *user-requested* chunk before its option is clicked. Idle work otherwise still yields to input for one second. A lightweight matching header/search/loading shell paints if the module is genuinely pending; it is not counted as populated. The graph always retains a stable lazy component type: a delayed idle warmup cannot remount an already-open graph. Paired n=12 graph medians and p90s are in the table. Separate immediate-after-Welcome n=10 (`.tmp/goal39/graph-event.json`) gives shell **35.9ms median / 50.4 p90 / 50.4 max**, interactive **223.6 / 229.5 / 245.4**, reopen interactive **112.0 / 123.4 / 124.9**. Every sample is within the staged graph limits.

## Levers, guardrails and behavior

Kept: parallel settings/vault bootstrap, persisted-theme BrowserWindow background, lazy AI/export handlers with synchronous registration, worker warmup and reused heading AST, bounded data-only preview prefetch with stale-result rejection, active editor-view registration, tab-strip geometry/state de-duplication, lazy tree-label cache, one-second input-idle graph preload, shared graph import and user-intent graph prefetch. The FileTree cache is scoped to the current paths/display preference; it does not store executable code. The graph fallback has the same shell height/header/search affordance, so there is no empty full-pane stall. No IPC contract, preload API, security flag, CSP, iframe sandbox or dependency changed.

Rejected and reverted after measurement: speculative note-font warmup (helped DNS-first but hurt small/warm), outline-geometry deferral (no first-small benefit), eager Cytoscape preload (hurt DNS), extra prefetch candidates beyond two, and an unproved graph-query cache. Section `content-visibility` and island deferral were rejected for lack of the navigation/print proof above. No spinners or skeletons were added to hide the content-ready endpoint.

Production smoke `.tmp/goal39/smoke.py`, `.tmp/goal39/smoke.json`, `.tmp/screens/goal39/` passes light/dark Welcome, DNS Reading/Live/Source, dock/tabs, Source/Live Ctrl+F, settings, populated graph, registry chart, export dialog, AI panel and sandbox (`allow-scripts`, no same-origin). Dark reload frames 00–07 show dark paper from the first captured frame; a pre-CDP first-ever compositor frame is not captured. Final built-smoke first-use settings/registry/export/AI event samples are light **97.1/116.9/34.5/25.1ms**, dark **109.4/114.3/34.9/28.2ms**, each under 200ms. A separate tab-overflow smoke opens seven notes plus Welcome, checks active first/last tab visibility, and records `.tmp/screens/goal39/tab-overflow.png`. An initial smoke attempt timed out because it invoked Ctrl+P before the graph command palette had closed; the harness now waits for that dialog to close and the rerun passes without changing the app.

The real built export check `python scripts/verify-goal36-export.py` passes, replacing the invalid Bun-direct probe: chart **664×260px**, five static cards, slider and dark print paper correct, sandbox **80px**. Evidence `.tmp/goal39/export-final-evidence.json`, `.tmp/screens/goal39/export-interactive.png`, `export-static.png`. Firefox/WebKit export browsers are unavailable locally; production Electron/Chromium was checked.

Perf budget for the next audit: cold relaunch visible median ≤1500ms and no first-ever regression; event first/warm small ≤60, first DNS ≤250, warm DNS ≤100; DNS edit ≤150; Source/Live key p90 ≤16; graph shell/first interactive/reopen medians ≤100/400/200, with the immediate-use tail reported. Keep the trusted-input→visible-text+one-rAF contract, two-rAF diagnostic, no-op floor, paired raw comparator, and GOAL-35–38 smoke/security/export checks.

## Check gate and security audit

Final source gates: `bun run typecheck` passed; `bun test --parallel=4` passed **524/524** across 123 files (HEAD: 501); `bun run build` passed; `bunx biome check <38 changed TS/TSX files>` passed with zero errors. `bun run lint` exits 1 on pre-existing repository diagnostics: **374 errors versus HEAD 387**, plus 13 generated `.tmp/` size warnings; complete output is `.tmp/goal39/lint-final-round3b.log`. This meets the locked error-count gate, not a clean-lint claim. Focused sandbox/island security tests passed **13/13**. `python scripts/verify-goal36-export.py` and `python .tmp/goal39/smoke.py` passed in the final production build.

Security/diff audit: `package.json`, `bun.lock`, `example-vault/`, preload and `docs/security.md` have no changes. No added `allow-same-origin`, `dangerouslySetInnerHTML`, CSP or Electron security flag line; no disk executable cache or new dependency. `git diff --check` passed. `src/main/index.ts` registers all handlers by line 185, before `createWindow()` at line 189; lazy AI handlers retain synchronous registration and import their implementation only when called. No stale HEAD worktree remains (`git worktree list` shows only the main checkout). No commit was made.
