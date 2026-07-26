# GOAL-24 — Global and Local Graph View

> File created by the `create-goal` skill.
> Executing agent: read this entire file before doing anything.
> Also read and follow [AGENTS.md](../AGENTS.md), [goals/README.md](README.md),
> [docs/product-vision.md](../docs/product-vision.md),
> [docs/architecture.md](../docs/architecture.md),
> [docs/security.md](../docs/security.md), [DESIGN.md](../DESIGN.md), and the
> parity audits under `docs/research/`.

---

## Objective

Ship a first-party, local-only Global Graph and Local Graph that turn the
existing indexed note/link model into an interactive, accessible, bounded
knowledge-navigation surface without weakening the filesystem, workbench,
Electron, or rendering security boundaries.

The Global Graph is a deduplicated virtual workbench item. The Local Graph is
an active-note context utility. Both use the same graph model and renderer,
open resolved notes through the existing transactional workbench, update after
index changes, and expose honest partial-parity settings for note nodes,
unresolved targets, orphans, query groups, display, layout forces, and local
depth.

---

## Context

- **Reason**: Graph View is named as an Obsidian invariant in
  [product-vision.md](../docs/product-vision.md), remains an explicit missing
  core feature in
  [obsidian-core-plugins-parity-2026-07.md](../docs/research/obsidian-core-plugins-parity-2026-07.md),
  and was intentionally deferred from GOAL-23 because it introduces a graph
  layout surface, graph-specific filtering, and a non-file workbench item.
- **Footnotes are already delivered**: GOAL-23 added a source-positioned
  Footnotes panel with repeated, missing, multiline, and unreferenced footnote
  handling. `bun test tests/knowledge-source-model.test.ts
  tests/knowledge-panel-selector.test.tsx` passed 14 tests on 2026-07-24,
  including exact repeated-reference ranges. Do not reimplement Footnotes in
  this goal.
- **Priority**: correctness, data integrity, and navigation reliability before
  visual density or animation.
- **Created**: 2026-07-24.
- **Depends on**:
  - GOAL-02/13 — SQLite note/link index, search grammar, tags, aliases, and
    backlinks;
  - GOAL-15/18 — transactional path mutation and source-aware navigation;
  - GOAL-20/22 — Settings v5, shared actions/keybindings, typed workbench
    transactions, tabs, and focus ownership;
  - GOAL-23 — knowledge-panel selector, Page Preview infrastructure,
    bookmarks, properties, and the current schema-v3 link index.
- **Official behavior reference**: Obsidian's Graph View documents global and
  local scopes, hover adjacency, click-to-open, context menus, pan/zoom,
  search filtering, unresolved/existing-only filtering, orphans, query groups,
  arrows, label fading, node/link sizing, layout forces, and local depth.
- **Renderer research**: Cytoscape.js 3.34.0 is an MIT-licensed ESM package
  with bundled TypeScript declarations and no runtime dependencies. Its core
  supports canvas rendering, pan/zoom, dragging, events, headless tests, a
  built-in CoSE force layout, explicit layout stop, and instance destruction.
  This goal conditionally authorizes that one production dependency after the
  execution spike in Phase 1 proves Electron/Vite compatibility and acceptable
  bundle isolation. Do not add a React wrapper or layout extension.

---

## Current State

Treat every row as a baseline to re-check against the live worktree. The
worktree was already dirty when this goal was created; committed documentation
is not evidence that uncommitted files are disposable.

| Area | Current evidence and gap |
|---|---|
| Runtime | Electron 39, React 19, TypeScript 5.9, electron-vite 5, Tailwind CSS v4, Bun, and SQLite via `better-sqlite3` |
| Note topology | `src/main/services/index-service.ts` extracts wikilinks and vault-relative Markdown links with source ranges |
| SQLite | Schema version 3 stores notes, aliases, links, tags, headings, components, and properties. `note_links` is source-oriented and indexed by normalized target, but there is no single bounded graph-snapshot query |
| Link resolution | Outgoing Links can return zero, one, or multiple resolved note candidates. A graph must not silently turn an ambiguous alias into a false edge |
| Search | `DbService.search()` implements bounded free text, tag, path, file, regex, and property filters, but its result limit and snippets are not a reusable graph-membership API |
| Index refresh | `indexApi.onDidChange()` exists and the renderer already maintains an index revision. There is no stale-safe graph query controller |
| Workbench | `WorkbenchItem` assumes every item has a canonical vault-relative path and supports only `note`, `text`, `image`, and `unsupported`. A graph cannot be represented safely by a fake path |
| Tabs | Tab presentation and context menus assume file actions such as Copy Path and Reveal in Explorer are always available |
| Main document | `MainEditor.tsx` branches on the selected filesystem path and has no virtual-item surface |
| Context panel | `RightPanel.tsx` has seven destinations through a scalable native selector. There is no Local Graph destination |
| Actions | The shared registry has panel actions through `panel.showFootnotes`; there are no graph actions or graph focus context |
| Settings | App Settings snapshot version 5 has global theme/editor/workbench/Page Preview/keymap settings. It has no vault-scoped graph configuration |
| Durable vault metadata | `.app/bookmarks.json` demonstrates versioned zod validation and atomic writes. `.app` is hidden from tree, index, export, and watcher loops |
| Graph dependency | No general graph-rendering package is installed. Recharts and Mermaid do not provide the required knowledge-graph interaction model |
| Design | The application uses an editorial paper/ink visual grammar, responsive panes, hard borders, and reduced-motion requirements |
| UX evidence | No baseline `ui-map`, independent audit, semantic review, or route ledger exists for the new Graph surfaces |

---

## Target State

### 1. Product boundary and parity claim

Deliver a **notes-only Graph View** with two scopes:

- **Global Graph**: every indexed Markdown/MDX note allowed by the active
  graph filters, plus optional unresolved/ambiguous target nodes connected to
  visible notes.
- **Local Graph**: the active note as root plus incoming and outgoing
  neighbors up to a bounded depth.

This goal provides substantial Graph View parity for note relationships. It
does **not** claim tag-node parity, attachment-node parity, excluded-file
settings, or chronological time-lapse animation. Those remain explicit future
work because the current index does not model attachment metadata or creation
time and because tag nodes change the topology from note-to-note links.

### 2. Shared graph model

Define shared, JSON-serializable graph types and zod schemas. Exact names may
change, but the semantics are mandatory:

```ts
type GraphScope =
  | { kind: 'global' }
  | { kind: 'local'; rootRelativePath: string; depth: 1 | 2 | 3 | 4 }

type GraphNodeStatus = 'resolved' | 'unresolved' | 'ambiguous'

interface GraphNode {
  id: string
  status: GraphNodeStatus
  relativePath: string | null
  title: string
  candidatePaths: string[]
  incomingCount: number
  outgoingCount: number
  degree: number
  orphan: boolean
  groupIds: string[]
}

interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  occurrenceCount: number
}

interface GraphSnapshot {
  revision: string
  scope: GraphScope
  nodes: GraphNode[]
  edges: GraphEdge[]
  totals: { nodes: number; edges: number }
  truncated: boolean
  truncationReason: string | null
}
```

- Stable note node IDs derive from canonical vault-relative paths without
  exposing absolute paths.
- Stable ghost IDs derive from normalized unresolved/ambiguous link targets.
- Multiple authored links from one source note to the same resolved target are
  collapsed into one directed edge with `occurrenceCount`. Self-links remain
  valid.
- A target becomes a resolved edge only when the existing resolver identifies
  one canonical note. Ambiguous aliases create an `ambiguous` ghost node with
  candidate paths; they never fan out into invented note edges.
- Unresolved target labels come from authored link targets, are display-only,
  and never become filesystem paths without passing through the existing
  resolver.
- Node degree and incoming/outgoing counts are calculated from the returned
  collapsed topology, not from an unfiltered graph that the user cannot see.
- All graph model, local breadth-first traversal, grouping priority, collapse,
  and truncation behavior lives in pure tested functions. Cytoscape-specific
  objects never cross the preload bridge or enter shared domain types.

### 3. Bounded graph query and filter semantics

Add one graph-domain query path in main process; do not fetch every note and
then issue one renderer IPC call per note.

- Add a narrow `graph:get-snapshot` channel or an equivalently named
  `domain:action` channel.
- Validate the sender is the main frame and validate request and response
  schemas.
- Query notes and links in bounded bulk from the rebuildable SQLite index.
- Reuse or factor the existing search grammar for graph membership. Do not
  create a second syntax that merely resembles Search.
- Global `Search files` accepts the same free-text, tag, path, file, regex, and
  property filters supported by the current Search surface.
- Group queries use the same matcher. At most eight groups are evaluated per
  request. The first matching group in explicit UI order owns the primary
  visual encoding; all matched group IDs remain available in node details.
- `Existing files only` hides unresolved and ambiguous ghost nodes.
- `Orphans` controls existing resolved notes with zero visible degree.
- Filtering never leaves dangling edges.
- Local traversal includes both incoming and outgoing edges, deduplicates nodes
  at each depth, and stops at depth 1–4, the node cap, or the edge cap.
- Local query filtering never removes the root. If the root no longer exists,
  return an explicit missing-root state instead of an empty successful graph.
- Initial safety bounds are `[estimate]` 2,500 returned nodes, 10,000 returned
  edges, 300 query characters, eight groups, and local depth four. Phase 1 must
  benchmark and may lower these values when evidence shows the UI cannot stay
  responsive. It may not raise them without matching query and renderer
  evidence.
- Truncation is deterministic, keeps the local root when applicable, and is
  visible in the UI with returned/total counts. Never silently truncate.
- Index rebuild, note create/delete/rename, and link edits invalidate graph
  snapshots. Rapid invalidations and filter changes must use request tokens or
  abortable ownership so stale results cannot replace a newer scope or vault.

### 4. Global Graph as a virtual workbench item

Introduce a typed virtual workbench item rather than a path sentinel.

```ts
type WorkbenchItem =
  | FileWorkbenchItem
  | {
      id: 'virtual:graph:global'
      kind: 'graph'
      resource: { kind: 'global-graph' }
      dirty: false
      missing: false
      autosavePaused: false
      viewState?: GraphWorkbenchViewState
    }
```

The exact union may differ, but all behavior below is required:

- File items retain their canonical `relativePath`; virtual graph items do not
  pretend to be files and cannot reach `vaultApi.read*`, save, rename, trash,
  copy-path, or reveal-in-explorer code paths.
- Register stable actions:
  - `graph.open-global` — open or activate the one global graph item;
  - `graph.fit-view` — fit visible graph content when a graph surface owns
    focus;
  - `graph.toggle-settings` — open/close graph settings when a graph surface
    owns focus.
- `graph.open-global` is available from Command Palette and the app menu/action
  dispatch path when a vault is open.
- Repeated dispatch deduplicates to one graph tab and preserves normal visual
  tab order and MRU semantics.
- Close, close others/right/all, reopen closed, keyboard tab navigation, MRU
  switching, and focus restoration work for the graph item.
- File-only tab context actions are absent or explicitly disabled for the graph
  tab; they never receive `undefined`, a virtual ID, or a fabricated path.
- Activating the graph commits the workbench transaction without reading a
  file. Leaving a dirty note for the graph follows the existing save/close
  policy; a failed save blocks the transition.
- Activating a graph sets active-note selectors to no active note without
  discarding the prior note buffer. Opening a graph node uses the existing
  `openOrActivate(relativePath)` path and leaves the graph tab available.
- Vault switch clears the graph item with the current workbench session and
  cannot show topology or configuration from the previous vault.
- Graph view state may preserve zoom, pan, selected node, and settings-sheet
  visibility for the current vault session only. It is not a dirty file buffer.

### 5. Local Graph as a context utility

- Add `local-graph` to `KnowledgePanelId` and the scalable Right Panel selector.
- Register `panel.showLocalGraph` through the shared action/keybinding registry.
- The action opens the right panel, selects Local Graph, and is enabled only
  for an active editable note item.
- The Local Graph follows the active note and uses the same graph model,
  renderer, styles, settings primitives, empty/error/truncation language, and
  node actions as the Global Graph.
- A depth control from 1 to 4 is visible in the Local Graph header/settings.
  Changing it issues one stale-safe query.
- At the narrow 320 px panel width, the graph remains usable: labels may reduce
  according to threshold, controls remain reachable, and no horizontal page
  overflow appears.
- With no active note, an image/text/unsupported/graph item, a missing note, or
  an index error, Local Graph shows a specific stable-geometry state rather
  than stale nodes from the previous note.

### 6. Shared Graph surface and visual design

Build one imperative graph renderer adapter behind React components:

- `GraphSurface` owns semantic state and React controls.
- A small Cytoscape adapter owns the canvas instance, layout, element
  synchronization, hit events, viewport operations, resize, and cleanup.
- Global and Local surfaces provide configuration through props; they do not
  fork separate renderers.
- The Cytoscape module and graph workbench chunk load only when a graph surface
  is activated. The normal editor/reading startup bundle must not eagerly
  include Cytoscape.
- Use the built-in `cose` layout only. Map the product's bounded center,
  repulsion, link strength, and link distance controls to supported CoSE
  options. Do not add layout extensions in this goal.
- Degree controls node size. Directed arrows, label fade threshold, base node
  size, and link thickness are user-configurable.
- Node and edge styles use simple circles and straight lines for performance.
  Hover/selection emphasizes the focused node and its immediate connections
  while muting unrelated elements.
- The active note, selected node, unresolved node, ambiguous node, orphan, and
  group encodings are visually distinct in light and dark themes.
- Graph group colors are a visualization-only exception to the app's semantic
  red/blue palette. Use a small theme-aware categorical palette and redundant
  shape/stroke/legend cues so color is not the only signal.
- Preserve the editorial visual system: flat paper surfaces, ink structure,
  sharp corners, mono metadata labels, no gradients, no glass, no remote fonts,
  and no decorative blur.
- Loading, no-vault, no-active-note, no-links, filter-empty, missing-root,
  truncated, query-error, renderer-load-error, and corrupt-config states have
  deliberate copy and stable layout.

### 7. Interaction and accessibility contract

- Pointer:
  - hover highlights a node and its adjacent edges/nodes;
  - click selects a node;
  - double click or an explicit Open action opens a resolved note;
  - dragging moves a node for the current session;
  - background drag pans;
  - wheel/pinch zoom is bounded;
  - right click opens the existing accessible context-menu grammar.
- Resolved-node context actions reuse existing ports: Open, Bookmark note,
  Copy relative path, and Reveal in Explorer. Ambiguous nodes expose candidate
  paths and require a choice. Unresolved nodes offer no destructive or fake
  path action.
- Toolbar actions include Fit view, Reset layout, node search, filters/settings,
  and a visible returned/total summary. Do not present several primary-looking
  actions.
- Keyboard:
  - the canvas container is focusable and has a clear accessible name and
    instructions;
  - `+`/`-` zoom, arrow keys pan, and `Shift` accelerates panning;
  - Fit view and Settings use registered commands when graph focus is active;
  - a DOM-backed searchable node navigator/listbox lets keyboard and screen
    reader users find, select, inspect, and open any returned resolved node;
  - Enter opens the selected resolved node; Escape clears node selection or
    closes the top graph-owned surface;
  - focus returns to the invoking control after the settings sheet or node
    context menu closes.
- Canvas pixels are not treated as an accessibility tree. Selection details,
  counts, status, path, degree, groups, and candidate ambiguity are mirrored in
  semantic DOM and announced without flooding `aria-live` during layout ticks.
- Tooltips are supplemental; no essential information or action is hover-only.
- Respect `prefers-reduced-motion`. Layout and filtering must remain complete
  with animation disabled, and graph motion must stop when the surface is
  hidden or unmounted.
- Pointer and keyboard interaction must not install a second document-level
  shortcut system or steal editor/browser-owned chords.

### 8. Vault-scoped configuration

Persist graph preferences as versioned durable app metadata in
`.app/graph-view.json`, separate from the disposable SQLite index and from
global device settings.

```ts
interface GraphViewManifest {
  version: 1
  revision: number
  global: GraphViewSettings
  local: GraphViewSettings & { depth: 1 | 2 | 3 | 4 }
  groups: GraphGroup[]
}
```

- Main process owns reads/writes and serializes writes through an atomic queue.
- Use a narrow `graph:get-config` / `graph:save-config` bridge or equivalent
  domain-action channels with shared zod schemas, bounded strings/arrays/numbers,
  main-frame sender validation, and optimistic revision conflict checks.
- Renderer never receives the absolute vault root.
- The file is excluded from note tree, indexing, export, search, and watcher
  loops by the existing `.app` boundary.
- A missing file produces defaults. A corrupt or unsupported-version file is
  preserved byte-for-byte, graph rendering falls back safely to defaults, and
  the UI reports the recovery path as `.app/graph-view.json` without exposing
  the absolute vault path.
- Configuration includes:
  - global/local search query;
  - existing-only and orphan toggles;
  - arrows, label fade, node size, and link thickness;
  - center force, repel force, link force, and link distance;
  - local depth;
  - up to eight ordered groups with ID, label, query, and bounded visual token.
- Search input may be transient while typing, but only validated/debounced
  configuration is persisted. Failed saves reconcile to the last persisted
  manifest and show an error.
- Viewport pan/zoom and dragged node positions are session state, not durable
  vault metadata in this goal.

### 9. Dependency, lifecycle, and performance gates

- Phase 1 may add exactly `cytoscape@^3.34.0` with `bun add cytoscape` after
  verifying the current published package still has an MIT license, built-in
  types, an ESM export, and no runtime dependencies. Record the verified
  version in the completion report.
- Do not install a React binding, layout extension, D3 bundle, Pixi, Three.js,
  or WebGL framework.
- Keep the renderer adapter imperative and isolated. React owns data and
  controls; Cytoscape owns only its empty container.
- Use `ResizeObserver` to call the renderer resize path when the workbench or
  right panel changes size.
- Stop any active layout and call `cy.destroy()` on scope change, vault change,
  error replacement, and unmount. Remove observers/listeners and release all
  references.
- Use batched element updates and stable IDs. Do not rebuild the whole
  Cytoscape instance for selection-only or theme-only changes.
- Avoid expensive curve, image, compound-node, or continuously animated
  styles. Labels must reduce automatically for dense/zoomed-out graphs.
- Add a deterministic synthetic fixture generator and verification harness for
  at least:
  - 500 notes / 2,000 collapsed edges;
  - `[estimate]` 2,000 notes / 8,000 collapsed edges;
  - an ambiguous-alias cluster, unresolved targets, orphans, self-links, and
    duplicate authored links.
- The query harness must report topology counts, truncation, elapsed time, and
  heap delta. The Electron live check must record time to first interactive
  graph, pan/zoom/selection responsiveness, and cleanup after repeated
  open/close cycles. Performance uncertainty is evidence to continue, not a
  reason to omit the larger tier.

### 10. Architecture, security, and documentation integration

- Keep topology/query logic in main/shared services and graph interaction state
  in focused renderer hooks/components. Do not move graph orchestration into a
  larger `App.tsx`.
- New IPC channels follow `domain:action`, validate sender and payload, return
  path-safe errors, and expose no raw Electron, filesystem, SQLite, or absolute
  paths.
- Graph data comes only from the current vault's local rebuildable index and
  local `.app` configuration. No network request, remote content, arbitrary
  script, MDX evaluation, iframe permission, or custom component execution is
  involved.
- Node opening, bookmark creation, path copy, and reveal actions reuse existing
  workbench/vault/bookmark coordination. The graph never writes note content.
- Add small example-vault fixtures for a connected cluster, an orphan,
  unresolved link, ambiguous alias, self-link, duplicate links, and a depth-4
  local chain.
- After verified implementation, update:
  - `goals/README.md`;
  - `docs/roadmap.md`;
  - `docs/architecture.md`;
  - `DESIGN.md` for graph-only visualization encodings;
  - both relevant Obsidian parity/interaction audits;
  - a new `docs/goal-24-graph-view-report.md` evidence ledger.
- Documentation must say "substantial notes-only parity" until tag nodes,
  attachment nodes, excluded-file settings, and time-lapse are delivered.

---

## Constraints

These are mandatory. If a constraint conflicts with the Execution Plan, follow
the constraint.

- [x] Work only on GOAL-24. Do not implement another missing Obsidian plugin in
  this session.
- [x] Preserve the local-first invariant: Markdown/MDX files are source of
  truth, SQLite is disposable cache, and `.app/graph-view.json` is app metadata,
  not note content.
- [x] Preserve Electron hardening: `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false`, and no raw `fs`, `path`, `ipcRenderer`, database, or
  absolute vault path exposed to renderer.
- [x] Do not represent a graph as a fake vault path. Use a discriminated
  virtual workbench item and audit every file-only action.
- [x] Do not read all note files from renderer, issue N+1 IPC calls, or compute
  vault-wide topology from unsaved/unchecked renderer data.
- [x] Do not invent edges for ambiguous aliases. Uncertainty must remain
  visible in the graph model.
- [x] Do not silently truncate, silently drop corrupt graph settings, or show
  stale results from a previous query, note, index revision, or vault.
- [x] Do not add tag nodes, attachment nodes, excluded-file settings,
  chronological animation, Graph bookmarks, or a generic graph/plugin API.
- [x] The only conditionally authorized dependency is the Cytoscape.js core
  package described above. Install it with Bun only after Phase 1 verification.
- [x] Cytoscape must be lazy-loaded and fully cleaned up. No eager graph bundle
  on ordinary note startup, leaked render loop, observer, or event handler.
- [x] Graph configuration writes are versioned, zod-validated, atomic,
  revision-checked, and main-process-owned.
- [x] Reuse the existing search grammar, action registry, keybinding resolver,
  overlay/focus ownership, Page Preview-safe navigation boundaries, workbench
  transaction, and bookmark/vault action ports.
- [x] Preserve current Footnotes, Page Preview, Outgoing Links, Properties,
  Bookmarks, Search, backlinks, rename, tabs, settings, export, sandbox, and AI
  approval behavior.
- [x] Preserve all unrelated modified and untracked work. Inspect `git status`
  before editing; do not reset, rewrite, stage, commit, or delete user changes
  outside this goal.
- [x] Before editing existing UI, run the `audit-react-ux-ui` workflow for each
  materially distinct touched surface and accept it only after the audit
  contract and semantic review pass. Use `frontend-design`,
  `vercel-react-best-practices`, and `webapp-testing` when their trigger
  conditions apply.
- [x] After every meaningful implementation phase, run focused tests plus
  `bun run typecheck` and `bun run lint`, as required by `AGENTS.md`.
- [x] If a required product decision would weaken security, alter note syntax,
  add a second durable storage location, or expand graph topology beyond notes,
  stop and ask instead of silently changing this goal.

---

## Success Criteria

Each criterion requires affirmative evidence. "No obvious failure" is not
evidence.

### Required Evidence per Criterion

| # | Criterion | Verification command / action | Expected output / signal |
|---|---|---|---|
| 1 | Pure graph model collapses duplicates, keeps self-links, computes visible degree, represents unresolved/ambiguous targets without invented edges, and performs deterministic local BFS | `bun test tests/graph-model.test.ts` | All graph model cases pass, including depth 1–4, cycles, ambiguity, orphans, and truncation |
| 2 | One bounded main-process query produces global and local snapshots using the existing search grammar | `bun test tests/graph-query.test.ts tests/graph-search.test.ts` | No per-note IPC/query loop; filters/groups/global/local results match fixtures |
| 3 | Graph IPC validates sender, request, response, bounds, and path-safe errors | `bun test tests/graph-ipc.test.ts` | Non-main-frame, invalid scope/path/depth/query/group, oversized response, and stale-vault cases are rejected |
| 4 | Per-vault graph config defaults, version/revision validation, atomic writes, conflict handling, and corruption preservation work | `bun test tests/graph-config.test.ts` | Missing/corrupt/old/conflicting/concurrent-write fixtures pass; corrupt bytes remain untouched |
| 5 | Global Graph is a deduplicated virtual workbench item and never enters file I/O or file-only context actions | `bun test tests/workbench-graph-item.test.ts tests/tab-context-actions.test.ts` | Open/activate/close/MRU/reopen/vault-reset pass; fake-path and file-action spies remain untouched |
| 6 | Graph actions are registered, context-gated, palette-visible where required, and use shared dispatch | `bun test tests/action-registry.test.ts tests/graph-actions.test.ts` | `graph.open-global`, `graph.fit-view`, `graph.toggle-settings`, and `panel.showLocalGraph` have stable metadata and correct enabled states |
| 7 | Global surface renders every required loaded/loading/empty/error/truncated state and opens nodes transactionally | Component tests plus final `ui-map` for `GraphWorkbenchView` | Mapped controls/states match accepted audit; repeated open does not duplicate the graph tab |
| 8 | Local Graph follows the active note, honors depth, clears on unsupported items, and rejects stale results | `bun test tests/local-graph-controller.test.tsx tests/knowledge-panel-selector.test.tsx` | Active-note/scope/race/no-note/image/text/graph/missing states pass at 320 px |
| 9 | Pointer graph interactions work and resolved-node actions route through existing workbench/bookmark/vault ports | Component adapter tests and Electron live check | Hover adjacency, select, open, drag, pan, zoom, fit, reset, context menu, bookmark, copy, and reveal are observed |
| 10 | Keyboard and screen-reader equivalents exist outside canvas pixels | Component accessibility tests and Electron keyboard-only check | Searchable node listbox, semantic details, focus restoration, `+`/`-`, arrows/Shift, Enter, Escape, and visible focus all work |
| 11 | Settings/groups/display/forces are bounded, persisted, reversible, and do not cause stale or unbounded relayout | `bun test tests/graph-settings.test.tsx tests/graph-controller.test.ts` | Max-eight groups, first-match priority, reset defaults, debounce, revision conflict, and stale cancellation pass |
| 12 | Cytoscape is lazy, isolated, responsive to container changes, reduced-motion safe, and cleaned up | Build chunk inspection, adapter lifecycle tests, and repeated Electron open/close check | Ordinary startup does not load graph chunk; layout stop/destroy/observer cleanup spies pass; heap does not monotonically grow across cycles |
| 13 | Bounded performance tiers are measured and truncation is explicit | `bun scripts/verify-goal24-graph.ts` | Harness prints deterministic counts/time/heap for both tiers and exits 0; no silent truncation |
| 14 | Security and local-only invariants remain intact | `rg -n "nodeIntegration|contextIsolation|sandbox:" src/main` plus `rg -n "fetch\\(|https?://|ipcRenderer|absolutePath" src/renderer/src/graph src/shared/graph.ts` | BrowserWindow remains hardened; graph renderer/shared code adds no network, raw IPC/fs/path, MDX evaluation, or absolute-path bridge; the narrow preload diff is reviewed separately |
| 15 | Repository validation passes | `bun run typecheck && bun run lint && bun test && bun run build` | All commands exit 0; only documented pre-existing build warnings may remain |
| 16 | Documentation and parity claims match delivered behavior | Review Goal 24 report, roadmap, architecture, design, parity audits, and goal index | Evidence ledger is complete; notes-only scope and deferred tag/attachment/time-lapse gaps remain explicit |

### Reference artifacts

- `goals/GOAL-24-graph-view.md` — source of truth for scope and completion.
- `docs/goal-24-graph-view-report.md` — implementation/evidence ledger created
  during execution.
- `docs/ux/goal-24-graph-view/route-ledger.md` — baseline/final UI audit ledger
  created during execution.
- `docs/research/obsidian-core-plugins-parity-2026-07.md` — parity claim ledger.
- `docs/research/obsidian-interaction-behaviors-2026-07.md` — interaction
  behavior reference.
- `scripts/verify-goal24-graph.ts` — deterministic topology/performance harness
  created during execution.

### Completion condition

The agent finishes only when:

- [x] all 16 criteria have affirmative evidence;
- [x] all verification commands pass with the expected signal;
- [x] baseline and final UI maps exist for every changed existing surface;
- [x] the independent plan has an `ACCEPT` semantic review;
- [x] Global and Local Graph pass the Electron pointer and keyboard check;
- [x] the larger synthetic tier was measured, not skipped as "polish";
- [x] no regression remains in existing note/workbench/knowledge utilities;
- [x] docs state the exact notes-only parity and remaining gaps;
- [x] the worktree contains no accidental edits outside GOAL-24.

---

## Execution Plan

Report briefly after each numbered phase. After every meaningful implementation
phase, run its focused tests plus `bun run typecheck` and `bun run lint`.

1. **Re-establish the live baseline**
   - Read all required project docs and this goal.
   - Inspect `git status`, current HEAD, current schema/settings versions, and
     uncommitted changes.
   - Re-run the GOAL-23 footnote/knowledge focused tests to protect the user's
     motivating example.
   - Inventory every file-oriented assumption in workbench, tabs, document
     rendering, actions, and active-note selectors.

2. **Generate and review independent UX evidence**
   - Run the `audit-react-ux-ui` script for `AppLayout`, `MainEditor`,
     `EditorTabs`, and `RightPanel` before editing those surfaces.
   - Read every generated `plan.md`, `preview.html`, `ui-map.txt`,
     `manifest.json`, and the audit contract.
   - Inspect previews with the Browser skill where available.
   - Write semantic reviews and a route ledger. Reject invented tokens,
     unsupported graph capabilities, or advice that conflicts with the
     workbench/security model.

3. **Prove the renderer dependency and performance envelope**
   - Verify the current Cytoscape package version, MIT license, types, ESM
     export, and runtime dependency count from authoritative package metadata.
   - Create a temporary, non-product spike or focused test proving
     electron-vite import, headless model creation, CoSE layout options, event
     registration, resize, stop, and destroy.
   - Measure synthetic 500/2,000 and estimated 2,000/8,000 tiers.
   - If evidence passes, install only `cytoscape` with Bun. If it fails, stop
     and report the blocker; do not substitute an unresearched library.

4. **Add shared graph domain types and pure model tests**
   - Define zod schemas, scope, node, edge, snapshot, settings, group, manifest,
     bounds, and error contracts.
   - Implement pure edge collapse, unique/ambiguous/unresolved resolution,
     visible degree, orphan filtering, group priority, and local BFS.
   - Add deterministic fixtures and focused tests before IPC/UI.

5. **Add the bounded SQLite graph query**
   - Factor reusable graph membership from the existing Search grammar instead
     of duplicating it.
   - Add bulk graph data access and indexes only if query-plan evidence
     requires them.
   - Add caps, totals, deterministic truncation, graph revision, and query
     tests, including migration/rebuild behavior if the schema changes.

6. **Add graph configuration and narrow IPC**
   - Implement `.app/graph-view.json` service with defaults, zod validation,
     revision conflicts, queued atomic writes, corruption preservation, and
     vault lifecycle.
   - Register validated main-frame-only snapshot/config channels.
   - Add typed preload declarations and focused service/IPC tests.

7. **Generalize the workbench for virtual graph items**
   - Introduce a discriminated file/virtual item model and capability helpers.
   - Update transactions, cache/save/rename/delete flows, MRU/reopen, tabs,
     context menus, `MainEditor`, selected-note derivation, and vault reset.
   - Register graph actions through the existing action system.
   - Prove that graph activation performs no file read and that failed dirty
     note saves still block activation.

8. **Build the lazy shared Graph surface**
   - Implement semantic loading/error/empty/truncated controls and a lazy
     Cytoscape adapter.
   - Add simple editorial styles, theme updates, CoSE force mapping, batched
     data updates, ResizeObserver, layout stop/destroy, and reduced-motion.
   - Add pointer selection, adjacency emphasis, drag, pan, zoom, fit/reset, and
     node context actions through existing ports.

9. **Add Global Graph workbench UX**
   - Wire `graph.open-global`, graph toolbar, settings sheet, filters, groups,
     display/force controls, node navigator, semantic selection details, and
     session viewport state.
   - Implement stale-safe refresh on index/config/vault changes.
   - Verify loaded plus every important non-happy state from the accepted audit.

10. **Add Local Graph context utility**
    - Extend `KnowledgePanelId`, selector, command action, Right Panel
      composition, active-note controller, and depth control.
    - Reuse the shared renderer at 320 px.
    - Verify no-note and non-note states, active-note changes, stale cancellation,
      and opening a node without losing the Local Graph destination.

11. **Finish accessibility and performance evidence**
    - Add DOM-backed node search/listbox, semantic detail region, keyboard
      pan/zoom/open/escape, focus containment/restoration, and context-menu
      equivalence.
    - Run the synthetic query/performance harness and repeated renderer
      lifecycle tests.
    - Exercise both themes, reduced motion, dense labels, ambiguity,
      truncation, and corrupt config.

12. **Run Electron verification and re-map**
    - Use the `webapp-testing` workflow where it can reach the running Electron
      renderer; supplement with deterministic component tests where native
      Electron behavior is not browser-reproducible.
    - Verify Global and Local Graph with pointer and keyboard, at normal and
      320 px widths, after note/link edits, rename/delete, rebuild, and vault
      switch.
    - Generate final `ui-map` evidence and compare it against the baseline and
      accepted plan.

13. **Finalize validation and documentation**
    - Run formatter only on touched Goal-24 files as needed.
    - Run `bun run typecheck`, `bun run lint`, the full test suite, production
      build, graph harness, security scans, diff/whitespace checks, and inspect
      bundle chunking.
    - Write the Goal 24 report, update architecture/design/roadmap/parity docs,
      and add Goal 24 to `goals/README.md`.
    - Check every success criterion individually. Do not mark the goal complete
      from a summary test count alone.

---

## Out of Scope

- Reimplementing or redesigning Footnotes, Page Preview, Outgoing Links,
  Properties, or Bookmarks.
- Tag nodes, attachment/image/audio/PDF nodes, external URL nodes, embedded
  component nodes, or folder hierarchy nodes.
- Excluded-files configuration beyond what the current index already excludes.
- Chronological/time-lapse graph animation or file creation-time indexing.
- Bookmark targets whose kind is Graph, block, multi-selection, or viewport.
- Editing note links by drawing/deleting graph edges.
- Persisting dragged node coordinates or per-note local graph camera positions.
- WebGL/3D graph rendering, spatial audio, minimaps, community layout engines,
  or user-authored graph plugins.
- Graph image/SVG export, publish embedding, multi-window graphs, or remote
  collaboration.
- Canvas/freeform whiteboards, Bases/query tables, semantic embeddings, AI
  clustering, automatic topic labels, or graph analytics dashboards.
- Workspaces/session persistence beyond the existing current-vault workbench
  lifetime.

---

## References

### Official external references

- [Obsidian Graph view](https://obsidian.md/help/plugins/graph) — global/local
  behavior and settings taxonomy.
- [Cytoscape.js documentation](https://js.cytoscape.org/) — initialization,
  events, viewport, layouts, performance, resize, stop, destroy, and headless
  testing.
- [Cytoscape.js package metadata](https://raw.githubusercontent.com/cytoscape/cytoscape.js/master/package.json)
  — current version, ESM/CJS exports, bundled types, and dependency metadata.
- [Cytoscape.js MIT license](https://raw.githubusercontent.com/cytoscape/cytoscape.js/master/LICENSE).

### Repository references

- [src/main/services/db-service.ts](../src/main/services/db-service.ts)
- [src/main/services/index-service.ts](../src/main/services/index-service.ts)
- [src/main/services/vault-index-runtime.ts](../src/main/services/vault-index-runtime.ts)
- [src/main/services/bookmark-service.ts](../src/main/services/bookmark-service.ts)
- [src/main/ipc/index-ipc.ts](../src/main/ipc/index-ipc.ts)
- [src/preload/index.ts](../src/preload/index.ts)
- [src/renderer/src/hooks/useWorkbench.ts](../src/renderer/src/hooks/useWorkbench.ts)
- [src/renderer/src/workbench/types.ts](../src/renderer/src/workbench/types.ts)
- [src/renderer/src/workbench/workbench-state.ts](../src/renderer/src/workbench/workbench-state.ts)
- [src/renderer/src/components/layout/EditorTabs.tsx](../src/renderer/src/components/layout/EditorTabs.tsx)
- [src/renderer/src/components/layout/MainEditor.tsx](../src/renderer/src/components/layout/MainEditor.tsx)
- [src/renderer/src/components/layout/RightPanel.tsx](../src/renderer/src/components/layout/RightPanel.tsx)
- [src/shared/app-settings.ts](../src/shared/app-settings.ts)
- [src/shared/knowledge.ts](../src/shared/knowledge.ts)
- [src/shared/workspace-actions.ts](../src/shared/workspace-actions.ts)
- [goals/GOAL-22-zed-like-workbench-ux.md](GOAL-22-zed-like-workbench-ux.md)
- [goals/GOAL-23-obsidian-knowledge-utilities.md](GOAL-23-obsidian-knowledge-utilities.md)

---

## Agent Instructions

### Execution

1. Read the entire goal and all required repository docs before acting.
2. Follow Constraints over the Execution Plan when they conflict.
3. Execute phases in order and report briefly after each phase.
4. Inspect live source and command output before every completion claim.
5. Use `rg` to find candidates and `ast-grep outline` before reading large or
   unfamiliar source files, as required by `AGENTS.md`.
6. Preserve the user's dirty worktree and isolate Goal-24 changes carefully.
7. After each meaningful phase, run focused tests, typecheck, and lint.
8. If a requirement is uncertain, gather evidence and continue. Do not omit it
   or relabel it optional.
9. If a blocker conflicts with a security, storage, or dependency constraint,
   stop and report it instead of inventing a workaround.
10. At completion, report every success criterion with its evidence and call
    out any criterion that remains unproven.

### Anti-bias instructions

**Against scope shrink**

- Do not redefine "Graph View" as a static image, a list of backlinks, only a
  Global Graph, only a Local Graph, or a happy-path demo fixture.
- Do not omit virtual-item workbench behavior, ambiguity, bounds,
  accessibility, persistence, stale cancellation, or cleanup as "polish".
- Do not claim full Obsidian parity while tag nodes, attachment nodes, and
  time-lapse remain deferred.

**Against uncertainty stop**

- Treat uncertain edge resolution, stale results, truncation, focus,
  performance, or cleanup as unproven work requiring evidence.
- If the large synthetic tier is slow, profile, tune, lower documented caps
  with evidence, and keep the truncation UX. Do not silently skip the tier.
- If Electron interaction is hard to automate, add deterministic model/adapter
  tests and still perform the named live observation.

**Against memory trust**

- Conversation and prior goal completion notes are hints only.
- Re-read the current worktree, current schema, current settings version,
  current action registry, and current test output before editing or claiming.
- A previous passing test does not prove Graph View after workbench or index
  changes; rerun the relevant regression suite.
