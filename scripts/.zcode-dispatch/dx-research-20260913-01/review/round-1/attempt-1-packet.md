You are an independent reviewer. You never implement, edit files, or run state-changing commands; you read source and evidence and verify it yourself. Your final message must be exactly one JSON object matching the provided output schema: verdict "accepted", "changes_required", or "needs_replan", with concrete findings and evidence references.
Run: dx-research-20260913-01 · stage 1 · review round 1 · worker ZCode (model GLM-5.3-Flash).
Project root: C:\Users\terasumi\Documents\source_code\mdx-vault
Run directory: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01
## Objective
Research and reproduce developer-facing navigation/search, React-authoring and typing/motion gaps against Zed and VS Code without changing product behavior.
## Acceptance criteria (authoritative)
- Two research/verification reports distinguish measured current behavior, source-backed facts, inference and proposals, cite official Zed repository/docs and VS Code/Microsoft sources, and use only redacted relevant Zed settings.
- Evidence matrix covers Ctrl+P, Ctrl+F, Ctrl+Shift+F across relevant files/focus states and traces whole-vault search coverage including React/TSX files; actual probes or concrete stated tooling limitations are supplied.
- React-authoring loop and typing responsiveness have concrete findings and prioritized acceptance gates; caret/scroll motion is distinct from latency, native IME is not claimed from committed-text injection, and historic benchmarks are not reused as current proof.
- Ranked implementation stages retain all user requirements and identify GOAL-27 constraint decisions. No existing product/config/test/goal files, actual user vaults, editor settings, dependency sets or security boundaries were changed.
- New diagnostic helpers are scoped to isolated profiles/fixtures; evidence records commands and actual outcomes. Typecheck, lint and relevant tests pass, or a independently verified pre-existing baseline failure is clearly distinguished from this docs-only stage.

Preserved contracts:
Preserve all pre-existing tracked/untracked edits; local-first file truth, dirty buffers, undo/IME integrity, explicit execution consent, sandbox/IPC/path validation, GOAL-27 constraints, and English responses. Authorized writes are new audit reports, a scoped verification helper/evidence, and dispatch artifacts only.
## Assignment (verbatim)
File: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\assignment.md (3081 bytes)
# Developer editing DX: evidence stage

Project: C:/Users/terasumi/Documents/source_code/mdx-vault
Overall goal: Make note input and React interactive-component authoring feel credible to developers accustomed to VS Code, Zed and Word's smooth caret motion.
Current stage: Research and reproduce the highest-impact DX gaps; no product implementation yet.

Read AGENTS.md (latest user override: ALWAYS RESPOND IN ENGLISH), goals/README.md, GOAL-27, docs/security.md, and ../developer-dx-task.md. Use the applicable local React/UI/testing skills. Preserve the entire dirty worktree, including earlier improvements. Source locations: src/shared/{workspace-actions,keybindings,interactive-language}.ts; renderer explorer/QuickSwitcher, search/SearchPane, hooks/useKeyboardShortcuts, editor/, interactive/ and workbench/. Prior metrics are historical, not current proof.

Produce docs/research/developer-dx-audit-2026-09-13.md and docs/verification/developer-dx-audit-2026-09-13.md. A narrowly scoped new verification script and generated evidence are allowed. Do not edit existing app/config/tests/goals or user data.

Work:
- Inspect relevant Zed settings read-only; exclude credentials/provider configuration from output. Research official Zed docs AND upstream keymap/input/rendering source, VS Code docs/source, and credible Microsoft animation guidance. Cite exact supporting URLs, inspected revisions where practical, and local file:line evidence. Separate observed behavior, inference, unverified claims and proposals.
- Audit Ctrl+P quick open, Ctrl+F current-file find, Ctrl+Shift+F whole-vault content search across note Source/Live, TSX and focus states. Trace content coverage, case/regex/path filters, results navigation, Escape/focus return and dirty buffers. A registered shortcut is not a passed workflow.
- Audit the React creation -> editing -> completion/imports/signature/definition/diagnostics -> safe preview loop and essentials such as undo grouping, multi-cursor, brackets/JSX, format availability and navigation.
- Reproduce key gaps in isolated Electron profiles/fixtures where available; measure current note AND TSX input without concurrent heavy checks. Include Vietnamese IME/composition and large-file test design; committed insert_text is not native IME proof. Evaluate interruptible caret/scroll animation, reduced motion and input latency separately.
- Rank gaps and recommend coherent implementation stages with observable acceptance gates. Compare retaining CodeMirror with alternatives honestly; flag GOAL-27 conflicts instead of implementing around constraints.

Checks: run typecheck, lint and relevant existing tests; save commands/exit codes and reproducible probe evidence. Missing capabilities are audit findings, not an excuse to stop research or fabricate passes. Do not weaken security, install dependencies, modify global/OS/editor settings, commit, delegate again or invoke a reviewer.

Return boundary: finish this research/evidence stage and return a concise report for independent Astra review. Do not begin deferred product changes.

## Changed source this stage
Source identity verified (paths). Fingerprint after worker: 2ac32895af2a51f5cefac9ac2d3f416868a8e47a69a0d8c95614a31ca334db74.
Changed/added paths:
- docs/research/developer-dx-audit-2026-09-13.md
- docs/research/evidence/developer-dx-audit-2026-09-13/dx-audit-results.json
- docs/research/evidence/developer-dx-audit-2026-09-13/ime-composition.png
- docs/research/evidence/developer-dx-audit-2026-09-13/interactive-completion.png
- docs/research/evidence/developer-dx-audit-2026-09-13/interactive-create-dialog.png
- docs/research/evidence/developer-dx-audit-2026-09-13/interactive-diagnostics.png
- docs/research/evidence/developer-dx-audit-2026-09-13/interactive-proof-ready.png
- docs/research/evidence/developer-dx-audit-2026-09-13/interactive-workbench.png
- docs/research/evidence/developer-dx-audit-2026-09-13/motion-facts.png
- docs/research/evidence/developer-dx-audit-2026-09-13/project-search-deep-reveal.png
- docs/research/evidence/developer-dx-audit-2026-09-13/quickopen.png
- docs/verification/developer-dx-audit-2026-09-13.md
- scripts/verify-dev-dx-audit.py
Removed paths:
- None
Full changed-path evidence: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\review\round-1\changed-paths.json (1305 bytes)
Baseline file contents (including pre-existing changes): C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\source-baseline. Compare changed files against these originals.
Diff/stat evidence (may be partial for untracked files): C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\review\round-1\changed-paths.txt (1171 bytes). Read source files directly for full context.
## Worker report (claims only — verify independently; exit code 0, worker status ready_for_review)
Full report: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\rounds\round-1-report.md (4583 bytes)
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
- `bun test` — exit 0, 
Worker report inline excerpt: showing the first 4000 of 4541 characters; the complete content is on disk at the path above.
## Test / deterministic evidence paths (read selectively)
Independent dispatcher verification receipt: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\review\round-1\verification.json. The dispatcher, not the worker, ran these caller-assigned commands against the fingerprinted source. Inspect their outputs and test coverage; this is independent execution evidence. Do not rerun identical checks in the read-only sandbox unless a gap or contradiction warrants it.
- docs/verification/developer-dx-audit-2026-09-13.md (11263 bytes)
## Previous unresolved findings (from the last review round)
The worker was corrected for these. Re-verify each one; do not accept while any still reproduces.
- 1. scripts/verify-dev-dx-audit.py: The navigation matrix overstates coverage. find_panel_source actually runs in sample.tsx, Ctrl+P is never exercised from Live, and Ctrl+Shift+F is only exercised from Source. Dirty-buffer behavior, non-editor focus states, and case/regex/path behavior lack probes or concrete tooling limitations.
- 2. docs/research/developer-dx-audit-2026-09-13.md: The React-authoring audit lists registered capabilities but never exercises creation, completion/imports, signature help, definition, diagnostics, or safe preview. Its root sample.tsx fixture bypasses the interactive project workbench and receives no language intelligence, so its typing measurements do not characterize the React authoring loop.
- 3. docs/research/developer-dx-audit-2026-09-13.md: The caret feasibility analysis incorrectly says this app uses the browser's native caret and needs a new drawn overlay. The app already installs drawSelection(), which replaces the native cursor with overlaid elements. The probe writes the incorrect architecture claim as a constant rather than measuring it.
- 4. docs/research/developer-dx-audit-2026-09-13.md: Required Zed input/rendering source research is absent. The report instead infers optional editor smoothing from reduce_motion, which does not establish that capability.
- 5. docs/research/developer-dx-audit-2026-09-13.md: The required task context is incorrectly reported missing: it exists at scripts/.zcode-dispatch/developer-dx-task.md. The implementation sequence also drops explicit acceptance gates for React authoring, typing responsiveness, and integrated dev/production and native-IME verification.
- 6. docs/research/developer-dx-audit-2026-09-13.md: The latency conclusion exceeds the measurement: next-rAF timing does not prove text presentation or rule out median input cost. The claim that every median fits a 60 Hz frame also conflicts with the reported 17.9 ms median. The fixture described as 800 lines is generated with roughly 1,600 lines.
- 7. scripts/verify-dev-dx-audit.py: Profile isolation is asserted but not demonstrated by saved evidence. The helper attaches to any supplied CDP endpoint and persistently changes app settings before verifying profile identity. The ledger records only a placeholder launch command, and the results omit the actual profile.
Full previous verdict and all unresolved findings: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\review\round-0\verdict.json. Read it to verify every finding; the inline summary may be bounded.

## Rules
- Judge only this stage against its acceptance criteria; deferred work is not a stage failure.
- Independently read the relevant source and verify the needed evidence; do not trust the worker report.
- A worker exit code of zero is not acceptance. Malformed or missing evidence is a finding, not a pass.
- Cover each acceptance criterion in checks with concrete evidence. Accepted requires no unresolved findings and all required checks verified as pass. Use changes_required with actionable findings for defects or missing checks; do not implement the corrections yourself.
- Use needs_replan only when the stage cannot be corrected by bounded feedback (architectural ambiguity or repeated failure that needs a new decision), not for ordinary defects.
- Record evidence paths in findings so corrections can reference them. Review transcript/events: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\review\round-1.