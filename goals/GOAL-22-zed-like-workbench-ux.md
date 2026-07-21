# GOAL-22 — Zed-like Workbench Navigation and Command Routing

> File created by the `create-goal` skill.
> Executing agent: read this entire file before doing anything.
> Also read and follow [AGENTS.md](../AGENTS.md), [docs/product-vision.md](../docs/product-vision.md), [docs/architecture.md](../docs/architecture.md), [docs/security.md](../docs/security.md), and [DESIGN.md](../DESIGN.md).

---

## Objective

Make everyday navigation and file lifecycle in mdx-vault behave like a mature Zed/VS Code-style workbench while retaining the product's Obsidian-like, local-first vault model and native MDX editing.

Replace the current scattered shortcut listeners and path-only tab prototype with one transactional, action-driven workbench in which:

- `Ctrl/Cmd+P` finds and opens **every visible vault file**, not only indexed notes;
- `Ctrl/Cmd+W` closes the active tab, not the Electron window, and never hides unsaved work after a failed save;
- tabs deduplicate files, preserve per-tab view state, activate by MRU history on close, and support both MRU and visual-order navigation;
- the command palette, keyboard shortcuts, menu hints, toolbar buttons, explorer focus, and tab controls dispatch the same registered actions;
- modal/panel focus determines which action may run, so background tabs are not changed through dialogs and editor keystrokes are not stolen; and
- Settings becomes searchable and gains a small, safe Keymap surface for single-keystroke application commands.

This goal establishes a **single-pane workbench baseline**. It does not attempt to clone Zed's entire action/settings catalog.

---

## Context

- **Reason**: the app has the visible pieces of an IDE—file tree, editor, command palette, settings, and an uncommitted tab strip—but their interaction contracts are incomplete or disconnected. The user explicitly expects Zed/VS Code muscle memory, especially `Ctrl+P` to open a file and `Ctrl+W` to close the active tab.
- **Product fit**: Zed supplies the workbench interaction vocabulary; Obsidian supplies the portable vault/knowledge model; mdx-vault keeps MDX and sandboxed interactive islands as its differentiator.
- **Priority order**: data safety and deterministic action routing > keyboard/focus correctness > completeness of the selected behavior matrix > visual polish.
- **Primary live-verification platform**: Windows 11. Implement and unit-test `Cmd` display/matching paths for macOS, but do not claim live macOS verification unless it is actually performed.
- **Created**: 2026-07-21.
- **Depends on**:
  - GOAL-12/13 — command palette, quick switcher, actions, recents, and navigation surfaces;
  - GOAL-14 — interaction audit, especially bundle B4 and its command-routing draft;
  - GOAL-16 — opening/editing plain text and previewing images anywhere in the vault;
  - GOAL-20 — centralized Settings dialog and app-settings persistence.
- **Assumes**: GOAL-15 through GOAL-21 are complete where a goal file exists; GOAL-19 remains explicitly reserved and is unrelated.

### Authoritative reference decisions

The references below are behavioral evidence, not a requirement to reproduce every Zed feature:

| Reference | Decision adopted by this goal |
|-----------|-------------------------------|
| [Zed Finding & Navigating](https://zed.dev/docs/finding-navigating) and [All Actions](https://zed.dev/docs/all-actions) | Separate file finding (`Ctrl+P`) from action finding (`Ctrl+Shift+P`/`F1`); route both through registered actions |
| [Zed Tab Switcher](https://zed.dev/docs/tab-switcher) | Adopt recent-use ordering, modifier-release commit, and Escape cancellation. To keep file loading transactional, v1 highlights a transient MRU choice while the original document remains active; Zed's live document preview during cycling is deliberately deferred |
| [Zed Project Panel](https://zed.dev/docs/project-panel) | Adopt `Ctrl+Shift+E` for explorer toggle/focus instead of export. Zed's panel also documents preview-versus-permanent opens; this goal deliberately defers preview tabs, so mdx-vault's permanent open routes focus the document as an app-specific decision |
| [Zed Key Bindings](https://zed.dev/docs/key-bindings) | Bindings are attached to actions and resolved by active context; user overrides take precedence over defaults |
| [Zed All Settings](https://zed.dev/docs/reference/all-settings) | Default post-close activation is history-based; close-with-no-tabs is an explicit policy; settings need searchable metadata and typed defaults |
| User-provided Zed Settings screenshot | Reuse the searchable sidebar/content information architecture, translated into the existing editorial design system; do not imitate Zed's visual theme |

Decisions already made for mdx-vault v1:

1. There is one center pane and every file opened from the file finder is a permanent tab. Preview tabs, split panes, and pinned tabs are deferred.
2. Closing the last tab leaves a stable empty workbench. Pressing Close Active Item again with no tabs follows the persisted `whenClosingWithNoTabs` policy, whose safe default is `keep_window_open`.
3. Closing an active tab activates the most recently used surviving tab by default. Optional right/left-neighbour behavior is a setting.
4. User keymap overrides support multiple **single-keystroke** alternatives per stable application action. Multi-stroke sequences and arbitrary context-expression syntax are deferred.
5. Settings remains the existing in-window dialog. A separate settings window, editable `settings.json`, and editable `keymap.json` are deferred.
6. Ordinary CodeMirror/browser editing shortcuts remain editor-owned. They are not copied into the application action registry.

---

## Current State

Treat every line below as a baseline to re-check at execution time, not as trusted memory.

| Area | Current evidence and gap |
|------|--------------------------|
| File finder | [QuickSwitcher.tsx](../src/renderer/src/explorer/QuickSwitcher.tsx) accepts only `IndexedNoteSummary[]`; `Ctrl+P` cannot find CSV, JSON, TSX, images, or fallback files even though `vault.treeFiles` contains them |
| Command actions | [actions.ts](../src/renderer/src/commands/actions.ts) stores display metadata and `run`, while [useKeyboardShortcuts.ts](../src/renderer/src/hooks/useKeyboardShortcuts.ts) independently hardcodes executable chords; labels are not proof of behavior |
| Shortcut conflicts | `Ctrl+Shift+E` currently means export instead of explorer focus. `Ctrl+Shift+V` is globally prevented and cycles all three view modes, conflicting with editor/native paste-without-formatting behavior recorded by GOAL-14 |
| Overlays | App owns separate booleans for quick switcher, command palette, search, create, export, settings, and confirmations. Raw modal divs autofocus but do not share focus restoration or background-action suppression |
| Settings | [SettingsDialog.tsx](../src/renderer/src/settings/SettingsDialog.tsx) has General, Editor, AI, and About. It has no search, Workbench category, Keymap category, conflict UI, or reset-to-default rows |
| Settings persistence | [app-settings.ts](../src/main/services/app-settings.ts) v2 contains `lastVaultPath`, theme, file-tree sort, and editor font size. Individual read-modify-write setters can lose concurrent updates; handlers are embedded in [src/main/index.ts](../src/main/index.ts) |
| Editor lifecycle | Notes and text files use separate single-active-file controllers. Both save before many navigation routes, but note load currently ignores a failed-save boolean in one path; lifecycle is not expressed as one active-item transaction |
| Automated coverage | There are no checked-in tests for Quick Switcher, Command Palette, global shortcut execution, overlay focus, or tabs. Existing tests are suitable for testing new pure reducers/resolvers without adding a browser-test dependency |
| Baseline checks | At goal-authoring time, the dirty worktree passes `bun test` (93 tests) and `bun run typecheck` |

### Existing dirty prototype — inspect, do not blindly preserve or discard

There is uncommitted tab work in the shared working tree:

- untracked `src/renderer/src/hooks/useEditorTabs.ts` and `src/renderer/src/components/layout/EditorTabs.tsx`;
- modified `src/main/index.ts`, `src/renderer/src/App.tsx`, `AppLayout.tsx`, and `MainEditor.tsx` wiring that prototype;
- related uncommitted tab/chrome notes in `DESIGN.md` and styles in `globals.css`;
- additional unrelated modified/untracked app, example-vault, research, and interactive-note files.

The prototype already offers a useful tab strip, click/X/middle-click, active-tab scrolling, positional `Ctrl+Tab`, and Windows/Linux native-menu removal. It is **not an accepted implementation**:

- close removes state before asynchronous save/navigation succeeds;
- closing the last tab fires saves without awaiting them and clears selection immediately;
- a failed note save can still be followed by buffer replacement;
- relative paths can survive a vault switch when the next vault happens to contain the same path;
- rename/delete handling is path-pruning rather than a workbench transaction;
- there is no per-tab cursor/selection/scroll/view-mode state, MRU switcher, closed stack, roving tab focus, or automated coverage; and
- global tab listeners can act behind dialogs.

The executing agent may adopt, refactor, or replace this prototype, but must preserve unrelated work and prove every required behavior below.

---

## Target State

### 1. Transactional workbench item model

Create one testable workbench domain for tabs/items rather than spreading tab mutations across `App`, editor hooks, and the tree.

At minimum, model:

```ts
type WorkbenchItemKind = 'note' | 'text' | 'image' | 'unsupported'

interface WorkbenchItem {
  id: string // canonical vault-relative path within the current vault session
  relativePath: string
  kind: WorkbenchItemKind
}

interface WorkbenchState {
  items: WorkbenchItem[]       // visual order
  activeId: string | null
  mruIds: string[]             // activation history, separate from visual order
  closedIds: string[]          // bounded current-session reopen stack
}
```

The exact React/module shape may differ, but the following invariants are mandatory:

- One canonical vault-relative path identifies one open item in the **current vault session**. Tree, File Finder, search result, wikilink, go-to-definition, newly created note, tab reopen, and any other navigation route call the same `openOrActivate(relativePath)` transaction.
- Opening an existing path activates it without duplicating the tab.
- Every transition away from a dirty editable item—whether the destination is a note, text file, image, or unsupported file—saves the current item first. A failed save or failed destination load leaves the original active item, content, tab collection, MRU list, and focus unchanged except for a visible error.
- Closing an ordinary existing editable item awaits its save. Only a successful save may commit tab removal. A failure keeps the tab active and its exact content visible. The sole exception is an already missing dirty item that the user explicitly confirms to discard after its source was deleted externally.
- A tab close button, middle-click, `Ctrl/Cmd+W`, command palette action, and menu item invoke the same close transaction and produce identical state.
- Closing an inactive tab does not disturb the active item. Closing the active tab applies `activateOnClose`: `history` chooses the most recently used surviving item, falling back to right then left; `right` chooses the immediate right neighbour, falling back to left at the edge; `left` chooses the immediate left neighbour, falling back to right at the edge. These policies do not wrap after removal.
- Closing the final tab shows the existing empty/welcome workbench without closing the window. A subsequent Close Active Item with no tabs applies `whenClosingWithNoTabs` (`keep_window_open` default or `close_window`) through a narrow window API.
- `Ctrl/Cmd+Shift+T` reopens the most recently closed path if it still exists; a missing path is skipped/reported without creating a phantom tab. Keep a bounded stack such as 20 entries `[estimate]`.
- Existing app-driven rename/delete remains scoped to MD/MDX notes. Renaming an open note saves it first, then updates its identity and label **in place**, preserving visual position, MRU position, and view state. Deleting an open dirty note saves it before moving it to trash and closes it only after the existing confirmation and filesystem operation both succeed; a failed save/delete aborts the state transition. This goal does not add generic rename/delete for text, image, or unsupported items.
- A vault switch always resets tabs, MRU, closed history, pending open/close requests, and captured view state, even when both vaults contain identical relative paths.
- Watcher-driven disappearance retains both clean and dirty items and marks the tab visibly missing (for example, struck label plus an accessible "File deleted" status). Preserve any in-memory content. Pause/cancel queued autosave for the missing item, and harden existing-file note/text writes so an external deletion is rejected instead of silently recreating the path; file creation continues through the existing explicit create APIs. Closing a missing dirty item uses an explicit Discard/Cancel confirmation; every ordinary existing-file close still follows save-before-remove. Do not invent a broad Save As feature or configurable external-delete policy inside this goal.
- Asynchronous operations use request identity/cancellation so a slow earlier open cannot override a later choice or leave a phantom tab.
- For each open editable tab, capture and restore cursor, selection, and scroll position for the current session. Preserve the note's existing view mode where meaningful. Images/unsupported items restore focus to their document surface, not to a removed DOM node.

Put tab transitions in a pure reducer/state-machine module and filesystem/editor effects in a thin controller so failure paths can be unit-tested without React.

### 2. One action registry and context-aware dispatcher

Evolve the existing `CommandAction` concept into one registry of stable application actions. The exact type is flexible, but it must support the equivalent of:

```ts
interface WorkspaceAction {
  id: string
  title: string
  description: string
  category: string
  keywords?: string[]
  defaultBindings: KeyBinding[]
  context: ActionContext
  isEnabled: (snapshot: ActionSnapshot) => boolean
  run: (input?: unknown) => void | Promise<void>
}
```

Required behavior:

- Put stable keybindable action IDs, fixed contexts, and platform-default binding metadata in a shared framework-free module that main-process settings normalization and renderer dispatch can both import. Dynamic template-instance actions remain renderer-only and non-keybindable.
- Command Palette, shortcut dispatch, AppMenuBar hints/selection, toolbar buttons covered by the registry, tab buttons/context actions, Settings Keymap rows, and explorer-focus actions resolve/dispatch a stable action ID. Targeted controls may pass a typed payload—for example `dispatch('workbench.close-item', { id })`—while Close Active Item resolves the active ID; both must call the same transactional controller. Do not leave a second hand-written list of executable shortcuts.
- Preserve existing stable action IDs where their semantics still fit. If `note.open` becomes `file.open`, migrate or alias persisted command-palette pinned/recent IDs rather than silently losing them.
- Separate **application actions** from CodeMirror/browser/OS editing keymaps. `Ctrl+C`, `Ctrl+V`, `Ctrl+Shift+V`, undo/redo, text navigation, composition, and editing commands remain owned by the focused editor/input unless an explicit app action is valid in that context.
- Use a small explicit context model: at minimum `Workspace`, `Editor`, `Explorer`, `Picker`, `Settings`, `Dialog`, and `KeyRecorder`. Lower/more-specific active contexts win. Do not implement Zed's arbitrary boolean context-expression language.
- Match modifiers exactly. Normalize `Mod` to Ctrl on Windows/Linux and Cmd on macOS; display the effective platform chord from the same representation used for execution.
- Define a platform-specific reserved/native chord policy in the same shared framework-free module. Reject bindings that Electron, the development shortcut watcher, the OS, or the retained macOS application menu owns and that this goal does not explicitly reroute—for example F12/devtools, reload chords such as `Mod+R`, Windows `Alt+F4`, and macOS Quit/Hide/Minimize chords. Show a specific reason instead of persisting a binding that can never dispatch. `Cmd+W` is the explicit routed exception covered by the native-window policy.
- Ignore composition events. Prevent browser/Electron defaults only when an enabled action or an explicit higher-priority context guard handles the chord. A modal guard may consume a hazardous chord without mutating background state so it cannot fall through to browser Print or native Close Window. Key recording suspends ordinary dispatch. Decide repeat behavior per action; destructive/open/close actions must not repeat unintentionally.
- Modal/dialog context suppresses background workbench mutations. `Ctrl/Cmd+W` while Settings, a confirmation dialog, or the key recorder owns focus must be consumed by that context and must not close either a background tab or the native window. Likewise, picker/application chords such as `Ctrl/Cmd+P` must not fall through to browser defaults.
- Failed asynchronous actions report through the existing visible error/toast path and do not create unhandled rejections.

Required default bindings for the selected baseline:

| Action | Windows/Linux | macOS display/match | Notes |
|--------|---------------|---------------------|-------|
| Open File / File Finder | `Ctrl+P` | `Cmd+P` | Replaces note-only semantics |
| Command Palette | `Ctrl+Shift+P`, `F1` | `Cmd+Shift+P` | Same registered action; follows Zed's platform defaults |
| Close Active Item | `Ctrl+W`, `Ctrl+F4` | `Cmd+W` | Never falls through to window close while a tab exists |
| MRU Tab Switcher | `Ctrl+Tab`, `Ctrl+Shift+Tab` | same | Uses MRU, not visual order |
| Next/Previous Visual Tab | `Ctrl+PageDown`, `Ctrl+PageUp` | `Cmd+}`, `Cmd+{` | Cycles visual order without stealing macOS editor page-scroll chords |
| Reopen Closed Item | `Ctrl+Shift+T` | `Cmd+Shift+T` | Current session only |
| Explorer Toggle/Focus | `Ctrl+Shift+E` | `Cmd+Shift+E` | Export loses this default binding but remains an action/menu command |
| Toggle Left Panel | `Ctrl+B` | `Cmd+B` | Show/hide without conflating export |
| Save Active Item | `Ctrl+S` | `Cmd+S` | Routes through active item capability |
| Project Search | `Ctrl+Shift+F` | `Cmd+Shift+F` | Preserve existing surface |
| New Note | `Ctrl+N` | `Cmd+N` | Preserve existing action |
| Settings | `Ctrl+,` | `Cmd+,` | Preserve existing surface |

Also register palette-visible actions for Focus Editor, Close Active Item, Next/Previous Tab, Reopen Closed Item, Explorer Toggle/Focus, and Toggle Left Panel even where v1 assigns no extra default chord. Save All is deferred because this goal saves before leaving an editable item, so inactive dirty buffers are not part of the v1 model.

`Ctrl+Shift+V` must stop being a global three-mode cycle. It passes through in editable content; the three view modes remain available from their existing UI and registered actions.

### 3. Vault-wide File Finder (`Ctrl/Cmd+P`)

Rename/refactor Quick Switcher as needed, but retain the useful note alias and create-note behavior without keeping it note-only.

- Source results from `vault.treeFiles`, which is already the safe visible-file inventory. Include MD/MDX notes, allowlisted editable text, images, and unsupported/read-only fallback files. Do not crawl the filesystem from the renderer and do not widen any IPC.
- Enrich note rows with indexed title and aliases by relative path. Non-note rows use filename, extension/kind, and relative directory.
- Match case-insensitively against basename, extension, vault-relative path, note title, and aliases. Ranking must be deterministic: strong basename/title matches before path-only matches; an empty query promotes current-session recent files and open tabs, then uses a stable fallback order.
- Reset recency on vault switch. Do not store absolute vault paths in renderer storage. Full cross-restart workspace/session restoration is out of scope.
- Opening the picker focuses and selects the query. Arrow Up/Down changes the active descendant; Enter opens/activates the selected result; Escape/backdrop cancels; clicking a row behaves like Enter.
- A valid explicitly labeled "Create MDX note" row may remain when there is no exact note match. It must not overwrite an existing path or interpret an arbitrary file-like query (for example `data.csv`) as a note without a clear explicit choice.
- Successful selection closes the picker, clears its transient query/selection/error state, and focuses the activated editor/document. Cancellation restores the exact previously focused connected element.
- A stale/deleted result produces a controlled error and neither adds a tab nor changes the active file.
- With no vault, the action is disabled and does not open a useless empty picker.
- Use proper dialog/listbox/option semantics, active-descendant or roving focus, focus containment, and scroll the selected row into view. Preserve reduced-motion behavior.

### 4. Tabs, tab strip, and MRU switcher

- Render MDX, text, image, and unsupported items through the same tab lifecycle. Tab labels distinguish duplicate basenames by exposing enough relative path in title/secondary text/tooltip.
- Preserve the existing editorial chrome hierarchy in `DESIGN.md`; do not redesign the entire app or imitate Zed's colors.
- Tab strip pointer behavior: click activates, close button closes, middle-click closes, and closing must not leave focus on a removed button.
- Tab strip keyboard behavior: one tab stop (roving `tabIndex`), Left/Right/Home/End move focus, Enter/Space activates, Delete invokes Close Item, and selected/focused states are exposed through correct ARIA.
- `Ctrl+PageUp/PageDown` on Windows/Linux and `Cmd+{`/`Cmd+}` on macOS immediately activate previous/next by visual order with wraparound.
- `Ctrl+Tab` opens a compact MRU switcher with transient `{ originId, candidateIds, highlightedId }` state ordered by recent usage and highlights the previously used tab. Repeated Tab presses move only the transient highlight; they do not load files or mutate MRU. Shift reverses. Releasing the triggering modifier or pressing Enter commits exactly one ordinary `openOrActivate` transaction; Escape discards the transient state with the origin still active. If the final open/load fails, the origin and pre-switch MRU remain unchanged and the error is visible. A custom binding with no held modifier opens the persistent overlay and requires Enter/Escape.
- The MRU switcher and visual tab order are separate models. Mouse reordering is not required.
- Empty, one-tab, and rapidly closing/opening states must be deterministic and free of modulo/index errors.

### 5. Overlay arbitration, document focus, and Explorer focus

- Introduce a shared owner/context for global picker-like surfaces so Quick Open, Command Palette, Project Search, Settings, Create Note, and Export cannot accidentally stack and both react to the same global chord. Confirmation dialogs may intentionally sit above a suspended underlying surface but must own the `Dialog` context.
- On cancel, restore the exact invoking element if it is still connected and enabled; otherwise fall back to the active document surface. On successful open/action, focus the resulting document or the next intentionally opened surface.
- Register `Explorer: Toggle Focus` on `Ctrl/Cmd+Shift+E`:
  - hidden explorer → show it and focus the selected/current tree row or tree root;
  - visible but unfocused explorer → focus it;
  - already focused explorer → return focus to the active editor/document.
- Register `View: Toggle Left Panel` on `Ctrl/Cmd+B` for show/hide without changing the active tab.
- File selection in Explorer, Search, links, File Finder, and go-to-definition all pass through the workbench transaction and end with a deliberate focus target.
- `Escape` dismisses only the topmost dismissible surface. It must not cascade through multiple layers or mutate a background item.

### 6. Searchable Settings and Keymap v1

Refactor only the non-secret app settings needed to make the new behavior reliable. Keep AI settings on their existing secure service and never merge AI secrets into app settings.

#### Typed settings catalog

Create a typed definition catalog for non-secret settings that is the source of truth for key, category, label, description, control kind/options, default, validation/normalization, and reset behavior. It must cover existing theme, file-tree sort, editor font size, plus:

- `workbench.activateOnClose`: `history` (default), `right`, or `left`;
- `workbench.whenClosingWithNoTabs`: `keep_window_open` (default) or `close_window`; and
- `keymapOverrides`: stable action ID to zero or more normalized single-keystroke bindings. Missing means defaults; an empty array means explicitly unbound.

The executing agent may choose flattened or nested persisted JSON, but the public types, normalization, UI, and tests must agree.

#### Persistence and IPC

- Upgrade `PersistedAppSettings` from v2 to v3 with lossless v1/v2 migration, unknown-field stripping, corrupt-file defaults, and bounded normalization of keymap IDs/bindings.
- Serialize app-settings updates so simultaneous theme/keymap/layout changes cannot lose one another. Preserve atomic write-then-rename.
- Extract app-settings IPC out of `src/main/index.ts` into a testable IPC module. Validate every payload with zod, reject non-main-frame callers using the repository's established frame check, and expose only typed narrow preload methods.
- A failed persistence operation is visible and the renderer reconciles to the actual persisted snapshot; do not optimistically display a shortcut that did not save.
- The renderer never receives the absolute settings-file path. Do not add a raw filesystem bridge.

#### Settings UI

- Add a search field to the Settings sidebar. Search setting keys, labels, descriptions, categories, action names, and effective binding text. Results must identify their category and be keyboard navigable.
- Keep General, Editor, AI, and About; add **Workbench** and **Keymap**. Do not create empty imitation categories for Zed features mdx-vault does not have.
- Workbench renders the two behavior settings above with immediate apply, reset-to-default, and visible persistence errors.
- Keymap lists stable keybindable application actions with effective platform bindings, search, Add Binding, Remove, and Reset. Dynamic template-instance actions may remain non-keybindable.
- A recorder captures one chord, suspends normal dispatch, rejects modifier-only, unsafe unmodified printable, and platform-reserved/native bindings with a visible reason, and handles Escape as cancel. Multiple alternative chords per action are allowed. Main-process normalization applies the same reserved policy, so hand-edited corrupt/stale JSON cannot bypass it.
- Exact collisions in overlapping contexts are shown before commit. The UI must either cancel or explicitly replace the old binding atomically; it must never silently dispatch two actions.
- Any saved override updates shortcut execution, Command Palette labels, and AppMenuBar hints immediately without closing Settings. Reset restores current platform defaults.
- The whole surface remains keyboard accessible and uses the existing editorial design tokens/components. No Zed visual clone, gradients, glass, or new design system.

---

## Required Behavior Matrix

Every row is mandatory. If implementation structure changes, preserve the observable contract.

| ID | Contract | Required observable evidence |
|----|----------|------------------------------|
| ACT-01 | Single source | Palette, in-app menu, default key, override key, and direct UI affordance dispatch the same action ID/handler |
| ACT-02 | Exact match | Extra modifiers do not trigger a chord; `Mod` maps/display correctly per platform |
| ACT-03 | Context precedence | Editor/Input/Dialog/KeyRecorder ownership prevents invalid Workspace actions |
| ACT-04 | Event hygiene | Composition and unsafe repeat do not run app actions; default is prevented only when handled |
| ACT-05 | Existing actions | Current palette actions remain available; persistent pinned/recent IDs are preserved or migrated |
| QO-01 | Open | `Ctrl/Cmd+P` opens exactly one File Finder and focuses the query |
| QO-02 | Coverage | MDX, CSV/JSON/TSX, image, and unsupported visible fixtures all appear |
| QO-03 | Matching | Basename/path/extension/title/alias matching and stable ranking are verified |
| QO-04 | Dedupe | Reopening one path activates one tab; no duplicate is added |
| QO-05 | Focus | Enter focuses result content; cancel restores the prior control |
| QO-06 | Stale/no vault | Stale result and no-vault cases do not create phantom UI state |
| TAB-01 | Unified routes | Tree, Finder, Search, wikilink, definition, create, and reopen use `openOrActivate` |
| TAB-02 | Safe switch | Failed save/load leaves active item, buffer, tabs, MRU, and focus unchanged |
| TAB-03 | Safe close | Dirty save completes before removal; failure retains exact content and active tab |
| TAB-04 | Close result | Inactive close preserves active; active close honors history/right/left setting |
| TAB-05 | Last/no tab | Last close leaves empty UI; next close obeys `whenClosingWithNoTabs` |
| TAB-06 | File operations | Open-note rename maps in place; open-note app delete closes after success; external delete of any item retains a visibly missing item; vault switch clears every old item |
| TAB-07 | View state | Returning to an open editable item restores cursor, selection, scroll, and relevant view mode |
| TAB-08 | Visual navigation | Tab strip a11y plus `Ctrl+PageUp/PageDown` (Windows/Linux) and `Cmd+{/}` (macOS) visual cycling work |
| TAB-09 | MRU navigation | Ctrl-Tab switcher highlights by MRU without loading, modifier release/Enter commits once, and Escape leaves the origin active |
| TAB-10 | Reopen | `Ctrl/Cmd+Shift+T` reopens the newest existing closed item once |
| FOC-01 | Overlay ownership | One global surface owns input; background shortcuts cannot mutate tabs |
| FOC-02 | Explorer | `Ctrl/Cmd+Shift+E` show/focus/return cycle is deterministic |
| FOC-03 | Left panel | `Ctrl/Cmd+B` toggles visibility without changing active item |
| FOC-04 | Escape | Only the topmost dismissible surface closes and focus returns deliberately |
| KEY-01 | Overrides | Add, explicitly unbind, replace conflict, and reset all update execution and labels live |
| KEY-02 | Persistence | Overrides survive restart; invalid/corrupt values normalize safely |
| KEY-03 | Reserved chords | Chords owned by Electron/OS/native menus are rejected visibly and never appear as effective bindings |
| SET-01 | Search | Settings search finds current settings and actions by names/descriptions/bindings |
| SET-02 | Workbench | Close activation/no-tab policies apply immediately and persist |
| SET-03 | Failure | Persistence failure is visible and UI reflects the real stored value |
| REG-01 | Editor | Copy/paste, paste without formatting, undo/redo, text navigation, IME, and CodeMirror keymaps still work |
| REG-02 | Existing app | Theme, sort, font size, AI settings, search, create, export, view modes, and sandbox preview still work |

---

## Constraints

> These constraints are mandatory. If they conflict with the execution plan, follow the constraints.

- [x] **No data loss.** Open, activate, close, delete, rename, and vault switch must not hide or replace dirty content after a failed save. Commit UI state only after required effects succeed.
- [x] **Do not treat the existing uncommitted tabs as finished.** Reuse is allowed only where it satisfies the reducer, transaction, focus, and test contracts above.
- [x] **Preserve unrelated dirty work.** Do not revert, overwrite, stage, or commit unrelated changes. Inspect `git status` before editing and stage by explicit path/hunk.
- [x] Do not add dependencies. Use React 19, existing Radix/shadcn primitives, current fuzzy utilities, CodeMirror, zod, and Bun tests already present.
- [x] Do not change vault file formats, note/MDX semantics, SQLite indexing, filesystem allowlists, sandbox permissions, or the trusted/untrusted preview boundary.
- [x] Existing note/text save APIs must reject a path removed after opening instead of recreating it. Keep explicit create APIs separate, retain `safeJoin`/restricted-directory/symlink protections, and add regression tests for the new existing-file precondition.
- [x] File Finder consumes existing `vault.treeFiles` and existing typed read/open routes. It must not expose absolute paths, raw `fs`, `path`, or `ipcRenderer` to the renderer.
- [x] Any new main/preload channel is narrow, typed, zod-validated, restricted to the main frame, and named `domain:action`.
- [x] App settings stay outside the vault in Electron `userData`; AI settings/secrets stay in `AiSettingsService`. Never log, migrate, echo, or persist API keys in app settings.
- [x] Do not silently change a real user's settings file during tests. Use temporary userData directories/fixtures. Do not open or edit a real user vault during live verification.
- [x] Keep application commands distinct from editor/OS shortcuts. Do not register every CodeMirror key as a workbench action.
- [x] Preserve Command Palette pins/recents and current note-create behavior, or provide an explicit tested migration/compatibility route.
- [x] Windows native-menu handling may be changed only enough to prevent Electron from stealing registered workbench chords. On macOS, preserve standard Edit roles while routing `Cmd+W` to Close Active Item when a tab exists; do not remove copy/paste/undo system behavior.
- [x] Zed docs are a taxonomy, not conformance scope. The completion condition is this goal's behavior matrix, not a percentage of Zed's thousands of settings/actions.
- [x] Accessibility is behavior, not polish: focus containment/restoration, visible focus, listbox/tab semantics, and keyboard operation are required.
- [x] Respect `prefers-reduced-motion`; do not add decorative animation as part of this goal.
- [x] If a required case is hard to reproduce, add deterministic pure tests and mark only the unverified platform observation explicitly. Do not drop the case from scope.

---

## Success Criteria and Required Evidence

> Completion requires authoritative evidence. Source presence or a displayed shortcut label alone is insufficient.

| # | Criterion | Verification command/action | Expected signal |
|---|-----------|-----------------------------|-----------------|
| 1 | Pure workbench transitions are complete | `bun test tests/workbench-state.test.ts` | Dedupe, visual/MRU order, close inactive/active/last, all three activation policies and edge fallbacks, both no-tab policies, reopen, rename, app/external delete, missing dirty discard/cancel, vault reset, request races, and injected failed save/load transactions pass |
| 2 | Keybinding resolution is deterministic | `bun test tests/keybinding-resolver.test.ts` | Exact modifiers, Mod mapping/display, context precedence, repeat/composition, override/unbind/reset, collision replacement, and platform-reserved rejection (including F12/Mod+R and macOS app-menu chords) pass |
| 3 | File Finder covers the vault | `bun test tests/file-finder.test.ts` | MDX title/alias plus CSV, JSON, TSX, image, unsupported, path, recency, stable ranking, stale path, and no-vault cases pass |
| 4 | Action metadata and execution cannot drift | Add/run `tests/action-registry.test.ts`, then inspect covered call sites with `rg` | Required stable IDs exist once; default bindings resolve; palette/menu/keymap derive from them; covered old hardcoded listeners are gone |
| 5 | Settings v3 is safe | Extend/run `bun test src/main/services/app-settings.test.ts` | v1→v3 and v2→v3 migration, corrupt/unknown/oversized keymaps, secret stripping, atomic round-trip, and concurrent updates without lost values pass |
| 6 | Settings state and IPC are hardened | Add/run focused tests for renderer settings reconciliation and extracted `src/main/ipc/app-settings-ipc.ts` | A rejected write restores the persisted value and exposes an error; valid IPC returns persisted snapshots; invalid payloads and non-main-frame callers are rejected; no raw path/API is exposed |
| 7 | Editor content/view state is safe | Unit adapter tests with injected success/failure fakes, existing-file write service tests, and the live success path | Cursor/selection/scroll restore; immediate dirty close saves; deterministic fake save/load failures leave exact active content/tab state; note/text writes reject externally removed paths instead of recreating them |
| 8 | Native-window shortcut policy is explicit | Add/run `tests/window-shortcut-policy.test.ts` (or an equivalent pure main-process policy test), then perform the Required Live Electron Pass on Windows | Windows/Linux registered chords are not stolen; macOS policy routes Close Active Item while retaining standard Edit roles; Windows live scenarios record pass/fail and live macOS remains explicitly unverified if unavailable |
| 9 | Existing editing behavior regresses neither | In source editor and text inputs test copy/paste, plain paste, undo/redo, IME/composition where available, and ordinary navigation | Editor behavior remains native; `Ctrl+Shift+V` is no longer captured by the old global view-cycle handler |
| 10 | Existing app surfaces still work | Smoke Settings current fields/AI, Search, Create, Export, view modes, theme, FileTree sort, image/text/MDX open, wikilink/definition navigation, and one sandbox island | No broken entry point; all navigation routes dedupe through the workbench |
| 11 | Repository checks pass | `bun test`; `bun run typecheck`; `bun run lint`; `bun run build`; `git diff --check` | All commands exit 0. If a pre-existing unrelated issue appears, preserve exact before/after evidence and do not hide it |
| 12 | Scope and dirty work are preserved | `git status --short`; `git diff --name-only`; review staged diff before commit | Only GOAL-22 implementation/docs are staged; unrelated example-vault/research/interactive changes remain untouched |

Use equivalent filenames only if the final module naming is clearer; retain the same pure-test coverage and report the mapping.

### Required Live Electron Pass

Use a disposable vault outside the repository or a verified disposable copy of `example-vault`. Launch Electron with an isolated disposable `userData` profile so restart/keymap tests cannot mutate real settings. If the repo has no such launch path, add a narrowly scoped development/test-only override before `app.whenReady()` that accepts an explicit absolute directory created under `os.tmpdir()`, resolves and verifies that boundary, and calls `app.setPath('userData', ...)`; it must be inactive in packaged production. Do not back up/overwrite a real profile as a shortcut. Include:

- two MDX notes, one with an alias and one wikilink;
- `.csv`, `.json`, and `.tsx` editable text files;
- one PNG/JPEG;
- one visible unsupported binary fixture; and
- two same-basename files in different folders.

Record the app build/commit, OS, fixture root description without private content, and results for every scenario:

1. Open File Finder with `Ctrl+P`; search/open MDX by title and alias, then CSV/JSON/TSX, image, unsupported file, and both duplicate basenames by path.
2. Reopen the same path from File Finder, Explorer, search/link/definition where applicable; confirm exactly one tab.
3. Cancel File Finder/Command Palette/Settings with Escape and backdrop; confirm focus returns to the invoking connected control. Open a result and confirm document focus.
4. Edit a note, immediately press `Ctrl+W`, and confirm disk content is saved before the tab disappears. The failure path is proved deterministically with the injected controller fakes required by Criterion 7; reproduce it live only if a safe disposable-fixture method is available.
5. Close inactive, active, and last tabs by button, middle-click, `Ctrl+W`, and palette action; exercise history/right/left activation. Verify `keep_window_open`, then test `close_window` last because it intentionally closes the fixture window.
6. Exercise `Ctrl+PageUp/PageDown`, the tab strip keyboard model, and MRU `Ctrl+Tab`/`Ctrl+Shift+Tab`, including Escape cancellation.
7. Rename and delete open MD/MDX notes; externally delete one clean and one dirty disposable item; switch to another fixture vault containing one identical relative path. Confirm note rename-in-place, note delete cleanup, visibly retained missing items without path recreation, explicit dirty Discard/Cancel, and no cross-vault tab leakage.
8. Use `Ctrl+Shift+E` to show/focus/return from Explorer and `Ctrl+B` to toggle its visibility. Confirm Export remains reachable through its action/UI.
9. While Settings, a confirmation dialog, and the key recorder own focus, press `Ctrl+W`, `Ctrl+P`, and another workbench chord; confirm no background tab mutation or stacked global picker.
10. Add a non-conflicting File Finder binding, verify both execution and palette/menu labels update, restart and verify persistence, explicitly unbind, then reset.
11. Attempt a binding conflict, cancel once, then explicitly replace it; confirm exactly one action dispatches and the displaced action is visibly unbound/reassigned.
12. Verify `Ctrl+Shift+V` and normal clipboard/undo/navigation behavior in CodeMirror and Settings/AI text inputs.

Capture screenshots only for ambiguous failures or focus/state evidence. Do not include personal paths, note content, API keys, or unrelated desktop surfaces.

---

## Evidence Snapshot — 2026-07-21

- Full repository gates: `bun test` (226 pass, 0 fail), `bun run typecheck`,
  `bun run lint`, `bun run build`, and `git diff --check` all exit 0.
- Focused suites cover the workbench reducer/controller/resource transactions,
  editor adapters/view state, File Finder, action registry, keybinding contexts,
  Settings v3 service/catalog/reconciliation/IPC, native shortcut policy, isolated
  `userData`, image staging, unsupported probes, and existing-file write safety.
- The Windows disposable-vault record is
  [docs/verification/goal-22-windows-live-pass.md](../docs/verification/goal-22-windows-live-pass.md).
  It records every required scenario and final profile reset. Live macOS, the
  successful second-vault selection, an additional immediate dirty-note close, and
  AI-field clipboard repetition remain explicit partial observations; the in-app
  delete click awaits action-time destructive confirmation rather than being claimed.
- Unrelated example-vault, research, and interactive-note work remains outside the
  GOAL-22 staging scope.

---

## Execution Plan

1. **Re-audit and baseline**
   - Read required docs and this goal in full.
   - Inspect `git status`, the tab prototype diff/untracked files, current action/menu/shortcut/settings/editor flows, and current tests.
   - Run `bun test`, `bun run typecheck`, and `bun run lint`; record any pre-existing issue before editing.

2. **Extract pure domain modules with red tests first**
   - Add the workbench state machine, keybinding normalizer/resolver, File Finder ranking model, and action definitions/types.
   - Write failing tests for every relevant behavior-matrix row before wiring React effects.

3. **Make editor/workbench effects transactional**
   - Add one awaited `openOrActivate`, save-active, close, rename, delete, reopen, and vault-reset controller over the existing note/text/image/fallback capabilities.
   - Correct the existing note failed-save/load path before any UI starts using it.
   - Add the existing-file write precondition and missing-item/autosave handling without widening create or filesystem permissions.
   - Capture/restore per-tab view state and make async requests race-safe.

4. **Unify actions and shortcut dispatch**
   - Migrate `useCommandActions`, `useKeyboardShortcuts`, tab listeners, menu hints, and relevant UI entry points to stable action dispatch.
   - Implement contexts, exact matching, platform display, modal suppression, and current-action ID compatibility.
   - Resolve `Ctrl+Shift+E` and `Ctrl+Shift+V` conflicts explicitly.

5. **Build File Finder and tab navigation**
   - Generalize Quick Switcher to all `treeFiles` with note metadata enrichment and deterministic ranking.
   - Wire every navigation route through the workbench.
   - Finish accessible tabs, visual cycling, MRU switcher, and reopen-closed behavior.

6. **Centralize overlay/focus and panel actions**
   - Add overlay ownership/context, focus capture/restore, and document fallback.
   - Wire Explorer toggle/focus and left-panel toggle actions without changing active documents.

7. **Upgrade Settings and IPC**
   - Introduce the non-secret typed settings catalog, v3 migrations/serialized atomic updates, extracted hardened IPC, and preload types.
   - Add Settings search, Workbench controls, Keymap recorder/conflict/reset UI, and live action-label sync.
   - Keep AI settings on the existing secure path.

8. **Integrate native-window behavior**
   - Ensure Windows/Linux Electron menus do not steal registered chords.
   - Preserve macOS Edit roles while routing Close Active Item correctly; add platform-source/unit evidence if live macOS is unavailable.
   - Implement the narrow close-window path used only by the explicit no-tabs setting.

9. **Verify and document**
   - Run focused tests after each subsystem, then the full required command suite.
   - Perform and record the complete disposable-vault Electron pass.
   - Update relevant architecture/design documentation and the GOAL-22 row without overwriting unrelated dirty documentation.
   - Verify each success criterion, mark completed checkboxes only with evidence, stage selectively, and commit conventionally.

---

## Out of Scope

- Cloning every Zed action or setting, or claiming numeric Zed/VS Code parity.
- Split/multiple panes, moving tabs between panes, pane zoom, multi-window workspaces, complex docks, terminal, debugger, Git UI, collaboration, remote development, tasks, or LSP actions.
- Preview tabs, pinning, tab drag reorder, tab groups, close-left/right/others/clean, max-tabs eviction, or persisted workspace layouts.
- Cross-restart open-tab restoration, unsaved-buffer recovery, history persistence, or cursor restoration after app restart.
- Editable `settings.json`/`keymap.json`, a separate Settings BrowserWindow, settings profiles, vault-specific settings, settings sync, alternative base keymaps, arbitrary keymap contexts, or multi-stroke key sequences.
- Configurable autosave modes, preview-tab policy, tab close-button position, project-panel docking/resizing/sticky scroll, or configurable external-delete policy.
- Full navigation back/forward history (`Alt+Left/Right`) and symbol/project-content search beyond the existing search surface.
- New file/folder explorer transactions, drag/drop, clipboard file operations, or expanded context menus; use existing safe file operations.
- A general Save As flow for deleted/missing files.
- Changing MDX compilation, preview sanitization, component registries, sandbox permissions, AI approval, or export fidelity.
- A new UI design system. The Zed screenshot informs information architecture only; [DESIGN.md](../DESIGN.md) remains authoritative.

---

## Reference Artifacts

### Repository

- [docs/research/obsidian-interaction-behaviors-2026-07.md](../docs/research/obsidian-interaction-behaviors-2026-07.md) — especially B4, shortcut conflict, focus, Quick Switcher, and tab prerequisite rows.
- [docs/research/obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md) — workspaces/hotkey infrastructure context.
- [src/renderer/src/App.tsx](../src/renderer/src/App.tsx), [useVaultSession.ts](../src/renderer/src/hooks/useVaultSession.ts), [useNoteEditor.ts](../src/renderer/src/hooks/useNoteEditor.ts), and [useTextFileEditor.ts](../src/renderer/src/hooks/useTextFileEditor.ts) — current selection/save lifecycle.
- [src/renderer/src/hooks/useCommandActions.ts](../src/renderer/src/hooks/useCommandActions.ts), [useKeyboardShortcuts.ts](../src/renderer/src/hooks/useKeyboardShortcuts.ts), [commands/actions.ts](../src/renderer/src/commands/actions.ts), and [CommandPalette.tsx](../src/renderer/src/commands/CommandPalette.tsx) — action/shortcut split to remove.
- [src/renderer/src/explorer/QuickSwitcher.tsx](../src/renderer/src/explorer/QuickSwitcher.tsx), [vault/types.ts](../src/renderer/src/vault/types.ts), and [vault/file-kind.ts](../src/renderer/src/vault/file-kind.ts) — note-only finder versus all visible file kinds.
- [src/renderer/src/settings/SettingsDialog.tsx](../src/renderer/src/settings/SettingsDialog.tsx), [src/main/services/app-settings.ts](../src/main/services/app-settings.ts), [src/main/index.ts](../src/main/index.ts), and preload declarations — Settings v2 and IPC baseline.

### Official Zed documentation

- [All Settings](https://zed.dev/docs/reference/all-settings)
- [All Actions](https://zed.dev/docs/all-actions)
- [Finding & Navigating](https://zed.dev/docs/finding-navigating)
- [Command Palette](https://zed.dev/docs/command-palette)
- [Tab Switcher](https://zed.dev/docs/tab-switcher)
- [Project Panel](https://zed.dev/docs/project-panel)
- [Key Bindings](https://zed.dev/docs/key-bindings)

---

## Agent Instructions

1. Read this entire file and every required project document before editing.
2. Re-check all Current State claims against the live worktree; never rely on goal-author memory for file contents or line numbers.
3. Follow Constraints over the Execution Plan if they conflict.
4. Do not reduce the goal to visible tabs plus two event listeners. Completion requires the entire Required Behavior Matrix and its evidence.
5. Do not expand the goal into all of Zed. Out-of-scope items remain deferred even if the official catalogs mention them.
6. Make safe, local assumptions within the explicit contracts. If a genuinely new product choice would change the required behavior or security boundary, stop and ask; otherwise continue and record the implementation decision.
7. After every meaningful code change, run the focused tests plus `bun run typecheck` and `bun run lint` as required by `AGENTS.md`.
8. At completion, verify every Success Criterion, update checkboxes only where evidence exists, preserve unrelated dirty files, stage selectively, and create a conventional commit.
