# GOAL-27 — Single-pane IDE Intelligence

## Objective

Bring the Source editing experience to a credible VS Code/Zed quality tier
without turning mdx-vault into a generic IDE or introducing split editors.

The goal extends the existing offline TypeScript worker and owned CodeMirror 6
setup with:

1. project-aware find references;
2. safe symbol rename;
3. bounded single-file TypeScript code actions;
4. semantic MDX registry component/prop completion;
5. a full-width Source/code buffer without an overview rail.

The result remains one canonical workbench item and one editor surface. Language
intelligence is local, lazy and analyzes source as data only.

## Context

- GOAL-25 already ships a fixed, offline TypeScript Language Service in a lazy
  renderer worker for one bounded `interactives/<slug>/` project. It supports
  diagnostics, completion, safe auto-import, hover, signature help and local
  definition.
- GOAL-26 establishes the Knowledge Instrument design system and the single-pane
  responsive shell.
- Raw MDX Source now has the same full-width/no-wrap geometry and source
  typography as code buffers, but its completion remains limited to wikilinks
  and its semantic assistance still feels lighter than a mature IDE.
- The official `@mdx-js/language-service` package is an integration layer for
  Volar rather than a small editor-neutral API. Pulling the Volar language
  service stack into this app would duplicate the bounded worker architecture
  and materially increase bundle/lifecycle complexity.

## Target State

### 1. Capability matrix

| Capability | Raw `.md/.mdx` Source | Interactive `.ts/.tsx` | Other editable code |
| --- | --- | --- | --- |
| Semantic completion | Registry JSX tags and props + existing wikilinks | Existing TypeScript completion/auto-import | Existing language parser completion |
| Hover | Registry component/prop documentation + existing definitions | Existing TypeScript quick info | Existing behavior |
| Rename | Not claimed | `F2`, only when every rename location is in the active buffer | Not claimed |
| References | Not claimed | `Shift+F12`, project-wide read-only result list | Not claimed |
| Code actions | MDX syntax diagnostics are parse-only, no code actions | `Ctrl+.`, TypeScript fixes whose edits all target the active buffer and pass import policy | Not claimed |
| Minimap | No — full-width buffer | No — full-width buffer | No — full-width buffer |

The matrix is intentionally truthful. mdx-vault does not claim a full MDX
TypeScript project, general refactor engine or generic multi-language LSP.

### 2. TypeScript references

- Extend the current versioned worker protocol with a `references` operation.
- Use the installed TypeScript 5.9 Language Service API over the existing
  synthetic `/project` VFS.
- Return only locations that map back to the active interactive project.
- Each result includes vault-relative path, exact UTF-16 range, line/column,
  read/write/definition state and a bounded single-line preview.
- `Shift+F12` opens an editor-owned, keyboard-navigable references popover; it
  does not create a split/peek editor.
- Enter activates a location through existing `openOrActivate` + reveal; Escape
  closes and restores editor focus.

### 3. Safe rename

- `F2` asks TypeScript whether the symbol can be renamed and anchors a labelled
  input at the symbol range.
- Validate the new identifier with TypeScript-compatible identifier rules and a
  bounded length.
- Rename is available only when all returned locations belong to the active
  buffer. If a symbol has cross-file locations, the UI explains that project-wide
  mutation is not available and offers References instead.
- Apply all changes as one CodeMirror transaction so one Undo restores the
  source exactly.
- Never write background files, bypass dirty buffers or add a renderer-to-main
  workspace-write API in this goal.

### 4. Bounded code actions

- `Ctrl+.` requests TypeScript code fixes at the cursor/selection using current
  syntactic and semantic diagnostic codes.
- Return only fixes whose complete edit set targets the active virtual file.
- Reuse the existing dependency policy: no disallowed package, path escape,
  external type loader or multi-file edit.
- Present actions in a keyboard list anchored to the selection; Enter applies
  the selected action in one undoable transaction, Escape closes.
- Lint tooltips may expose the same safe actions, but the Problems ledger
  remains the durable error surface.

### 5. MDX semantic assistance

- Build completion metadata from the trusted in-app registry rather than a
  second compiler/runtime.
- After `<`, suggest registered component names with category and description.
- Inside a known registry opening tag, suggest undeclared prop names based on
  the registry's zod object schema and default props.
- Completion must preserve the existing `[[` source, slash palette and normal
  CodeMirror completion behavior.
- Hover over a known component/prop shows concise app-owned documentation.
- The helper must not evaluate MDX, load vault modules, read `tsconfig`, resolve
  npm packages or imply full MDX type checking.

### 6. Full-width Source buffer

- Raw MDX Source and editable code do not install a minimap or overview rail.
- Source and Live remain the existing modes; Search, Outline, Go to line,
  Problems and References own navigation.
- Do not reserve right-side editor padding or paint a source overview canvas.

### 7. Lifecycle and performance

- New worker requests preserve project/file/request version checks and
  latest-wins cancellation.
- Worker crash keeps editing/save available.
- Popovers close on document change, project switch, Escape and editor destroy.
- Ordinary note Reading/Live use must not initialize the TypeScript worker.

### 8. Documentation

Update `DESIGN.md`, `docs/architecture.md`, `docs/tech-stack.md`,
`docs/roadmap.md`, `goals/README.md` and add
`docs/verification/goal-27-single-pane-ide-intelligence.md` with the exact
capability matrix and evidence.

## Constraints

- Preserve every invariant in `docs/security.md`.
- Do not add split editor, split panes, pane groups, preview tabs or workspace
  layout persistence.
- Do not add a generic LSP transport/server, Monaco, Volar runtime, TypeScript
  plugin, extension host, ATA/CDN types or runtime network lookup.
- Do not evaluate/emit/run source in the worker or registry assistance.
- Keep one active bounded interactive project; do not index the entire vault as
  a TypeScript project.
- Do not add a multi-file write IPC or silently mutate unopened/open dirty files.
- Rename/code actions must be one-buffer-only and undoable.
- References are read-only and project-bounded.
- Preserve autosave, line endings, editor history, selection telemetry,
  formatting shortcuts, paste/drop, wikilinks, slash commands and current
  go-to-definition behavior.
- Keep the TypeScript worker lazy and offline.
- Preserve unrelated dirty-worktree changes.
- Use `apply_patch` for source/document edits and Bun for dependency commands.
- Run `bun run typecheck` and `bun run lint` after each meaningful tranche.

## Success Criteria

- [x] `InteractiveLanguageProject` returns bounded project-only references,
      same-buffer rename plans and safe same-buffer code actions.
- [x] Worker protocol/client/runtime expose the three new operations and reject
      stale, mismatched or invalid requests.
- [x] `F2`, `Shift+F12` and `Ctrl+.` work from keyboard in interactive TS/TSX;
      every popup is labelled, keyboard navigable and restores focus.
- [x] Rename and code action edits apply as one CodeMirror transaction and one
      Undo restores the prior buffer.
- [x] Cross-file rename is refused clearly without mutating disk; References
      still reveal every project location.
- [x] Raw MDX Source suggests registry components and unused props without
      regressing wikilink/slash completion or evaluating source.
- [x] Raw MDX Source and code buffers remain full-width and install no minimap;
      Live mode remains prose-oriented.
- [x] Security/static search finds no generic LSP/Volar/Monaco/runtime network or
      new broad IPC path.
- [x] Focused tests, full `bun test`, `bun run typecheck`, `bun run lint` and
      `bun run build` pass.
- [x] Live Electron verification covers light/dark, MDX completion, TS rename,
      references, code actions, full-width Source/code geometry, narrow layout and console
      errors.
- [x] Verification ledger and product docs state the capability matrix without
      claiming split panes or full MDX TypeScript semantics.

## Execution Plan

1. Record baseline; verify installed TypeScript/CodeMirror APIs and reject a
   Volar/generic-LSP dependency with current official evidence.
2. Add pure reference/rename/code-action models and TypeScript Language Service
   adapters with focused tests.
3. Extend the typed worker protocol, runtime and client; add stale/boundary tests.
4. Add editor-owned single-pane popovers and keymaps; test edit planning,
   keyboard semantics and cross-file refusal.
5. Add registry-backed MDX completion/hover and combine it with existing
   wikilink completion.
6. Keep raw MDX Source and code buffers full-width without a minimap/overview rail.
7. Run focused static gates, then full tests/typecheck/lint/build.
8. Use live Electron verification, capture screenshots/results and audit this
   goal line by line before completion.

## Out of Scope

- Split editors, arbitrary pane grids, pane drag/resize and workspace layouts.
- Full MDX TypeScript virtual-project semantics.
- Cross-file rename/write transactions.
- Multi-file code actions/refactors, formatter, semantic tokens and inlay hints.
- Generic multi-language LSP, extension marketplace or plugin runtime.
- Terminal, debugger, test runner, Git UI or source control.

## References

- [GOAL-25](GOAL-25-interactive-authoring-workbench.md)
- [GOAL-26](GOAL-26-knowledge-instrument-foundation.md)
- [Security model](../docs/security.md)
- [Architecture](../docs/architecture.md)
- [Design contract](../DESIGN.md)
- TypeScript Language Service API:
  <https://github.com/microsoft/TypeScript/wiki/Using-the-Language-Service-API>
- TypeScript compiler API:
  <https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API>
- CodeMirror reference manual: <https://codemirror.net/docs/ref/>
- MDX Analyzer: <https://github.com/mdx-js/mdx-analyzer>

## Agent Instructions

1. Read this file, `AGENTS.md`, `goals/README.md`, `docs/security.md` and the UI
   skills before editing.
2. Follow the capability matrix exactly; do not inflate claims to “full LSP”.
3. Use `rg`, then `ast-grep outline` before large/unfamiliar source reads.
4. After meaningful changes run typecheck and lint; test in proportion to risk.
5. Re-read this goal and inspect the final diff before marking it complete.

## Follow-up — editor readability and typing (2026-09-05)

User-directed refinement of this goal: research VS Code/Zed and improve the
existing editor. The user's stated priority is font, spacing and hard-to-read
layout. Preserve the single-pane and security constraints above.

- [x] Research primary sources and record an actual Electron baseline.
- [x] Improve Source/Live readability, gutter geometry, tabs, breadcrumbs and
      completion typography; keep Reading's editorial design intact.
- [x] Make editor appearance directly adjustable with persisted, accessible
      controls and English/Vietnamese labels.
- [x] Correct Tab/completion/indentation behavior and verify undo.
- [x] Remove measured full-document work from the typing path.
- [x] Run typecheck, lint, focused tests, build and live Electron verification;
      record before/after evidence and remaining limitations.

Evidence: [research](../docs/research/editor-readability-and-typing-2026-09.md)
and [verification](../docs/verification/editor-readability-and-typing-2026-09.md).
