You are an independent reviewer. You never implement, edit files, or run state-changing commands; you read source and evidence and verify it yourself. Your final message must be exactly one JSON object matching the provided output schema: verdict "accepted", "changes_required", or "needs_replan", with concrete findings and evidence references.
Run: dx-research-20260913-01 · stage 1 · review round 0 · worker ZCode (model GLM-5.3-Flash).
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
Source identity verified (paths). Fingerprint after worker: 8307081cc2780bca79c48adb30bcb9f2fc68d2b829346b199ff0652d7dc276fb.
Changed/added paths:
- docs/research/developer-dx-audit-2026-09-13.md
- docs/research/evidence/developer-dx-audit-2026-09-13/dx-audit-results.json
- docs/research/evidence/developer-dx-audit-2026-09-13/find-panel-source.png
- docs/research/evidence/developer-dx-audit-2026-09-13/ime-composition.png
- docs/research/evidence/developer-dx-audit-2026-09-13/project-search-deep-reveal.png
- docs/research/evidence/developer-dx-audit-2026-09-13/project-search-hit.png
- docs/research/evidence/developer-dx-audit-2026-09-13/project-search-opened.png
- docs/research/evidence/developer-dx-audit-2026-09-13/project-search-tsx-miss.png
- docs/research/evidence/developer-dx-audit-2026-09-13/quickopen-opened-large.png
- docs/research/evidence/developer-dx-audit-2026-09-13/quickopen.png
- docs/verification/developer-dx-audit-2026-09-13.md
- scripts/verify-dev-dx-audit.py
Removed paths:
- None
Full changed-path evidence: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\review\round-0\changed-paths.json (1215 bytes)
Baseline file contents (including pre-existing changes): C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\source-baseline. Compare changed files against these originals.
Diff/stat evidence (may be partial for untracked files): C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\review\round-0\changed-paths.txt (1086 bytes). Read source files directly for full context.
## Worker report (claims only — verify independently; exit code 0, worker status ready_for_review)
Full report: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\rounds\round-0-report.md (3456 bytes)
Research/evidence stage complete. Report for review:

## Developer editing DX audit — dispatch `dx-research-20260913-01`

**Deliverables.** `docs/research/developer-dx-audit-2026-09-13.md` (full audit: findings, upstream research, ranked gaps, staged recommendations), `docs/verification/developer-dx-audit-2026-09-13.md` (verification ledger), plus a new probe script `scripts/verify-dev-dx-audit.py` and generated evidence (raw JSON + 8 screenshots) under `docs/research/evidence/developer-dx-audit-2026-09-13/`. Note: the dispatch's `../developer-dx-task.md` input does not exist on disk anywhere findable; I worked from the dispatch text and recorded the absence rather than guessing its content.

**Method.** Source audit with file:line evidence, live Electron reproduction (isolated user-data dir + disposable vault, Playwright over CDP), upstream research into Zed docs + default-windows.json@main + settings reference, VS Code docs + `editorOptions.ts`@main, Microsoft WinUI timing/easing guidance (rev `446db84b`), and read-only inspection of local Zed settings (provider config deliberately excluded from output).

**Top gaps (ranked).**
1. **G-01 (P0):** Ctrl+Shift+F only indexes `.md`/`.mdx` — a token in a `.tsx` file provably returns "No matches." Code files are invisible to the single most-used cross-file workflow.
2. **G-02 (P0):** Search results are not keyboard-navigable (ArrowDown stays in the input), Enter opens only the first result, and reveal is section-heading-anchored (measured: caret line 1 for a line-3 match; 799 for 801) with no match selection/highlight. No `F4` equivalent, no match counts, no replace.
3. **G-03 (P1, the dispatch's core "feel" objective):** no caret/scroll motion exists at all (`scroll-behavior: auto`, instant reveals), while both VS Code and Zed ship optional smoothing and Microsoft's guidance gives concrete ramps (83/167/250 ms, fast-out/slow-in).
4. **G-04/05 (P2):** quick-switcher lacks match highlighting and `:line`/`@symbol` jumps; find panel lacks match count. 5. **G-06/07 (conflict-flagged):** replace-in-files and a formatter each contradict current GOAL-27 constraints (no multi-file write IPC / formatter out of scope) — flagged for goal amendment, not worked around.

**What passed (observed live, not from registration).** Ctrl+P opens from Source/Live/TSX focus with arrows/Enter/Escape and correct focus return; the modal Ctrl+P guard behaves; Ctrl+F's CodeMirror panel is rich (case/regex/whole-word/replace) across all three surfaces; Ctrl+D multi-cursor and single-step undo grouping verified; CDP-driven Vietnamese composition commits exactly once. Latency (dev build): p50 ~15–18 ms on all surfaces; large-note tail p95 67.9 ms with a 124 ms long task.

**Gates.** `bun run typecheck` 0, `bun run lint` 0, `bun test` 472/472 pass. Dirty worktree preserved (234 porcelain entries = 230 pre-existing + my 4 untracked additions); nothing committed, no dependency installed, no reviewer invoked, no product code changed.

**Honest limits.** Latency is dev-build only; OS-level IME remains unverified (CDP composition ≠ OS IME; `compositionend` wasn't captured on the probed node); three probe-side harness bugs were fixed before the recorded run and are documented. Recommendation in the doc: retain CodeMirror — all P0/P1 gaps are implementable within it; smooth caret is the one genuinely hard piece (native-caret limitation). No deferred product work was started.
## Test / deterministic evidence paths (read selectively)
Independent dispatcher verification receipt: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\review\round-0\verification.json. The dispatcher, not the worker, ran these caller-assigned commands against the fingerprinted source. Inspect their outputs and test coverage; this is independent execution evidence. Do not rerun identical checks in the read-only sandbox unless a gap or contradiction warrants it.
- docs/verification/developer-dx-audit-2026-09-13.md (6504 bytes)
## Rules
- Judge only this stage against its acceptance criteria; deferred work is not a stage failure.
- Independently read the relevant source and verify the needed evidence; do not trust the worker report.
- A worker exit code of zero is not acceptance. Malformed or missing evidence is a finding, not a pass.
- Cover each acceptance criterion in checks with concrete evidence. Accepted requires no unresolved findings and all required checks verified as pass. Use changes_required with actionable findings for defects or missing checks; do not implement the corrections yourself.
- Use needs_replan only when the stage cannot be corrected by bounded feedback (architectural ambiguity or repeated failure that needs a new decision), not for ordinary defects.
- Record evidence paths in findings so corrections can reference them. Review transcript/events: C:\Users\terasumi\Documents\source_code\mdx-vault\scripts\.zcode-dispatch\dx-research-20260913-01\review\round-0.