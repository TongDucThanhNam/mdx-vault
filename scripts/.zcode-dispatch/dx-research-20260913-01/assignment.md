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
