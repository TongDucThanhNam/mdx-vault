# GOAL-39 — Production latency round 2

**Status: COMPLETE (2026-09-30).** Final controlled production Electron A/B meets every event-based median target without a cold, paired-raw, typing, visual, export or security regression. Individual first-small-after-DNS and graph-reopen tail samples remain documented, not described as universally under budget.

## Outcome

Make local-first Reading startup and note opening feel immediate in production Electron while keeping the end marker tied to visibly laid-out content.

## Dependencies

GOAL-34 and GOAL-37; preserve GOAL-32–38 behavior.

## Constraints

- Single pane. No new dependencies, commit, preload or IPC contract changes, security flag changes, disk cache of executable MDX, or edits to `example-vault/`.
- Unopened notes may be compiled as **data** in bounded memory, but generated code is not evaluated until the note opens.
- Do not trade first-use stalls, typing latency, contrast, export fidelity, navigation or sandbox isolation for a faster startup clock.
- Preserve `.tmp/goal34/perf.py` unchanged. Judge note-open targets from trusted input event to expected visible Reading text plus one rAF; report two rAFs and a no-op floor. Cold relaunch is spawn to Welcome's visible frame with a previously launched, fully quit profile; first-ever empty-profile launch is reported separately. Compare both with HEAD in interleaved pairs.

## Success Criteria

- [x] **P1, waterfall and profile:** main ready/IPC/window, renderer entry/root, vault/index, worker/compile/mount and visible frame are marked and recorded; a sourcemap build and CDP traces identify startup bundle and note-open costs. Eager main module **evaluation** cost was not isolated per module; only aggregate marks, eager-module list and chunk sizes are claimed.
- [x] **P2, startup:** paired cold-relaunch visible median **1287.4ms ≤1500**, p90 **1292.2ms < HEAD 1509.8**; first-ever visible **1284.3ms < HEAD 1508.7**. The Playwright-observer clock is not substituted for the visible frame.
- [x] **P3, note opens:** paired trusted-event one-rAF medians first small **52.5ms ≤60**, first DNS **211.9ms ≤250**, warm small **38.5ms ≤60**, warm DNS **67.1ms ≤100**. DNS Reading edit **87.2ms ≤150**; Source/Live key p90 **9.8/7.1ms ≤16**. Two-rAF and raw series are reported separately; all four paired raw opens improve against HEAD. First-small-after-DNS subset median is **63.9ms** and overall first-small p90 **64.4ms**: a tail limitation, not a failed median target.
- [x] **P3, staged graph:** paired first shell **28.5ms ≤100**, populated interactive **206.2ms ≤400**, reopen interactive **96.1ms ≤200**. Immediate-after-Welcome n=10 max is **50.4/245.4ms** for shell/interactive and **124.9ms** for reopen. Settings/registry/export/AI first use is below 200ms in smoke.
- [x] **P3, render investigation:** first-DNS and first-small Chromium traces, source-mapped CPU samples, layout roots/dirty-object counts, graph outlier trace, supported cuts and rejected virtualization/font/Cytoscape levers are documented. No `content-visibility` or below-fold island deferral was shipped without the required scroll/find/print proof.
- [x] **P4, guard:** bounded, cancelable data-only preview prefetch; tested one-second input-idle gate; path-set-scoped file-label cache; shared graph-module Promise; stale result and trust-boundary checks preserved. New cache/module-loader tests pass.
- [x] **P5, record and regression:** final n=12 paired A/B, unchanged raw n=10, immediate graph n=10, light/dark Electron smoke, real built export, full type/test/build/Biome/lint and security/diff audit are in the verification doc. No dependency, preload, schema, security-flag, CSP, iframe or example-vault change and no commit.

## Verification and limitations

See `docs/verification/goal-39-production-latency-round-2.md` and `.tmp/goal39/paired-ab-final-round3b.json`. The remaining performance opportunity is the order-dependent first-small tail: a source-mapped profile shows repeated tree-row rendering and `getBoundingClientRect` work; the label scans were cached, but the tree selection/layout path can still be isolated further. Chromium's full-document layout and first-use font swaps remain visible in traces. Per-module main evaluation costs and pre-CDP first-ever compositor frames were not captured. These limitations do not alter the final paired median target result.
