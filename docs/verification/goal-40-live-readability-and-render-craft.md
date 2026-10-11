# GOAL-40 — Live readability and render craft verification

**Status: BLOCKED — repository lint is above the required 375-error ceiling.** Implementation and the checks listed as PASS below are preserved; this is not an acceptance-pass report. No commit was made.

## Scope and implementation

- **T1:** removed Live base-plane, gutter, caret, selection, scrollbar, math/Mermaid and `tok-*` overrides. Shared syntax/active-line constants come from `editor-theme.ts`; its values and Source rules are unchanged. Live owns only decoration styling. Syntax-only marks add CSS classes, not replacements or atomic ranges. Bold is 600/foreground; code uses a 6% foreground chip; links share blue/1px underline styling, unresolved links are muted/dashed. Quotes have a 2px rule and no slab; callouts have 3–4% type tints. Nested highlighter spans inherit decoration colors. A transparent active-line image layers over callout tints.
- **T1 geometry:** undo the existing heading font scale only in the `ch` wrap calculation. Heading sizes, fonts and leading are unchanged; all lines retain Source's 12px padding. Default bounded lines, including H1–H6, end at x=1130; the ruler is at x=1118 (the inner wrap edge, 12px before the padded outer edge). DNS screenshots cover widths 1920 and 1366.
- **T2:** author-prose selectors use zero-specificity `:where(:not(...))` guards for `[data-registry-island]` roots/descendants and the existing owned `in-*` kit namespace. Five base registry roots and registry validation/runtime-error message roots gain the boundary attribute; no wrappers, providers or rendering lifecycle changes are introduced. Native branches of mixed dark-paper rules are guarded separately from component-owned branches. PrimerTerm's existing underline is explicitly component-owned, retaining the DNS raster.
- **T3:** common note CSS makes closed details padding `0 1.1rem`, with a flex-centered 44px summary and disclosure direction cue. Open state adds bottom padding and summary/body separation. Main/export-service code is unchanged.
- **T4:** DESIGN's Live contract, GOAL-40 and its README dependency row (38,39) are updated.

## Baseline and precedence

Source `editorTheme` is registered before the normal-precedence Live extension in MdxEditor. CodeMirror gives the earlier theme higher precedence for equal-specificity declarations. Production computed styles and pixels confirm that **Source already won** the base card/foreground, scroller typography, padding, active line, gutters, selection, caret and scrollbar in both themes. The old Live values did not all win merely because the Live extension was later. Live-specific strong/quote/chip/underline styling and nested highlight spans caused the observed defects.

Baseline build is preserved under `.tmp/goal40/baseline/out/`. Before contrast runs execute that saved production Electron main entry against the same disposable fixture, not a source mock. Discovery evidence is `.zcode-dispatch/run-1790723563634-08577f2d/worker-report.md`, `.tmp/ux4/surface-evidence.json` and `.tmp/ux4/finish-evidence.json`.

## Contrast — before → after

Minimum over the captured hidden/revealed/caret states, not just token literals. The browser resolves `color-mix` through a canvas, composites ancestor backgrounds and the active-line image, and records text-node range geometry. The PNG probe samples the most frequent background and the ink pixel nearest the resolved foreground within that text range. Raw resolved/sample RGB values, filenames and minima are in `.tmp/goal40/contrast-raw.json` and `analysis.json`. “Syntax” before values are matched to the same text in the corresponding baseline state, since that CSS class did not exist before. Selection/find screenshots are additionally retained rather than substituted for unselected text.

| Live text class | Light before → after | Dark before → after |
| --- | ---: | ---: |
| bullet | 4.73 → 6.77 | 3.18 → 8.32 |
| callout-marker-danger | 6.18 → 5.85 | 1.62 → 6.55 |
| callout-marker-info | 6.18 → 6.43 | 1.62 → 7.74 |
| callout-marker-note | 6.18 → 15.93 | 1.62 → 12.92 |
| callout-marker-tip | 6.18 → 6.65 | 1.62 → 7.55 |
| callout-marker-warning | 6.18 → 6.93 | 1.62 → 8.43 |
| cm-live-preview-heading-1 | 7.37 → 16.90 | 8.50 → 14.06 |
| cm-live-preview-heading-2 | 7.37 → 16.90 | 8.50 → 14.06 |
| cm-live-preview-heading-3 | 7.37 → 16.90 | 8.50 → 14.06 |
| cm-live-preview-heading-4 | 7.76 → 17.79 | 9.01 → 14.91 |
| cm-live-preview-heading-5 | 7.76 → 17.79 | 9.01 → 14.91 |
| cm-live-preview-heading-6 | 7.76 → 17.79 | 9.01 → 14.91 |
| emphasis | 16.90 → 16.90 | 14.06 → 14.06 |
| inline-code | 16.37 → 14.99 | 16.37 → 11.99 |
| link | 7.04 → 7.04 | 8.03 → 8.03 |
| math-delimiter | 6.81 → 6.81 | 7.70 → 7.70 |
| math-text | 16.34 → 16.34 | 13.49 → 13.49 |
| mermaid-fence | 7.03 → 7.03 | 7.90 → 7.90 |
| mermaid-text | 6.98 → 6.98 | 8.36 → 8.36 |
| plain-active-text | 16.90 → 16.90 | 14.06 → 14.06 |
| plain-text | 17.79 → 17.79 | 14.91 → 14.91 |
| prose | 4.63 → 4.63 | 5.29 → 5.49 |
| quote-callout-text | 15.43 → 15.84 | 1.02 → 12.92 |
| quote-mark | 6.73 → 6.35 | 1.62 → 7.64 |
| source-code-jsx-token | 6.77 → 6.77 | 8.03 → 8.03 |
| strikethrough | 16.90 → 16.90 | 14.06 → 14.06 |
| strong | 17.94 → 16.90 | 1.12 → 14.06 |
| syntax | 4.63 → 4.63 | 1.65 → 5.49 |
| wikilink | 7.04 → 7.04 | 8.03 → 8.03 |
| wikilink-unresolved | 7.04 → 6.77 | 8.03 → 8.32 |

All measured post-fix text classes clear 4.5:1. Lowest resolved contrast is **4.63 light / 5.49 dark** on a revealed, matching-bracket-highlighted delimiter; the corresponding PNG ink/background samples are **4.63 / 5.47**. Ordinary muted syntax is stronger; the matching-bracket fill is included, not ignored. Dark bold improves **1.12 → 14.06**, quote/callout prose **1.02 → 12.92** (minimum includes the active-line overlay). Inline-code contrast remains high while removing the foreign light slab.

Quote rules: **3.12:1 light / 4.31:1 dark** minimum across the caret states, including the active-callout overlay (inactive minima 3.28 / 4.59). Bullets and quote marks are AA and the visible `>` remains a text cue during selection. Reduced-strength link underlines use AA blue link text as the accompanying text cue; unresolved links also have a dashed form. Typed callout markers explicitly label their type, so faint fills are not the sole cue. Source's optional quiet ruler remains unchanged; its wrap-column setting and actual wrapping supply the editing cue.

## Pixel diffs

Comparison crop: x=250..1618, y=116..1048 at 1920×1080, **1,274,976 pixels**. This includes the editor/note plane and excludes changing vault-tree selection, tab/status chrome and scrollbar paint. It is not a whole-window identity claim.

| Comparison | Light changed pixels | Dark changed pixels |
| --- | ---: | ---: |
| Source DNS before/after | 0 | 0 |
| Reading DNS before/after | 0 | 0 |
| Registry Reading outside chart | 0 | 0 |
| Registry chart capture outside chart | 0 | 0 |
| Identical plain Source vs Live, with selection | 0 | 0 |

Registry top capture changes exactly **30 pixels** in both themes: the leaked legend dash. The separate dark chart capture has four additional chart-edge raster pixels; outside the chart it is identical. `analysis.json` retains the exact counts and bboxes. No author-prose raster difference was found in these DNS/registry crops.

## Registry, hover and export sweep

The production renderer is exercised with the five base registry islands and the complete note kit (including FlowSequence and Counter). Browser stylesheet matching finds no native heading/paragraph/list/table rules on trusted roots or their descendants in either Reading paper or either generated export. Component-owned note-control rules and the universal paper shape/focus contracts deliberately remain shared; they are not author-prose leaks.

Static policy summaries (dataset tables, quiz prose and native disclosure) intentionally remain semantic paper HTML, not mounted widget internals. Their existing native-paper styling is preserved; the container exclusion applies to registry React roots and the owned note-kit namespace. This distinction is also why the static quiz disclosure receives the common D5 details treatment.

Hover preview is intentionally a safe static AST summary, **not a registry React mount**. Registry/kit hover captures show component labels, zero `[data-registry-island]` / `in-*` nodes, no chart/interactive execution. This existing behavior is preserved. In addition to the real-island sweep, synthetic native/base/kit containers with nested headings, paragraphs, lists and tables are matched by the actual browser selector engine:
- light: 38 tested selectors, 28 author-prose matches, **0 island matches**.
- dark: 38 tested selectors, 28 author-prose matches, **0 island matches**.

Exports are generated through `window.exportApi.run` in the **real built Electron application**, then opened as offline file:// pages in headless Chromium. Both modes remain light; hydrated chart legends have no extra pseudo marker; no page errors occurred. Static sandbox fallback warnings remain explicit (the copied React counter has no local image fallback); sandbox capabilities are unchanged.

### Disclosure measurements

| Surface | Closed details / summary | Top / bottom inset | Text center offset | Open details |
| --- | ---: | ---: | ---: | ---: |
| light-follow-theme-disclosure | 47.20 / 44.00px | 1.60 / 1.60px | 0.64px | 119.20px |
| dark-follow-theme-disclosure | 47.20 / 44.00px | 1.60 / 1.60px | 0.64px | 119.20px |
| dark-light-disclosure | 47.20 / 44.00px | 1.60 / 1.60px | 0.64px | 119.20px |
| static-disclosure | 48.00 / 44.00px | 2.00 / 2.00px | 0.84px | 118.38px |
| interactive-disclosure | 48.00 / 44.00px | 2.00 / 2.00px | 0.84px | 118.38px |

The static QuizBlock “Reveal answer” has additional closed/open screenshots and a measured closed height of **48px / 44px summary / 2px top and bottom insets**, retained in `quiz-closed-evidence.json`. The discovery baseline was 75.19px around a 44px summary. Reading's fractional 47.2px height comes from border rasterization in Electron, not asymmetric padding. The custom triangle changes direction on open; summary remains a native clickable/keyboard disclosure.

## Performance and editing regression

Unmodified harness: `python .tmp/goal34/perf.py goal40`, n=10 production launches. Results: `.tmp/goal34/perf-goal40.json`; log `.tmp/goal40/perf.log`. Live DNS keystroke frame **p90 7.0ms ≤16** (discovery 7.1); Source **8.8ms** (discovery 10.0). Raw medians/p90s are reported without substituting a different clock:

| Raw metric | Median / p90 ms |
| --- | ---: |
| cold | 1321.6 / 1703.6 |
| first_small | 141.1 / 242.4 |
| first_dns | 290.1 / 446.4 |
| warm_small | 67.2 / 69.8 |
| warm_dns | 84.2 / 90.6 |
| edit_small | 18.8 / 19.8 |
| edit_dns | 99.3 / 104.8 |
| key_source | 7.6 / 8.8 |
| key_live | 6.7 / 7.0 |

The raw first-small median is slower than the discovery packet (141.1 vs 79.3ms); this is retained, not hidden or called a pass against GOAL-39's trusted-event targets. No style change is used to reinterpret a latency target.

The unchanged companion `python .tmp/goal39/perf-event.py goal40` completes n=10. Trusted-input-to-visible-content-plus-one-rAF medians / p90: first small **54.2 / 69.0ms**, first DNS **215.8 / 243.6ms**, warm small **36.8 / 38.5ms**, warm DNS **57.8 / 59.0ms**. All four median budgets (60/250/60/100ms) still pass. Companion cold median/p90 is **1320.4 / 1340.1ms**; no-op one-rAF **4.2 / 5.0ms**. Two-rAF medians are 61.6/261.5/42.8/61.0ms; companion raw-two medians 80.3/279.1/65.2/83.4ms. Complete samples and action-delay series remain in `.tmp/goal39/perf-event-goal40.json`; log `.tmp/goal40/perf-event.log`. This is a fresh target check, not a new interleaved HEAD A/B or graph benchmark.

Both themes pass **18 cursor/selection round trips** and a fast typing-burst undo restoring the exact original document. Atomic ranges/replacement logic, history extensions and scroll persistence code are unchanged. Exhaustive IME and long-session history behavior are not newly tested.

## Required checks

| Command | Result | Evidence |
| --- | --- | --- |
| `bun run typecheck` | PASS tools/node/web; also rerun by final build | `typecheck-final.log`, `build-final.log` |
| `bun test --parallel=4` | PASS **528**, 0 fail, 124 files, 4029 expectations (HEAD 524) | `tests-final.log` |
| `bun test tests/goal40-live-render-craft.test.ts tests/goal38-paper-contrast-export.test.ts tests/note-editorial-theme.test.ts` | PASS 12, 0 fail | focused console result; full final test log |
| `bun test tests/sandbox-messages.test.ts tests/sandbox-height.test.ts tests/interactive-proof-security.test.ts tests/goal19-export-hardening.test.ts` | PASS unchanged **11**, 0 fail, 4 files; also included in final full run | `security-final.log` |
| `bun run build` | PASS production main/preload/renderer | `build-final.log` |
| `bunx biome check <changed src/tests files>` | PASS **0 errors**, one existing specificity warning | `biome-final.log` |
| `bun run lint` | **FAIL: 6674 errors**, 12920 warnings, 138 infos, exit 1; violates ≤375 gate | `lint-final.log` |
| `python .tmp/goal40/probe.py final` | PASS screenshot matrix and computed styles | `final-probe-3.log`, `final-evidence.json` |
| `python .tmp/goal40/contrast.py` | PASS saved-baseline + final production captures | `contrast-final.log`, `contrast-raw.json` |
| `python .tmp/goal40/analyze.py` | PASS measured tables and diffs | `analysis-final.log`, `analysis.json` |
| `python .tmp/goal40/export-probe.py` | PASS built exports, disclosures, registry sweep | `export-final.log`, `out/export-evidence.json` |
| `python .tmp/goal40/focused.py` | PASS cursor/undo, safe hover and actual browser selector assertions | `focused.log`, `focused-evidence.json` |
| `python .tmp/goal40/validation.py` | PASS real invalid-Counter warning boundary; no leaked list pseudo marker, both themes | `validation.log`, `out/validation-evidence.json` |
| `python .tmp/goal39/perf-event.py goal40` | PASS four trusted-event median budgets, n=10 | `perf-event.log`, `.tmp/goal39/perf-event-goal40.json` |
| `git diff --check` | PASS | final console result |

All relative log/evidence names above are under `.tmp/goal40/` unless qualified. Build warnings about gray-matter eval and repeated template code are retained in build logs; no security settings are changed to address them.

## Screenshot manifest

`.tmp/screens/goal40/` contains light/dark 1920×1080 hidden fixture, per-construct revealed syntax, selection, find, Source/Live plain-plane comparisons, DNS at 1920 and 1366, registry chart, hover, and closed/open Reading/static/interactive disclosures. Main final fixture families are `final-{light,dark}-*`, contrast families `after-{light,dark}-*`, and `{light,dark}-baseplane-{source,live}`. `before-*` captures preserve original defects. Every screenshot remains on disk; `screens-manifest.txt` lists exact names.

## Self-review fixes and constraints

1. Fixed nested highlight spans defeating muted quote/type-marker styling.
2. Added a transparent active-line image after noticing callout background color would otherwise replace the active-line tint.
3. Increased the thin quote rule's token mix to exceed 3:1 in both themes.
4. Moved PrimerTerm's old underline into its own style contract after a DNS pixel diff exposed the lost underline.
5. Split mixed dark-paper native/component rules so table/code/mark treatments cannot bypass the prose guard.
6. Corrected probe assumptions about export response shape and serialized probes sharing one debug port; failed probe logs remain. Final runs passed sequentially.
7. Updated the old test that explicitly required red/light-only Live colors; replacement assertions enforce the new no-literal/no-base-override contract, not fewer tests.
8. Marked registry validation and runtime-error message roots as boundaries so their internal warning lists/paragraphs cannot inherit author-prose styles. The selector-contract test now splits top-level selector groups, checking native branches independently of component-owned branches.

`package.json`, `bun.lock`, `example-vault/`, main, preload, IPC/shared contracts and security/CSP/sandbox files are unchanged. No added `allow-same-origin` or `dangerouslySetInnerHTML`; no dependencies or commit.

## Blocking obstacle and smallest resolution

The discovery packet reports 375 lint errors. That baseline does not reproduce in this workspace. The three **unchanged older** `.tmp/{goal34/vault,goal39/event-vault,ux4/vault}/exports/Welcome.interactive.html` files each contribute **2037 errors**, already **6111** before other diagnostics. `.tmp` by itself reports 6300+ errors; changed source/tests report zero. `.tmp/goal40/lint-diagnostics.json` retains the diagnostic-path counts from an intermediate audit. Own disposable/build/export outputs are organized under an ordinary ignored `out/` directory, without changing ignore configuration; old audit artifacts are not deleted, rewritten or excluded.

**Needed:** reconcile/approve the actual pre-existing artifact baseline or authorize cleanup/normalization of those old disposable generated exports, then rerun repository lint against the agreed ≤375 gate. The implementation cannot be declared accepted while that explicit gate fails. Other remaining limitations: screenshot diffs cover the documented viewport/crops, not every note/scroll position; exports are newly checked in Chromium, not a new Firefox/WebKit sweep; hover intentionally hides executable islands.
