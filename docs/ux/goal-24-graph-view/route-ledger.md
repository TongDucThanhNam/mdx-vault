# GOAL-24 Graph View UX route ledger

The baseline audit was generated before edits to the four existing surfaces. Independent
plans were semantically accepted only for source-backed GOAL-24 integration decisions;
unrelated shell redesigns and unfaithful diagnostic previews were explicitly excluded.

| Route/component | Baseline map | States audited | Findings | Shared pattern | Final map | Visual check | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AppLayout` | `docs/ux-ui-map/external-audit-baseline-AppLayout-20260725T041314Z.txt` | shell, full-reading conditional, right/AI/left rail composition, error | Global Graph belongs in the workbench; Local Graph stays in the controlled right rail; no shell redesign | typed workbench identity + existing panel ownership | `docs/ux-ui-map/final-AppLayout-20260725T-final.txt` | live desktop shell retained its three-pane ownership; Local Graph measured 318 px with no horizontal overflow | **ACCEPT** |
| `MainEditor` | `docs/ux-ui-map/external-audit-baseline-MainEditor-20260725T042355Z.txt` | note, loading, missing, image, text, unsupported, empty | add one virtual-graph branch before file rendering; graph states stay graph-owned | explicit file/virtual variants | `docs/ux-ui-map/final-MainEditor-20260725T-final.txt` | `global-graph-live.png` confirms one graph-owned document surface and no file toolbar/path fiction | **ACCEPT** |
| `EditorTabs` | `docs/ux-ui-map/external-audit-baseline-EditorTabs-20260725T042355Z.txt` | active, focused, dirty, missing, duplicate name, context menu, narrow overflow | preserve tab keyboard/focus grammar; omit file actions for virtual graph | capability-gated item presentation/actions | `docs/ux-ui-map/final-EditorTabs-20260725T-final.txt` | repeated menu dispatch kept one Graph tab; semantic node open retained the Graph tab; close/reopen passed six live cycles | **ACCEPT** |
| `RightPanel` | `docs/ux-ui-map/external-audit-baseline-RightPanel-20260725T042355Z.txt` | all seven existing destinations, native selector, narrow panel | add one peer destination and reuse controlled panel switch | scalable native selector + child-owned state | `docs/ux-ui-map/final-RightPanel-20260725T-final.txt` | `local-graph-live-320.png` confirms the eighth selector destination, depth control, canvas, and navigator at 318 px | **ACCEPT** |
| `GraphSurface` | n/a — new shared surface | global/local, loaded/loading/empty/error/truncated/recovery, pointer, keyboard, settings | one semantic React surface around one imperative lazy renderer | graph-owned state + DOM navigator/details | `docs/ux-ui-map/final-GraphSurface-20260725T-final.txt` | light/dark, reduced motion, ambiguity, unresolved, active root, depth 1/4, focus return, and cleanup checked live | **ACCEPT** |

## Accepted implementation contract

- The graph’s visual signature is the bounded node field itself: ink lines, paper nodes,
  mono labels, and categorical group accents with redundant stroke/shape cues.
- Global Graph is a single deduplicated virtual workbench item.
- Local Graph is an eighth controlled right-panel utility at 320 px.
- Existing masthead, status bar, reading mode, panel ownership, and tab density remain intact
  unless a graph-specific functional requirement proves a narrowly scoped change.
- Settings use a graph-owned sheet; no generic graph create/edit dialog is introduced.
- Empty/loading/error/truncation copy stays inside `GraphSurface`, shared by both scopes.

## Final live evidence

- `global-graph-live.png` and `global-graph-canvas.png`: loaded Global Graph with
  53 returned nodes and 27 edges in the source fixture vault.
- `global-graph-hover.png`: pointer hover/selection exercise on the production
  canvas; adapter tests assert adjacency class behavior.
- `global-graph-dark-reduced-motion.png`: dark theme with reduced motion enabled.
- `local-graph-live-320.png`: depth-four Local Graph at the fixed 320 px right-panel
  contract (318 px measured content width; `scrollWidth === clientWidth`).
- Independent semantic reviews for `AppLayout`, `MainEditor`, `EditorTabs`, and
  `RightPanel` all have an `ACCEPT WITH BOUNDED EXCLUSIONS` verdict in the external
  audit artifact directories recorded by the baseline maps.
