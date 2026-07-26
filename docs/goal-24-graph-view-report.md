# GOAL-24 Graph View completion report

Date: 2026-07-25

## Delivered boundary

GOAL-24 delivers **substantial notes-only Graph View parity**. It does not claim
tag-node, attachment-node, excluded-file-setting, chronological time-lapse, or graph
bookmark-type parity.

- Global Graph is one typed, deduplicated virtual workbench item with no fabricated
  path or file capability.
- Local Graph is the eighth controlled context utility and follows only a present
  editable note.
- Both scopes share the same bounded graph model, settings, semantic states, DOM node
  navigator/details, existing note-action ports, and lazy Cytoscape adapter.
- Topology and configuration remain local to the current vault. No graph code adds
  network access, MDX evaluation, arbitrary script execution, or an absolute-path
  bridge.

## Implementation summary

The shared domain in `src/shared/graph.ts` and `src/shared/graph-model.ts` owns zod
contracts, stable IDs, duplicate collapse, ambiguity/unresolved ghosts, visible
degree, orphan filtering, ordered group membership, incoming/outgoing local BFS, and
deterministic truncation. Main process performs one bounded SQLite graph-source query,
reuses the existing Search matcher, and exposes main-frame-only validated graph IPC.

Vault configuration is version 1 at `.app/graph-view.json`. Missing configuration
returns independent defaults. Writes are serialized and atomic with optimistic
revision checks. Corrupt or unsupported bytes are preserved and reported only through
the relative recovery path.

The renderer generalizes the workbench to file and virtual item variants, registers
four graph actions, lazy-loads `GraphSurface` and Cytoscape only when a graph surface
is activated, and keeps canvas ownership behind an imperative adapter. The adapter
uses built-in CoSE, batched data changes, bounded viewport operations,
`ResizeObserver`, theme observation, reduced-motion layout, animation/layout stop, and
instance destruction.

## Dependency gate

Exactly one direct dependency was added:

| Package | Verified installed metadata |
| --- | --- |
| `cytoscape@3.34.0` | MIT; `index.d.ts`; ESM export `dist/cytoscape.esm.mjs`; no runtime dependencies |

No React wrapper, layout extension, D3/Pixi/Three/WebGL framework, or other direct
dependency was added. The production build emits separate `GraphSurface-*.js`
(approximately 77 kB) and `cytoscape.esm-*.js` (approximately 961 kB) chunks. A fresh
Electron reload requested neither chunk during ordinary note startup; activating
Global Graph requested both.

## Performance evidence

`bun scripts/verify-goal24-graph.ts` uses deterministic fixtures that include
duplicate links, a self-link, ambiguous aliases, unresolved targets, an orphan, and a
depth-four chain.

| Tier | Source notes | Authored links | Returned nodes | Collapsed edges | Elapsed | Heap delta | Truncated |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| medium | 500 | 2,001 | 502 | 2,000 | 80.32 ms | 0.00 MiB | no |
| large | 2,000 | 8,001 | 2,002 | 8,000 | 292.56 ms | 0.00 MiB | no |

Six production Electron graph open/close cycles, with garbage collection after every
close, reported 20.40, 20.63, 21.04, 21.20, 21.14, and 21.22 MiB used heap. The
sequence was not monotonically increasing. A final production regression pass also
performed four immediate reset-layout/close/reopen cycles; every reopened canvas was
668.9 px high, settings focus returned to its trigger, and no page or console error was
reported.

## Electron and UX evidence

The live pass used a disposable Electron user-data directory and a disposable copy of
`example-vault`.

- A fresh ordinary note startup loaded no GraphSurface or Cytoscape request. Global
  Graph became interactive in about 1.78 seconds on the 53-node/27-edge fixture.
- Pointer checks covered hover adjacency, selection, node drag, background pan, wheel
  zoom, fit, reset, and the accessible node context surface. Bookmark and Copy relative
  path ran against the disposable vault/profile; Reveal remained covered by the same
  tested path-only action port without opening an OS Explorer window during automation.
- Ambiguous `Graph Fixture Shared` exposed exactly two candidate paths. Unresolved
  `Graph Fixture Missing` exposed the display-only explanation and no file action.
- Keyboard checks covered canvas `+`/`-`, arrows, accelerated Shift-pan, DOM listbox
  Arrow/Enter open, Escape selection clear, and focus return from graph-owned context
  and settings surfaces.
- Semantic node opening kept the one Graph tab available and used the existing
  transactional workbench path. Repeated Global Graph dispatch remained deduplicated.
- Local Graph changed from 4 nodes/4 edges at depth one to 7/7 at depth four. Its
  measured content width was 318 px with `scrollWidth === clientWidth`. Activating the
  graph item replaced prior local topology with the specific unsupported-item state;
  returning to the note restored current topology.
- Light, dark, and reduced-motion graph rendering completed. Live fixtures visibly
  distinguish the active root, unresolved dashed node, ambiguous diamond, arrows, and
  neutral orphans.

UX evidence:

- [route ledger](ux/goal-24-graph-view/route-ledger.md)
- baseline maps in `docs/ux-ui-map/external-audit-baseline-*.txt`
- final maps in `docs/ux-ui-map/final-*-20260725T-final.txt`
- live captures in `docs/ux/goal-24-graph-view/*.png`
- all four independent semantic reviews: `ACCEPT WITH BOUNDED EXCLUSIONS`

## Success-criteria ledger

| # | Result | Evidence |
| ---: | :---: | --- |
| 1 | PASS | `tests/graph-model.test.ts`: duplicates, self-links, ghosts, visible degree, orphans, depth/cycles, root retention, deterministic truncation |
| 2 | PASS | `tests/graph-query.test.ts`, `tests/graph-search.test.ts`: one bulk source query and the existing free-text/tag/path/file/regex/property matcher |
| 3 | PASS | `tests/graph-ipc.test.ts`: sender, strict request/response, bounds, dangling/oversized response, stale vault, and path-safe errors |
| 4 | PASS | `tests/graph-config.test.ts`: defaults, atomic/queued writes, exact revisions, conflicts, corrupt/unsupported preservation |
| 5 | PASS | `tests/workbench-graph-item.test.ts`, `tests/tab-context-actions.test.ts`: dedupe, activate/close/reopen/MRU/reset, no fake path/file action |
| 6 | PASS | action/keybinding/graph/menu tests: four stable shared actions, gates, palette metadata, and Go-menu dispatch |
| 7 | PASS | `tests/graph-surface.test.tsx`, final map, and live Global Graph state/transaction pass |
| 8 | PASS | `tests/local-graph-controller.test.tsx`, selector tests, and the live 318 px depth/state pass |
| 9 | PASS | adapter event/lifecycle tests and production pointer/context/action checks |
| 10 | PASS | semantic navigator/details tests and production keyboard/focus checks |
| 11 | PASS | settings/controller/config tests: bounds, ordered priority, independent/reset defaults, 240 ms debounce, conflict reconciliation, stale ownership |
| 12 | PASS | separate build chunks, zero startup graph requests, adapter cleanup spies, reduced motion, six live close cycles |
| 13 | PASS | deterministic medium/large harness above; truncation is schema/model-tested and always exposes reason plus returned/total counts |
| 14 | PASS | BrowserWindow hardening and graph security scans; narrow preload exposes only validated methods and relative-path domain values |
| 15 | PASS | final typecheck, lint, full tests, and production build all exit 0; build warnings are pre-existing mixed static/dynamic imports and `gray-matter` eval |
| 16 | PASS | architecture, design, roadmap, goal index, parity audit, interaction audit, route ledger, and this report describe exact delivered scope and gaps |

## Security review

BrowserWindow remains `nodeIntegration: false`, `contextIsolation: true`, `sandbox:
true`, and `webSecurity: true`. Renderer/shared graph code contains no `fetch`, remote
URL, raw `ipcRenderer`, filesystem/path import, or absolute-path field. Graph node
opening, bookmarking, copying, and reveal reuse existing relative-path coordination;
Graph View never writes note content.

## Remaining deliberate gaps

Tag nodes, attachment nodes, excluded-file settings, chronological time-lapse, graph
bookmark types, persistent viewport/drag positions, split panes, and full Obsidian
Graph View parity remain outside GOAL-24.
