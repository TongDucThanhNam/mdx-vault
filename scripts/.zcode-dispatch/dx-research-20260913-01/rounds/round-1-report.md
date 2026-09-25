# Correction round 1 — complete

## What changed per finding

1. **Navigation matrix (high)** — The probe was rewritten to record an explicit shortcut × surface × focus matrix (17 rows, all in `dx-audit-results.json`). Mislabeled evidence fixed: the old "find_panel_source" actually ran in `sample.tsx` (its screenshot did too — stale round-0 screenshots deleted). Now covered live: Ctrl+P from Source/Live/TSX/explorer-tree focus + repeat-guard + arrows/Enter/Escape; Ctrl+F find+Escape in Source, Live, TSX, and its expected absence from explorer focus; Ctrl+Shift+F from Source/Live/TSX/explorer + picker guard; dirty-buffer behavior (indicator, survival through pickers/search/tab switches, save clears); case/regex/path/file/invalid-regex filter behavior. Settings-dialog and Reading focus states are recorded as explicit verification limitations.

2. **React authoring loop (high)** — The probe now drives the real loop: palette → New interactive → dialog (starter selection fixed to click the visible card; a forced radio check silently failed) → transactional create → workbench. Current findings recorded: completion popup works via typing (new gap: `Number` interface ranked above the `number` primitive); diagnostics reached the Problems ledger but produced no editor lint markers within 20 s (reproduced twice — open discrepancy, root cause not chased); safe proof frame verified (`sandbox="allow-scripts"`, `mdx-vault-sandbox://`); undo verified; workbench-TSX latency measured separately. Plain root `sample.tsx` editing is now explicitly distinguished from project-intelligence editing; GOAL-25/27 evidence is no longer treated as current proof.

3. **Caret architecture (medium)** — Corrected in both docs and measured instead of asserted: `drawSelection()` is installed; the probe shows `.cm-cursor-primary` present and native caret transparent. What's missing is caret *gliding* (and smooth scrolling), not a drawing layer — feasibility reassessed upward; blinking/drawing distinguished from gliding.

4. **Zed source research (medium)** — Added upstream implementation citations at identified revisions: `cursor_animation.rs`@`2988a5924121` (125 ms damped-spring glide, 33 ms frame cap), `element.rs`@`002161d5ba8d` (`paint_cursors`, animation off under `reduce_motion`), `editor_settings.rs` + `assets/settings/default.json` (`cursor_animation.enabled: false` default), `scroll.rs`@`0ad5441b5370` (no buffer-scroll smoothing), `input.rs`@`595d62863e8a` (native IME InputHandler). The `reduce_motion` inference was removed/replaced; conclusion now: both references ship gliding/smooth-scrolling as opt-in.

5. **Task context + gates (medium)** — Both docs now cite `scripts/.zcode-dispatch/developer-dx-task.md` as read (round-0 "missing" claim corrected), keep both user-confirmed dimensions (caret gliding + smooth scrolling), and map the recommended sequence to all five "Remaining outcomes" with observable gates, including a concrete native-IME verification design (Windows Telex session + CDP regression baseline) and production-build latency budgets.

6. **Latency overreach (medium)** — Fixture corrected to 1,602/1,603 lines; metric explicitly qualified as a scheduling proxy (not presentation/hardware); the "every median fits a 60 Hz frame" claim removed (large-note median 19.8 ms exceeds 16.7 ms); no resolved-claim; proposed budgets moved into outcome-5 gates.

7. **Profile isolation (medium)** — Launch receipt recorded with the exact command, profile dir, and CDP endpoint; probe now refuses non-fresh profiles and verifies a unique settings marker lands in the declared profile's `app-settings.json` (caught a real incident: one run attached to a stray Electron on the same port — launcher now kills strays and confirms the port is dead first). The "writes only fixture+output" claim corrected.

## Checks run (actual results)

- `bun run typecheck` — exit 0
- `bun run lint` — exit 0 (after Biome-formatting the regenerated evidence JSON)
- `bun test` — exit 0, 472 pass / 0 fail (107 files)
- Final probe run — exit 0, 17/17 matrix rows, zero page errors, marker-verified profile
- Worktree: 234 porcelain entries = 230 pre-existing + 4 new untracked additions only; no temp files, no stray Electron processes

## Remaining problems

Open audit findings (by design, for the next stage): G-07 diagnostics-marker discrepancy; nondeterministic search reveal; whole-vault TSX coverage gap; Settings/Reading focus states and OS-level IME unverified. No product code was changed and no deferred work started.