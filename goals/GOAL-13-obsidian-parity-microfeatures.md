# GOAL-13 - Obsidian Parity Microfeatures

> File created by the create-goal skill.
> Executing agent: read this entire file before doing anything.
> Must also read and follow [AGENTS.md](../AGENTS.md), [docs/security.md](../docs/security.md), and [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md).

---

## Objective

Close the highest-impact Obsidian parity microfeature gaps from Group A of the parity audit, without starting larger standalone features. This goal upgrades existing partial surfaces: search, quick switcher, backlinks, templates, slash commands, random/unique note commands, and command palette metadata.

---

## Context

- **Reason**: The 2026-07-10 parity audit found mdx-vault at 4 full, 9 partial, and 17 missing Obsidian core-plugin equivalents. The fastest improvement is not another large panel; it is closing the micro-features inside already shipped partials.
- **Priority**: correctness > speed. These features touch command dispatch, editor insertion, filesystem writes, and SQLite queries.
- **Executor**: AI Agent.
- **Created**: 2026-07-10.
- **Source of truth**: Group A in [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md).

---

## Current State

| Item | Current value |
|------|---------------|
| Runtime / framework | Electron + electron-vite, React 19, TypeScript, CodeMirror 6 |
| Package manager | bun. Use `bun run ...`, do not use npm/pnpm/yarn for dependency work |
| Search | `src/main/services/db-service.ts` has `search(query, limit)` with simple tokenized FTS AND query via `toFtsQuery()`; `SearchPane.tsx` is content-only |
| Search index | SQLite has notes, aliases, links, tags, headings, components, and `notes_fts(note_id, title, body)` |
| Quick switcher | `QuickSwitcher.tsx` uses `getScoredNotes(notes, query)`; aliases affect score through `getNoteLinkKeys()`, but the matched alias is not displayed. Empty query sorts alphabetically, not by recent notes |
| Command palette | `CommandPalette.tsx` runs `CommandAction[]` from `App.tsx`; current action count is about 13. No pinned commands, recent commands, or hotkey labels |
| Backlinks | `DbService.getBacklinks()` returns linked mentions only. `BacklinksPanel.tsx` shows source title/path only, no snippets, filter, sort, or unlinked mentions |
| Templates | `VaultService.listTemplates()` and `renderTemplate()` only support `templates/*.mdx` plus `{{date}}`, `{{time}}`, and `{{title}}`; templates are used for note creation, not insertion into the current note |
| Daily notes | `App.tsx` hardcodes `journal/YYYY-MM-DD.mdx` and optional `templates/daily.mdx` |
| Slash commands | `ComponentInsertPalette.tsx` exists for component insertion, but editor typing `/` does not open a slash command surface |
| Random / unique notes | Missing |
| Existing security boundary | Main process owns filesystem and SQLite. Preload exposes narrow typed APIs. IPC validates with zod. Vault paths must remain relative and pass through `safeJoin()` in main services |

---

## Target State

| Area | Target behavior |
|------|-----------------|
| Search operators | Search supports free text plus `tag:`, `path:`, `file:`, and regex `/pattern/` filters. Operators compose with free text. Invalid regex reports a user-visible error without crashing |
| Search results | Results keep snippets and expose enough metadata for filtered searches to be understandable. Search remains capped and responsive on the example vault |
| Quick switcher | Empty query shows recently opened notes first. Alias matches are visible in results. A non-matching query can create a note directly from the switcher without overwriting an existing file |
| Backlinks | Backlinks panel separates linked and unlinked mentions, includes context snippets, and supports a simple in-panel filter/sort. Unlinked mentions are based on the active note title and aliases, excluding the active note itself |
| Templates | Templates can be inserted into the current note at the editor cursor. `{{date:FORMAT}}` and `{{time:FORMAT}}` are supported using a small allowlisted formatter (`YYYY`, `MM`, `DD`, `HH`, `mm`) with no eval and no dependency requirement |
| Slash commands | Typing `/` at the start of an editor line opens an inline palette. It can run command actions and insert component/template/date/time snippets by replacing the slash trigger |
| Random note | Command palette exposes a command that opens a random indexed note from the current vault |
| Unique note creator | Command palette exposes a command that creates a timestamp-prefixed note using a stable convention, then opens it |
| Command palette | Commands can display hotkey labels. Recently run commands are promoted when query is empty. User-pinned commands are promoted and persist locally |

---

## Constraints

> These are mandatory. If they conflict with the execution plan, follow the constraints.

- [x] Do not implement Group B/C features from the parity audit in this goal: page preview, properties editor, outgoing links panel, file recovery, bookmarks, note composer, graph view, bases, workspaces, settings UI, hotkey editor, tabs, sync, or publish hosting.
- [x] Do not change the Electron hardening model: keep `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- [x] Any new IPC must validate payloads with zod and must not expose raw `fs`, `path`, or `ipcRenderer` to the renderer.
- [x] Any filesystem path from the renderer must remain vault-relative and must be resolved in main process through the existing safe path/service pattern.
- [x] Template formatting is string replacement only. No JavaScript execution, no expression language, no Templater-style scripting, no `Function`, no `eval`.
- [x] Search regex is local-user input but must still be bounded: cap query length, cap result count, handle invalid regex, and avoid scanning unbounded data in the renderer.
- [x] Prefer adding read/query methods over changing the SQLite schema. If a schema change is truly necessary, stop and explain why before implementing it.
- [x] Do not add dependencies unless the current stack cannot reasonably support the feature. If a dependency is unavoidable, stop and ask first.
- [x] Keep Quick Switcher separate from Command Palette. `Ctrl+P` remains note switching; `Ctrl+Shift+P` remains command execution.
- [x] Do not fake tab behavior for `Ctrl+Enter`. mdx-vault does not have tabs yet; tab/new-pane behavior is out of scope.
- [x] Preserve existing GOAL-11/12 behavior: editor highlighting, outline, tags, command palette, templates, daily note, mermaid, callouts, KaTeX, and export must not regress.
- [x] After each meaningful phase, run `bun run typecheck` and `bun run lint`.
- [x] If the worktree contains unrelated existing changes, do not revert them and do not stage them accidentally.

---

## Success Criteria

> Completion requires evidence, not memory. The executing agent must verify each item against the actual app/codebase state.

### Required Evidence per Criterion

| # | Criterion | Verification command / action | Expected signal |
|---|-----------|-------------------------------|-----------------|
| 1 | Search supports `tag:`, `path:`, `file:`, free-text composition, and `/regex/` with invalid-regex handling | Run `bun run typecheck`, `bun run lint`, then verify in the app search modal against `example-vault` fixture notes | Filtered queries return only matching notes; invalid regex shows an error and app stays usable |
| 2 | Quick switcher shows recent notes, visible alias matches, and create-from-switcher | Open at least 3 notes, reopen switcher with empty query, search an alias, then create a note from a non-matching query | Recent order is visible; alias row explains the alias; created note is unique and opens immediately |
| 3 | Backlinks includes linked and unlinked mention sections with snippets and filter/sort | Create or use fixture notes with both `[[Target]]` and plain `Target` mentions | Panel separates linked/unlinked mentions, snippets show surrounding text, filtering/sorting changes visible rows |
| 4 | Current-note template insertion works at cursor with formatted date/time variables | Create `templates/meeting.mdx`, place cursor in an open note, insert it through command/slash UI | Template content appears at cursor; `{{title}}`, `{{date:YYYY/MM/DD}}`, and `{{time:HH:mm}}` are replaced correctly |
| 5 | Slash palette opens from editor `/` trigger and can run command/snippet insertion paths | In source editor, type `/` at start of line and select component/template/date/time plus one non-insertion command | Slash trigger is replaced or removed appropriately; editor focus/content remain coherent |
| 6 | Random note and unique note creator commands exist and work | Run both commands from Command Palette | Random opens an indexed note; unique note creates a timestamp-prefixed `.mdx` note without overwriting |
| 7 | Command palette shows hotkey labels, recent commands, and persistent user pins | Run commands, pin/unpin at least one command, close/reopen app if practical | Empty query promotes pins and recent commands; hotkey labels are visible; pins persist locally |
| 8 | Security and IPC boundaries remain intact | Inspect changed main/preload files and run `rg -n "eval|Function\\(|ipcRenderer|fs\\.|nodeIntegration|contextIsolation|sandbox" src` | No new unsafe eval/template execution; no raw bridge exposure; Electron hardening unchanged |
| 9 | Whole repo still checks | `bun run typecheck` and `bun run lint` | Both commands exit 0 |

### Reference Artifacts

- [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md) - parity audit and Group A priority list
- [docs/security.md](../docs/security.md) - mandatory trust and IPC model
- [docs/product-vision.md](../docs/product-vision.md) - local-first MDX/Obsidian invariants
- Files to inspect before editing: `src/main/services/db-service.ts`, `src/main/services/vault-service.ts`, `src/main/ipc/index-ipc.ts`, `src/main/ipc/vault-ipc.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/search/SearchPane.tsx`, `src/renderer/src/explorer/QuickSwitcher.tsx`, `src/renderer/src/commands/CommandPalette.tsx`, `src/renderer/src/commands/actions.ts`, `src/renderer/src/panels/BacklinksPanel.tsx`, `src/renderer/src/editor/MdxEditor.tsx`, `src/renderer/src/editor/ComponentInsertPalette.tsx`, `src/renderer/src/lib/fuzzy-match.ts`.

### Completion Condition

The goal is complete only when:

- [x] Every success criterion above has concrete evidence.
- [x] `bun run typecheck` passes.
- [x] `bun run lint` passes.
- [x] The parity report Group A items implemented by this goal are no longer partially described in a way that contradicts current behavior. If needed, update the relevant rows in the parity report in the same PR.
- [x] No Group B/C scope was started.

---

## Execution Plan

> Work in phases. Report briefly after each phase and verify before moving on.

1. **Audit baseline**: Read AGENTS/security/research and the reference files listed above. Confirm current behavior in code before editing.
2. **Search operators**: Add a small parsed-query model for free text plus `tag:`, `path:`, `file:`, and `/regex/`. Implement query execution in main/index service with zod-validated IPC types as needed. Keep result caps and invalid-regex errors explicit. Update `SearchPane` UI only as much as needed to surface errors/results cleanly.
3. **Quick switcher upgrades**: Track recently opened notes locally, show recent notes for empty query, expose alias-match labels, and add create-from-switcher for non-matching queries using existing `vault:create-file` safety.
4. **Backlinks upgrades**: Extend backlink result shape or add a new method for linked/unlinked mentions with context snippets. Update panel UI with linked/unlinked sections, simple filter, and sort.
5. **Template insertion**: Extend template rendering to support `{{date:FORMAT}}` and `{{time:FORMAT}}` with an allowlisted formatter. Add current-note insertion at cursor through editor callbacks and command actions.
6. **Slash palette**: Add editor slash trigger at start of line. Reuse existing command/component/template data where practical. Selecting an item must replace/remove the slash trigger and keep editor focus stable.
7. **New commands**: Add Random note and Unique note creator commands. Extend `CommandAction` to carry hotkey labels and any metadata needed for pins/recent ordering.
8. **Command palette polish**: Implement pinned commands, recent command ordering, hotkey display, and local persistence. Keep disabled actions clear and non-runnable.
9. **Fixture and verification**: Add or update example-vault fixture notes only as needed for manual verification. Run `bun run typecheck`, `bun run lint`, and execute the manual checks in Success Criteria.
10. **Documentation update**: If behavior changes the parity status of Group A rows, update [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md) so the report does not become stale.

---

## Out of Scope

- Page preview hover popovers
- Properties editor or all-properties panel
- Outgoing links panel
- File recovery snapshots
- Bookmarks
- Note composer merge/extract
- Graph view
- Canvas, Bases, Workspaces, tabs, hotkey editor, full Settings UI
- Audio recorder, format converter, slides, web viewer, sync, publish hosting
- Arbitrary template scripting or plugin execution
- WYSIWYG editor rendering

---

## References

- Obsidian parity audit: [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md)
- Older broad feature-gap audit: [docs/research/feature-gap-2026-07.md](../docs/research/feature-gap-2026-07.md)
- Obsidian core plugin help index: https://obsidian.md/help/plugins
- Obsidian settings help index: https://obsidian.md/help/settings
- Obsidian help source repo: https://github.com/obsidianmd/obsidian-help

---

## Agent Instructions

1. Read this file, AGENTS.md, docs/security.md, and all relevant reference files before code.
2. Follow Constraints absolutely. If Constraints and Execution Plan conflict, Constraints win.
3. Do not redefine "done" as a smaller subset of Group A because some items are fiddly.
4. Treat uncertain evidence as not done. Inspect current files and app behavior before claiming completion.
5. Keep edits scoped to this goal. Do not start out-of-scope panels or platform work.
6. Use `apply_patch` for manual edits. Do not revert unrelated worktree changes.
7. After each meaningful phase, run `bun run typecheck` and `bun run lint`.
8. When finished, report each Success Criterion with evidence.
