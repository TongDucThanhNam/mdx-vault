# GOAL-23 — Obsidian Knowledge Utilities and Page Preview Coverage

> File created by the `create-goal` skill.
> Executing agent: read this entire file before doing anything.
> Also read and follow [AGENTS.md](../AGENTS.md), [docs/product-vision.md](../docs/product-vision.md), [docs/architecture.md](../docs/architecture.md), [docs/security.md](../docs/security.md), [DESIGN.md](../DESIGN.md), and the two parity audits under `docs/research/` referenced below.

---

## Objective

Close the next cohesive set of high-value Obsidian core-plugin gaps by shipping five integrated, local-first knowledge utilities:

1. **Page Preview coverage** across knowledge-navigation surfaces, including scrollable full-note previews and section-aware `[[Note#Heading]]` previews;
2. **Outgoing Links** for explicit links and safe, linkable unlinked mentions in the active note;
3. **Properties View** for active-note editing plus a vault-wide property inventory and property search;
4. **Bookmarks** for files, folders, searches, and headings, with groups and durable ordering; and
5. **Footnotes View** for navigating and editing footnotes in the active note.

These features must feel like one coherent extension of the existing workbench and right context panel. They are built-in product capabilities, not dynamically loaded plugins, and must preserve mdx-vault's filesystem, Electron, MDX, and sandbox invariants.

---

## Context

- **Reason**: the user identified that a hover preview should show the complete, scrollable note and land directly on a wikilink section, then asked for a broader audit against Obsidian's official Core Plugins catalog.
- **Research result**: Obsidian's current official catalog lists 29 core plugins. mdx-vault already has full or substantial equivalents for the file explorer, search, backlinks, quick switcher, command palette, daily/unique notes, templates, random note, slash commands, outline, tags, word count, and a single-pane workbench. The most valuable remaining features that share the current note/index/navigation architecture are the five utilities in this goal.
- **Why one goal**: all five consume the active note, the note index, the shared action registry, and the existing context panel. Delivering a shared data/query/navigation layer avoids five isolated panels with duplicated loading, source-position, hover, and mutation logic.
- **Why not every missing plugin**: Graph, Bases, Canvas, File Recovery, Note Composer, Workspaces, Sync, and Publish hosting each introduce a distinct product or data-integrity boundary. Combining them here would make verification shallow and would hide destructive failure modes.
- **Created**: 2026-07-23.
- **Depends on**:
  - GOAL-02/13 — note index, SQLite queries, search operators, aliases, backlinks, templates, and command metadata;
  - GOAL-15/18 — transactional path mutations, source-aware link rewriting, and editor source navigation;
  - GOAL-20/22 — centralized Settings v4, shared action/keybinding registry, overlays, tabs, and transactional `openOrActivate`;
  - the current section-aware Page Preview work described in Current State below.

### Product decisions adopted from the official documentation

The official pages are behavioral references, not a requirement to copy Obsidian's internal implementation or visual design.

| Official capability | Decision for mdx-vault |
|---|---|
| Core plugins can be enabled/disabled | These five capabilities remain built-in. Add Page Preview behavior settings, but do **not** create a runtime plugin manager or generic enable/disable framework in this goal |
| Page Preview works on links in File Explorer, Search, Backlinks, and more; Editing view uses `Ctrl/Cmd` hover by default | Cover every link-bearing surface named in Target State. Navigation/Reading surfaces preview on hover or keyboard focus; editor links require `Ctrl/Cmd` unless the global "require modifier" option is enabled |
| Outgoing Links shows links and unlinked mentions; a mention can be converted into a link | Match both sections. Linkification must patch one verified source range and must not modify YAML, code, existing links, HTML/JSX, or ambiguous text |
| Properties View provides active-file and all-properties views, with name/frequency sorting, property search, and global rename | Provide both views, typed scalar/list editing, property search, and a previewable transactional global rename. Inconsistent property types are shown as `Mixed`, not silently coerced |
| Bookmarks supports many item types | Support only surfaces that exist in mdx-vault: files, folders, searches, and headings. Graph, block, web-link, multi-selection, and multi-pane bookmark types remain deferred |
| Footnotes View lists footnotes and navigates to their edit position | Parse the active source, show definition/reference status, and reveal the exact source location in an editable note view |

---

## Current State

Treat every row as a baseline to re-check against the live worktree before implementation.

| Area | Current evidence and gap |
|---|---|
| Runtime | Electron + electron-vite, React 19, TypeScript, CodeMirror 6, unified/remark, SQLite FTS5, and bun |
| Workbench | GOAL-22 supplies path-deduplicated tabs, shared actions/keybindings, and one transactional open route. The center remains single-pane |
| Context panel | [RightPanel.tsx](../src/renderer/src/components/layout/RightPanel.tsx) has exactly three icon tabs: Outline, Tags, and Backlinks. It has no scalable overflow/switcher for additional utilities |
| Index model | [index-service.ts](../src/main/services/index-service.ts) returns title, aliases, headings, wikilinks, tags, components, searchable body, mtime, and content hash. Arbitrary frontmatter properties and footnote source positions are not indexed |
| SQLite | [db-service.ts](../src/main/services/db-service.ts) schema version 2 stores notes, aliases, headings, links, tags, components, and FTS. `note_links` supports reverse lookup, but there is no public outgoing-links query and no normalized property inventory |
| Frontmatter | `gray-matter` reads `title`, `aliases`, and `tags`; preview metadata can display frontmatter. There is no source-preserving property editor. Serializing the full object through `gray-matter` would risk changing comments, quoting, order, and unrelated YAML |
| Backlinks | [BacklinksPanel.tsx](../src/renderer/src/panels/BacklinksPanel.tsx) already demonstrates linked/unlinked sections, snippets, filtering, and navigation and should inform—not be copied into—Outgoing Links |
| Page Preview prototype | The dirty worktree contains `WikilinkPreview.tsx`, `useWikilinkPreview.ts`, `hover-preview-document.tsx`, section-aware wikilink parsing, and tests. It safely renders static Markdown, supports `[[Note#Heading]]`, and keeps internal preview scrolling open. It is currently wired primarily to Reading-view wikilinks, not the explorer/search/panels/editor surface matrix |
| Settings | [app-settings.ts](../src/shared/app-settings.ts) and [app-settings.ts](../src/main/services/app-settings.ts) are version 4 and include theme, file sort, default note view, editor font size, workbench behavior, and keymap overrides. There are no Page Preview settings |
| Bookmarks | No durable bookmark model, service, commands, or UI exists. SQLite under `.app/index.sqlite` is cache and must not become bookmark source of truth |
| Footnotes | GFM preview renders ordinary footnotes, but there is no active-note footnote inventory or reveal/edit interaction |
| Dirty worktree | There are extensive unrelated modified and untracked files, including the Page Preview prototype and GOAL-22 work. The executor must preserve them and must not assume an untracked file is disposable |

---

## Target State

### 1. Shared knowledge-utility shell

Extend the current right context panel without turning its header into an unreadable row of tiny icon buttons.

- Keep Outline, Tags, and Backlinks.
- Add Outgoing Links, Properties, Bookmarks, and Footnotes.
- Use an accessible panel switcher or a small visible-tab-plus-overflow pattern that scales to all seven destinations at 320 px width.
- Every destination has a stable action ID and can be opened from Command Palette and the panel switcher:
  - `panel.showOutline`
  - `panel.showTags`
  - `panel.showBacklinks`
  - `panel.showOutgoingLinks`
  - `panel.showProperties`
  - `panel.showBookmarks`
  - `panel.showFootnotes`
- The active-note panels update on tab activation without stale flashes. Bookmarks remains useful with no active note.
- Loading, empty, parse-error, missing-target, and unsupported-content states are explicit and keyboard-accessible.
- Reuse the shared action registry, keybinding resolver, workbench navigation coordinator, and overlay focus ownership. Do not add new document-level shortcut listeners.

### 2. Page Preview coverage

Promote the current wikilink-only prototype into one reusable Page Preview service and interaction contract.

#### Required surfaces

- Reading-view wikilinks and Markdown links to vault notes;
- source/live editor internal links, with `Ctrl` on Windows/Linux or `Cmd` on macOS held by default;
- File Explorer file rows;
- Search results;
- Backlinks rows;
- Outgoing Links rows and unlinked-mention targets;
- Bookmark rows for files and headings;
- property values that resolve to an internal link.

#### Required behavior

- Hovering or keyboard-focusing an eligible target opens one anchored preview after the existing bounded delay. Pointer travel from anchor to preview does not dismiss it.
- The preview is a bounded, independently scrollable window over the complete static note. It is not truncated to a teaser.
- `[[Note#Heading]]` and heading bookmarks land at the resolved heading. The target heading and all following content remain available by scrolling; nested headings are not mistaken for end-of-document.
- Same-note heading links work.
- Internal links inside a preview use the same navigation and preview intent model. Clicking the explicit open action routes through workbench `openOrActivate`.
- Preview rendering remains static and untrusted: no MDX `evaluate`, no vault custom component execution, no iframe permission escalation, no remote fetch. Unsupported dynamic islands receive an inert placeholder.
- One controller owns open/close timers, focus handoff, Escape dismissal, viewport collision, stale-load cancellation, and a bounded source/AST cache. Rapidly moving across targets cannot show a previous note under the new anchor.
- Existing size and query bounds remain enforced. Oversized or unreadable notes show a clear fallback with an Open action.

#### Settings

Extend App Settings with a versioned migration and searchable Editor/Page Preview rows:

- `pagePreview.enabled`, default `true`;
- `pagePreview.requireModifier`, default `false`.

When `requireModifier` is false, editor previews still require `Ctrl/Cmd` while Reading/navigation surfaces do not. When true, all pointer-hover previews require `Ctrl/Cmd`; keyboard focus remains accessible without requiring a held modifier. Disabling Page Preview removes hover/focus preview behavior without disabling normal navigation.

### 3. Outgoing Links

Add an active-note panel with two sections.

#### Links

- List every internal wikilink and vault-relative Markdown link in source order.
- Preserve target subpaths (`#Heading`) and show the display text, resolved title/path, and resolved/unresolved state.
- Duplicate note names or aliases show enough path context to disambiguate.
- Selecting a resolved row opens the target and reveals its heading through the existing workbench/navigation path.
- Hover/focus uses shared Page Preview.

#### Unlinked mentions

- Discover visible prose ranges in the active note that match another note's title or alias.
- Exclude YAML/frontmatter, fenced and inline code, existing links, raw HTML, MDX JSX/expressions, and the active note itself.
- Bound matching by source length, candidate count, result count, and execution time. Do not run an unbounded all-notes × all-text scan on every keystroke.
- Ambiguous title/alias matches show all candidates and require the user to choose one.
- "Link this mention" replaces exactly the verified source range with a wikilink using the current editor transaction. If the buffer changed after discovery, reject and recompute instead of patching stale offsets.
- Preserve selected display text. Do not autosave past a failed current-buffer save and do not write directly from renderer to filesystem.

### 4. Properties View and property search

#### Indexed property model

- Extend the note index and rebuildable SQLite cache with normalized top-level frontmatter properties.
- Represent property name, normalized name, inferred type, scalar/list values, emptiness, and source note. Supported types are text, list, number, checkbox, date, date-time, and tags.
- Show incompatible observed types as `Mixed`. Never coerce existing values during indexing.
- Nested maps, aliases/anchors, custom YAML tags, JSON-style frontmatter, or constructs that cannot be round-tripped safely are indexed as read-only/unsupported with a visible explanation.
- Add property search syntax:
  - `[property]` — property exists;
  - `[property:value]` — a scalar or list member matches;
  - `[property:null]` — property exists and is empty.
- Property filters compose with the existing free-text, tag, path, file, and regex filters and retain current query/result bounds.

#### File Properties view

- Show top-level properties for the active note with suitable controls for supported types.
- Add, edit, and delete one property at a time; edit scalar/list values without rewriting the note body.
- Internal-link text/list values navigate and preview using the shared link contract.
- Unsupported structures are readable but not editable from the form; offer Source view navigation instead.
- Add a registered `property.add` action. If no note is active or editable, it is disabled with a reason.

#### All Properties view

- List property names, inferred type, and use count across the vault.
- Sort by name or frequency and filter by property name.
- Selecting a property opens Search with `[property]`.
- Global rename is a previewable transaction:
  - show affected files and collisions before applying;
  - reject empty/invalid names and collisions where the destination key already exists in a note;
  - rewrite only the exact top-level YAML key tokens;
  - keep a rollback snapshot and restore byte-identical sources if any write/reindex step fails;
  - refresh Search, properties, tags/aliases/title semantics, and open buffers only after commit.

#### Source preservation

- Notes remain source of truth. Property edits must preserve the note body byte-for-byte and preserve unrelated frontmatter keys, comments, order, scalar styles, and quoting.
- Do not implement property editing by `gray-matter.stringify()` or by serializing a plain JavaScript object back over the whole frontmatter block.
- First evaluate whether the existing parser stack can expose safe ranges/CST nodes. If it cannot, this goal permits **one** direct dependency, `yaml`, installed with `bun add yaml`, after verifying license, Electron compatibility, and that its CST/document API proves comment/style preservation in tests. No other dependency is authorized by this goal.
- Every write is atomic in main process, zod-validated, vault-relative, and guarded by the expected content hash. An open dirty buffer is updated through the workbench/editor transaction, never overwritten behind the user.

### 5. Bookmarks

Implement a versioned, vault-scoped bookmark model whose source of truth is `.app/bookmarks.json` alongside—but independent of—the rebuildable SQLite index.

```ts
type BookmarkTarget =
  | { kind: 'file'; relativePath: string }
  | { kind: 'folder'; relativePath: string }
  | { kind: 'search'; query: string }
  | { kind: 'heading'; relativePath: string; heading: string }

interface BookmarkItem {
  id: string
  title: string | null
  target: BookmarkTarget
}

interface BookmarkGroup {
  id: string
  title: string
  children: Array<BookmarkGroup | BookmarkItem>
}
```

The exact serialized shape may differ, but the behavior is mandatory:

- Add/edit/remove a bookmark; create/rename/remove groups; expand/collapse groups; drag or keyboard-reorder within and across groups.
- Bookmark the active file, an explorer file/folder, the current search query, and an outline/current-note heading.
- Open file/heading bookmarks through `openOrActivate`, folder bookmarks by revealing the folder in Explorer, and search bookmarks by opening Search with the saved query.
- File/heading bookmark hover/focus uses Page Preview.
- Missing targets remain visible and recoverable instead of being silently deleted.
- File/folder rename updates affected bookmark targets as part of the mutation plan. Failure cannot leave a half-rewritten bookmark file or corrupt the renamed note.
- `.app/bookmarks.json` is excluded from the note tree, content index, export, and watcher loops.
- Main process owns reads/writes, uses a versioned zod schema, writes atomically, and exposes only a narrow typed preload API. Renderer never receives the absolute vault path.

### 6. Footnotes View

- Parse the active note source into a bounded, source-positioned footnote model.
- List footnote definitions in source order with identifier, a short plain-text preview, reference count, and status for unreferenced references or missing definitions.
- Support standard named footnotes (`[^id]` plus `[^id]: definition`) and whatever inline-footnote syntax is already accepted by the app's Markdown pipeline; do not claim unsupported syntax.
- Selecting a definition or reference switches the active note to an editable view if needed, reveals the exact source range, and places editor selection/focus there.
- Repeated references navigate deterministically and expose next/previous reference actions.
- Parse failures, oversized notes, unsupported plain-text/image tabs, and no-footnote states are explicit.
- Footnote extraction is a shared pure parser utility with unit tests. Do not add a second Markdown grammar or use regex as the sole parser for nested/multiline definitions.

### 7. Architecture, state, and documentation integration

- Use a single active-note knowledge controller or a small set of focused query hooks; do not put all data loading and mutation logic back into `App.tsx`.
- Every new IPC channel follows `domain:action`, validates both request and response shapes with zod where the existing bridge convention supports it, validates the sender frame, and converts main errors to path-safe renderer errors.
- SQLite property data is cache: migration/rebuild can recreate it from `.mdx` files. Bookmarks are durable user data and must survive an index rebuild.
- Update the official parity research rows and `docs/roadmap.md` only after verified implementation. Record deliberate divergences from Obsidian rather than labeling them full parity.
- Add focused unit/component tests and a small example-vault fixture set for properties, outgoing links, ambiguous aliases, section previews, bookmarks, and footnotes.

---

## Constraints

These are mandatory. If a constraint conflicts with the Execution Plan, follow the constraint.

- [x] Preserve the local-first invariant: `.mdx` files are source of truth; SQLite remains disposable index/cache; `.app/bookmarks.json` is durable app metadata, not note content.
- [x] Preserve Electron hardening: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and no raw `fs`, `path`, `ipcRenderer`, or absolute vault path exposed to renderer.
- [x] Page Preview must never evaluate MDX or run Level 2–4 components. It renders a static, sanitized representation only.
- [x] All renderer-originated paths are vault-relative, zod-validated, and resolved in main through the existing safe path/service boundary.
- [x] All note and bookmark writes are atomic. Multi-file property rename has preview, collision detection, expected hashes, rollback, and post-commit reindex.
- [x] Property editing must be source-preserving. Do not replace the whole frontmatter via object serialization.
- [x] Do not mutate a stale or dirty editor buffer from a background query. Revalidate content hash/source range and use the existing editor/workbench transaction.
- [x] Do not create a generic plugin API, marketplace, community-plugin loader, or arbitrary plugin execution path.
- [x] Only the conditionally authorized `yaml` dependency may be added, and only if the existing parser cannot meet the source-preservation tests. Use bun for dependency work.
- [x] Keep all scanning and parsing bounded. Add explicit maximum source size, candidate count, result count, and cache size for preview, unlinked mentions, properties, and footnotes.
- [x] Preserve existing search, backlinks, rename, tabs, settings, default Reading view, export, sandbox, and AI approval behavior.
- [x] Preserve unrelated modified/untracked work. Do not reset, rewrite, stage, or commit user changes outside this goal.
- [x] After every meaningful implementation phase, run focused tests plus `bun run typecheck` and `bun run lint`, as required by `AGENTS.md`.
- [x] If a new product decision would change a security boundary, durable storage contract, or destructive mutation behavior, stop and ask instead of silently weakening this goal.

---

## Success Criteria

Completion requires evidence from tests and the running Electron app. Do not mark a criterion complete from code inspection alone when it describes interaction behavior.

| # | Criterion | Required verification | Expected evidence |
|---:|---|---|---|
| 1 | Context panel scales to all seven destinations and actions route through the shared registry | Component/action tests plus keyboard and pointer check in `bun run dev` | Every destination is reachable at 320 px; focus/ARIA state is coherent; no background shortcut acts through an overlay |
| 2 | Page Preview works on every required surface | Fixture-driven component tests and manual matrix: Reading, editor modifier-hover, Explorer, Search, Backlinks, Outgoing, Bookmarks, property link | Correct note appears under the correct anchor; focus and pointer both work; normal click navigation still works |
| 3 | Full-note and section preview behavior is correct | Preview parser/position tests using a long note with nested headings plus `[[Note#Section]]` and a same-note heading link | Target heading is revealed; preview remains independently scrollable through later content; internal preview scroll does not dismiss |
| 4 | Preview is safe and race-free | Tests for rapid target changes, oversized source, stale request, unsupported MDX/JSX, and disabled/require-modifier settings; inspect changed renderer code | No `evaluate`, `eval`, `Function`, custom island execution, remote fetch, stale content, or unbounded cache |
| 5 | Outgoing Links lists explicit links accurately | Index/DB/IPC tests plus active-note panel fixture | Wikilinks and Markdown note links appear in source order with section, display text, resolved path, and unresolved state |
| 6 | Unlinked mentions are safe and linkable | Pure parser/matcher tests covering YAML, code, JSX, existing links, ambiguity, Unicode boundaries, stale offsets, and current-buffer edit | Only prose candidates appear; ambiguous matches require choice; one action patches exactly one verified range |
| 7 | Property inventory and search work | Index migration/query tests for `[property]`, `[property:value]`, `[property:null]` composed with existing filters | Counts/types are correct after rebuild; `Mixed` is visible; property filters do not regress current search |
| 8 | Active-file property edits preserve source | Golden byte fixtures with comments, quotes, lists, CRLF/LF, body content, unsupported nested YAML, stale hash, and failed write | Only intended YAML spans change; body and unrelated frontmatter are byte-identical; unsupported values remain read-only |
| 9 | Global property rename is transactional | Multi-file service tests with collisions and an injected mid-write/reindex failure | Preview identifies every file/collision; success rewrites exact keys; failure restores byte-identical originals |
| 10 | Bookmarks persist and remain coherent | Service/schema tests, app restart, index rebuild, rename/delete fixture, corrupt bookmark JSON | Groups/order survive restart and index deletion; renamed paths update; missing targets remain visible; corrupt storage fails safely without overwriting |
| 11 | Bookmark interactions cover supported targets | Manual checks from active tab, Explorer file/folder, Search query, and Outline heading; drag and keyboard reorder | Every supported type can be added/opened/edited/removed and reordered; preview works for note/heading targets |
| 12 | Footnotes navigate to exact editable source positions | Parser tests for multiline definitions, repeated/missing/unreferenced definitions, and manual editor reveal | Panel status/counts are correct; selection lands on requested definition/reference; next/previous is deterministic |
| 13 | Settings migrate and behave | App-settings v4→next-version tests, corrupt/unknown-value tests, restart check | Page Preview defaults on; disable and modifier modes persist and take effect immediately without leaking unknown fields |
| 14 | Security and filesystem boundaries remain intact | Review changed main/preload code and run `rg -n "nodeIntegration|contextIsolation|sandbox|ipcRenderer|\\beval\\b|Function\\(" src` | No new raw bridge, path leak, hardening regression, or dynamic preview execution |
| 15 | Whole repository remains healthy | `bun test`, `bun run typecheck`, `bun run lint`; run `bun run build` if implementation changes packaging/dependencies | Every required command exits 0; any pre-existing unrelated warning is identified rather than hidden |
| 16 | Documentation matches delivered behavior | Review `docs/roadmap.md`, both Obsidian parity audits, and `goals/README.md` in the implementation commit | Statuses describe verified behavior and explicit divergences; deferred plugins are not falsely marked complete |

### Completion evidence — 2026-07-23

- [x] Criteria 1–4: component/parser/settings tests plus Electron checks at 320 px
  covered all required Page Preview surfaces, editor modifier behavior, keyboard
  focus, nested headings, full-note scrolling, static island placeholders, and
  persisted enable/modifier settings.
- [x] Criteria 5–9: outgoing/index migration, source-model, golden
  source-preservation, property search, collision, and injected rollback tests
  passed; the Electron v2→v3 SQLite harness passed under Electron's native ABI.
- [x] Criteria 10–13: bookmark schema/corruption/revision/rename tests and Electron
  restart checks preserved groups/order; active note, Explorer file/folder, Search,
  and Outline heading entry points, edit/remove, keyboard reorder, cross-group
  drag, Page Preview, in-app folder reveal, and exact repeated-footnote traversal
  were exercised in the running app.
- [x] Criteria 14–16: the security scan confirmed the existing hardened
  BrowserWindow and narrow preload bridges; focused tests, the full suite,
  typecheck, lint, production build, roadmap, parity audits, and goal index were
  reviewed. The production build retains pre-existing Vite dynamic/static import
  warnings and a `gray-matter` dependency warning; GOAL-23's static preview path
  contains no dynamic evaluation or network fetch.

### Manual fixture matrix

Create or reuse minimal fixtures under `example-vault/`:

- a long target note with duplicate/nested heading names, content after the target section, static HTML, and a blocked dynamic island;
- two notes sharing a title/alias for ambiguity;
- an outgoing-links source containing wikilinks, Markdown links, plain mentions, YAML, code, inline code, JSX, unresolved links, and `#Heading` targets;
- properties covering every supported type, comments/quotes/order, empty values, lists, mixed types, and unsupported nested YAML;
- footnotes with multiline definitions, repeated references, missing definitions, and unreferenced definitions; and
- bookmarks for a file, folder, saved search, and heading, including a target that is later renamed and one that is deleted.

---

## Execution Plan

1. **Re-audit the live baseline**
   - Read all required project documents and the official references.
   - Inspect the dirty Page Preview prototype, current workbench/action contracts, index/DB migration path, Settings v4, editor source-position APIs, rename plan, File Explorer/Search/Backlinks/Outline surfaces, and `.app` exclusions.
   - Run baseline focused tests, `bun run typecheck`, and `bun run lint`. Record pre-existing failures without changing unrelated files.

2. **Write domain contracts and red tests first**
   - Define shared types for preview targets, outgoing links/mentions, indexed properties, bookmark manifests, and footnote positions.
   - Add bounds and invariants at the contract layer.
   - Add red tests for source preservation, stale range rejection, bookmark durability, preview races, and DB migration before UI work.

3. **Harden and generalize Page Preview**
   - Extract a reusable target/intent adapter from the wikilink-specific prototype.
   - Implement cache/race/focus/modifier/settings behavior and static-render safety.
   - Wire Reading and editor surfaces first; verify before expanding to navigation rows.

4. **Extend the index and queries**
   - Add a forward SQLite migration for normalized properties and the outgoing-links query.
   - Extend indexing and property search while keeping SQLite fully rebuildable.
   - Add bounded active-source parsers for unlinked mentions and footnotes.

5. **Implement source-preserving property mutations**
   - Prove the existing parser can preserve exact source or add the single authorized `yaml` dependency.
   - Implement single-note add/edit/delete and expected-hash protections.
   - Implement global property-rename planning, preview, collision detection, atomic writes, rollback, and reindex.

6. **Implement bookmark persistence**
   - Add the versioned `.app/bookmarks.json` service, zod IPC/preload bridge, atomic mutation queue, corruption handling, and index/tree/export exclusions.
   - Integrate file/folder rename and missing-target behavior.

7. **Build the knowledge-utility UI**
   - Refactor the context-panel selector for seven destinations.
   - Build Outgoing Links, Properties, Bookmarks, and Footnotes panels with shared state/error/empty components where that improves clarity.
   - Register stable actions and Page Preview adapters. Keep feature logic out of `App.tsx`.

8. **Add supported entry points**
   - Add bookmark actions to the active note, File Explorer, Search, and Outline.
   - Add property-add and panel-show actions.
   - Add Page Preview settings through the existing searchable Settings catalog and migrate persistence.

9. **Interaction and regression verification**
   - Run the manual fixture matrix in Electron on Windows 11.
   - Verify keyboard focus, modifier keys, context menus, scroll containment, workbench navigation, dirty buffers, failed saves, rename rollback, and restart persistence.
   - Run focused tests, full tests, typecheck, lint, and build when required.

10. **Update evidence and commit selectively**
    - Update parity research, roadmap, and the GOAL-23 row in `goals/README.md` only to match verified behavior.
    - Mark Success Criteria only with evidence.
    - Preserve unrelated dirty files, stage selectively, and create a conventional commit.

---

## Out of Scope

- Community plugin installation, marketplace, runtime plugin APIs, plugin manifests, arbitrary third-party code, or generic core-plugin enable/disable infrastructure.
- Graph View or local graph. It remains a standalone roadmap goal because it introduces a graph layout/rendering surface and graph-specific filtering.
- Bases/query views, `.base` syntax, formulas, table/cards/map views, or bulk property editing beyond exact global property-key rename.
- Canvas, Audio Recorder, Slides, Format Converter/Importer, Web Viewer, Sync, Publish hosting, or external collaboration.
- File Recovery snapshots. It requires an outside-vault retention store, restore/diff UX, quotas, and a separate data-loss threat model.
- Note Composer merge/extract. It is destructive multi-note content movement and deserves a separate transactional goal.
- Full Workspaces save/load/delete, cross-restart tab/session restore, split panes, or multi-window layouts.
- Bookmarks for graphs, blocks, external/web links, multiple selected files, or tab groups.
- Nested-property editing, arbitrary YAML tags, YAML anchors/aliases, JSON-frontmatter normalization, Markdown rendering inside properties, or silent type coercion.
- Full Obsidian Search grammar such as boolean grouping, line/block/section/task operators, comparison expressions, or embedded query blocks. This goal adds only the property filters explicitly listed.
- Previewing external URLs or executing trusted/untrusted interactive islands inside hover previews.
- Redesigning the application or copying Obsidian's visuals. [DESIGN.md](../DESIGN.md) remains authoritative.

---

## References

### Repository

- [Product vision](../docs/product-vision.md)
- [Architecture](../docs/architecture.md)
- [Security model](../docs/security.md)
- [Roadmap](../docs/roadmap.md)
- [Obsidian Core Plugins parity audit](../docs/research/obsidian-core-plugins-parity-2026-07.md)
- [Obsidian interaction behavior audit](../docs/research/obsidian-interaction-behaviors-2026-07.md)
- [Index service](../src/main/services/index-service.ts)
- [Database service](../src/main/services/db-service.ts)
- [Right context panel](../src/renderer/src/components/layout/RightPanel.tsx)
- [Backlinks panel](../src/renderer/src/panels/BacklinksPanel.tsx)
- [Settings catalog](../src/shared/app-settings.ts)
- [Wikilink preview](../src/renderer/src/preview/WikilinkPreview.tsx)
- [Safe hover-preview document](../src/renderer/src/preview/hover-preview-document.tsx)
- [Hover-preview controller](../src/renderer/src/preview/useWikilinkPreview.ts)

### Official Obsidian documentation

- [Core Plugins catalog](https://obsidian.md/help/plugins)
- [Page Preview](https://obsidian.md/help/plugins/page-preview)
- [Outgoing Links](https://obsidian.md/help/plugins/outgoing-links)
- [Properties View](https://obsidian.md/help/Plugins/Properties%2Bview)
- [Properties and property types](https://obsidian.md/help/properties)
- [Search, including property filters](https://obsidian.md/help/plugins/search)
- [Bookmarks](https://obsidian.md/help/plugins/bookmarks)
- [Footnotes View](https://obsidian.md/help/plugins/footnotes)
- [Backlinks](https://obsidian.md/help/plugins/backlinks)
- [File Recovery](https://obsidian.md/help/plugins/file-recovery)
- [Note Composer](https://obsidian.md/help/plugins/note-composer)
- [Graph View](https://obsidian.md/help/Plugins/Graph%2Bview)
- [Bases](https://obsidian.md/help/bases)
- [Workspaces](https://obsidian.md/help/plugins/workspaces)

---

## Agent Instructions

1. Read this entire goal and every required project document before editing.
2. Re-check all Current State claims against the live worktree. Goal-author memory is evidence to inspect, not truth to trust.
3. Follow Constraints over the Execution Plan if they conflict.
4. Do not shrink completion to "four new panel icons" or to the easiest subset. Data integrity, source preservation, complete Page Preview surface coverage, and the required evidence are part of the feature.
5. Do not expand into the rest of Obsidian's catalog. Every Out of Scope item remains deferred even if adjacent code makes it tempting.
6. Treat uncertainty as a prompt to inspect code, tests, the running app, or the cited official documentation—not as a reason to stop early.
7. Make safe local implementation decisions within the explicit contracts. Ask only when a new choice would materially change security, durable storage, or destructive mutation semantics.
8. Use `rg` first and `ast-grep outline` before reading large unfamiliar files, as required by `AGENTS.md`.
9. Use `apply_patch` for manual edits. Never revert unrelated user work.
10. After each meaningful phase, run focused tests, `bun run typecheck`, and `bun run lint`.
11. At completion, verify every Success Criterion, update only evidence-backed checkboxes/docs, stage selectively, and create a conventional commit.
