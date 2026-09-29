# GOAL-37 verification — compact docks, tabs, find and panel states

## Build and automated checks

| Check | Result |
| --- | --- |
| `bun run typecheck` | Pass, all tools/node/web typechecks. |
| `bun test --parallel=4` | Pass, 514 tests, 0 failures (baseline 501). |
| `bun run build` | Pass; existing Vite dynamic/static import and dependency `eval` warnings remain. Full output: `.tmp/goal37/build-final.txt`. |
| `bunx biome check <30 changed TS/TSX/CSS files>` | Pass, 0 errors/fixes. |
| `bun run lint` | 380 existing repository errors, below the 387-error HEAD cap; command exits 1 because baseline lint debt remains. Full output: `.tmp/goal37/lint-final.txt`. Disposable copied vaults and CDP profiles were removed before this count. |
| Security subset (`bun test --parallel=4` on the eight IPC/sandbox/security test files) | Pass, 30 tests. |
| `git diff --check` | Pass. `git diff -- package.json bun.lock example-vault src/preload` is empty; added diff contains no `allow-same-origin` or `dangerouslySetInnerHTML`. |

## Dock policy and Electron geometry

The compact 26rem (416px) floor is the smallest useful reading/editing column at the 980px supported minimum; the wide floor remains 30rem (480px). `resolveDockPolicy` tests cover 980, 1000, 1100, 1366 and 1920px, all eight panel combinations, and default/wide saved widths. The measured light/dark production Electron matrix is in `.tmp/goal37/matrix.json`; every visible dock is outside the document rectangle.

| Width / open state | Document | Explorer | Context | AI |
| --- | ---: | ---: | ---: | ---: |
| 1000, AI | 420px | 248px | — | 320px |
| 1000, Context | 452px | 248px | 288px | — |
| 1100, AI | 504px | 248px | — | 336px |
| 1100, Context | 552px | 248px | 288px | — |
| 1366, all | 484px | 248px | 288px | 328px |
| 1920, widened Explorer, all | 878px | 400px | 288px | 336px |
| Shrink to 1000 with all | 420px | temporarily hidden | 288px | 280px |

Light/dark screenshot pairs under `.tmp/screens/goal37/`: `{light,dark}-{1000,1100}-{ai,context}-dns.png`, `{light,dark}-1366-all-dns.png`, `{light,dark}-1920-resized-left.png`, and `{light,dark}-1000-resized-shrink.png`. These were recaptured after tab geometry and separator clamping fixes. Saved width preferences were not overwritten by the shrink.

Repeated Shift+ArrowLeft on the AI separator and double-click reset at 1000px with both supplementary docks left the document at **416px**, the compact floor. See the `keyboard-resize-limit` and `doubleclick-resize-limit` rows in `matrix.json` and `*-1000-keyboard-resize-limit.png`.

## Interaction and state evidence

Production Electron interaction data: `.tmp/goal37/interactions.json`. In each theme, 20 open tabs produced an overflow button, directional fades, six marked hidden entries, and an active tab scrolled to `scrollLeft ≈ 762px`; keyboard ArrowUp/Enter selected tab 17. Images: `{light,dark}-1920-tabs-active-scrolled.png` and `*-1920-tabs-overflow-list.png`. Source Ctrl+F kept Replace hidden and focused Find; Ctrl+H showed Replace and focused it; Live Ctrl+H also focused Replace. Images: `*-1920-find-only.png`, `*-1920-replace-expanded.png`, `*-1920-live-replace.png`.

Graph images `*-1920-graph-orphans-final.png` and `*-1920-graph-orphan-focus-final.png` show a separated **Orphans (n)** cluster and a full keyboard-focus title in the synchronized navigator. The post-layout separation fixed an earlier screenshot where connected nodes visually crossed the compound cluster. AI images `*-1920-ai-no-key-note.png`, `*-1000-ai-narrow.png`, `*-ai-no-note.png`, and `*-ai-settings-direct.png` show honest disabled composer copy, primary AI Settings action, narrow unbroken status phrases, and direct navigation to the AI Settings section. Busy/Error/Cancelled transcript/composer rendering is covered by the GOAL-37 state test; no actual API request was sent without a key.

Secondary-state evidence (both light and dark; data in `.tmp/goal37/secondary.json`): `*-empty-vault.png`, `*-palette-no-match.png`, `*-finder-no-match.png`, `*-search-no-results.png`, `*-no-outline.png`, `*-no-backlinks.png`, `*-graph-empty.png`. The finder now explicitly says there are no matching files above its deliberate Create action; the empty graph says no notes exist yet and its navigator no longer uses raw “returned node matches” copy. Empty-folder display is intentionally excluded by revision 1: folders are derived from files and cannot be created empty in-app.

### Keyboard walkthrough

Recorded in `.tmp/goal37/keyboard.json` using production Electron. Starting on the Welcome tab: Ctrl+B closed Explorer and returned focus to Document; Ctrl+B reopened it and focused `workspace-left-panel`; Esc closed it and returned to Document. Enter on **Show context panel** focused `supplementary-context-panel`; Esc returned to that toggle. Ctrl+Shift+A focused `supplementary-ai-panel`; Esc returned to the Welcome tab. After opening DNS and a plain note, Ctrl+Tab committed DNS as the next MRU target and Ctrl+Shift+Tab moved backward to Welcome. The overflow list's selected option took keyboard ArrowUp/Enter and activated tab 17. In Source, Ctrl+F focused Find with Replace collapsed; Ctrl+H focused Replace with its row expanded. Esc dismissed each editor panel.

## Performance

`python .tmp/goal34/perf.py goal37` completed 10 production Electron sessions after dismissing a sandbox-consent dialog *after* note timing (the first run's palette probe was blocked by that unrelated modal). The final warm DNS open median was **90.6ms**, versus **143.4ms** in `.tmp/goal34/perf-ux3.json` (−36.8%, under the +10% ceiling of 157.74ms). Result: `.tmp/goal34/perf-goal37.json`; run log: `.tmp/goal37/perf-run.txt`.

## Self-review and limitations

Self-review fixed tab-span measurement relative to the scroll strip, pointer/keyboard/double-click width clamping, Explorer dock focus/return, graph compound overlap, finder no-match copy, and empty-graph/navigator copy. No changes to the security boundary or persisted panel schema were needed. The supported visual range is 980–1920px; widths below 980px were not part of this goal. Repository-wide lint remains nonzero due to existing debt but is seven errors below its locked cap. No live AI network request was exercised without a key.
