# Developer-first editing DX — task context

Originating Codex task: 01a067c1-aba2-7b73-baa3-03786dfe6695
User request date: 2026-09-13. Always respond in English (latest user instructions).
Delegation: explicitly invoked delegate-to-zcode; ZCode performs stage work and
an independent Astra reviewer checks it. Main handles strategy, not implementation.

## Full desired outcome

mdx-vault must feel credible to developers who normally use VS Code or Zed:
keyboard-first file navigation and search, responsive note/code input, and a
coherent create/edit/debug-in-preview loop for React interactive components.
The user rejected the previous typography/performance pass as insufficient.
They specifically name Ctrl+P (file picker), Ctrl+F (find in current file),
Ctrl+Shift+F (whole-vault content search), and Word-like smooth typing animation.
Research should uncover additional developer essentials, not stop at three keys.

## Current stage and boundaries

Stage 1 is an evidence-backed research/audit, NOT authorization to replatform or
silently ship new behavior. Deliver findings and an actionable implementation
sequence. Read GOAL-27 as the existing single-goal context; flag recommendations
that conflict with its constraints for a main-task decision, never bypass them.
Do not start GOAL-31 or another numbered goal. No goal-completion claims based
on this stage alone. Product-code changes remain deferred until main strategy
review and any necessary user decision about expanded scope.

Preserve all existing dirty and untracked files. They include the earlier UI,
editor/worker improvements and several independent goals. No commits, staging,
resets, global/editor/OS settings edits, real-vault writes, dependency installs,
permission changes or new delegated agents. Use temporary profiles/vaults for
mutating UI probes. Report native IME limitations honestly.

## Main's verified starting evidence (not a substitute for your audit)

- Zed settings path: C:/Users/terasumi/AppData/Roaming/Zed/settings.json.
  A read-only allowlisted extraction found ui_font_size=16, buffer_font_size=15,
  theme.mode=system, light=One Light, dark=One Dark. No explicit buffer font,
  line-height, caret animation or search overrides were present among the
  queried relevant keys. Do not output unrelated provider/account configuration.
- src/shared/workspace-actions.ts declares Mod+P for file.open and Mod+Shift+F
  for note.search. Project search describes searching indexed note content.
- src/renderer/src/search/SearchPane.tsx calls indexApi.search(query, 50) after
  180ms, so trace the backend before calling this whole-vault code search.
- src/renderer/src/editor/source-editor-setup.ts installs CodeMirror's default
  searchKeymap, but Ctrl+F is not independently confirmed across focus/modes.
- Prior evidence is in docs/research/editor-readability-and-typing-2026-09.md.
  Its 5,603-line dev fixture median 100.6 -> 20.3ms is historical, not proof of
  current React TSX/IME/production responsiveness or equality with Zed.
- The latest goal constraints prohibit Monaco/Volar/generic LSP, split editors,
  multi-file mutations, formatter/inlay-hint expansion and source execution in
  analysis workers. Research can compare architectures; implementation cannot
  ignore these constraints merely because an alternative looks promising.

## Reference starting points

- https://zed.dev and https://github.com/zed-industries/zed
- https://zed.dev/docs/key-bindings and https://zed.dev/docs/reference/all-settings
- https://code.visualstudio.com/docs/reference/default-keybindings
- https://code.visualstudio.com/docs/editing/codebasics
- https://code.visualstudio.com/docs/languages/typescript
- https://microsoft.github.io/monaco-editor/typedoc/variables/editor_editor_api.editor.EditorOptions.html
- https://support.microsoft.com/en-us/office/turn-off-office-animations-9ee5c4d2-d144-4fd2-b670-22cef9fa025a
- https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

Verify URLs/source content before relying on them. Use upstream Zed keymap,
editor/input/rendering source in addition to marketing pages. Distinguish
interruptible caret/scroll animation from document input latency: never delay
text mutation to make motion look smooth. Respect reduced motion and IME.
Word is an experiential reference; do not invent its proprietary mechanism.

## Remaining outcomes, not tasks for this dispatch

1. Agree on ranked gaps, target behaviors and measurable acceptance budgets.
2. Correct coherent navigation/find/search workflow gaps, with developer files.
3. Improve input correctness, scheduling and opt-in motion without caret lag.
4. Improve the React authoring loop and language tooling within trust boundaries.
5. Perform integrated dev/production keyboard, IME and performance verification.

The user explicitly confirmed BOTH caret gliding and smooth scrolling. Keep both
as acceptance dimensions. Keep this note and the saved worker
session for review-driven continuations. Do not restart accepted work.

First run dx-research-20260913-01 launched successfully: runner PID 8232, worker
PID 25296. The actual saved session will be consumed from the stage callback;
do not poll an active worker. Run directory: scripts/.zcode-dispatch/dx-research-20260913-01.
