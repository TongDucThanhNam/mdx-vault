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