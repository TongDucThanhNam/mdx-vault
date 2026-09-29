# GOAL-33 — Navigation, focus, states and accessibility polish

## Outcome

MDX structure, navigation, focus and graph labels remain legible and predictable in a quiet, single-pane workbench.

## Dependencies

GOAL-23, GOAL-26, GOAL-29, GOAL-32.

## Constraints

- Preserve the single-pane model: no split, following preview or preview tabs.
- Preserve `docs/security.md`: inert outline analysis, unchanged safe-HTML sanitization, validated registry props, sandboxed `allow-scripts` frames without same-origin, validated messages and CSP.
- Keep files as the source of truth and the main-process section-index schema unchanged.
- The only main-process changes add the non-secret, additive `showFileExtensions` preference to the existing settings allowlist and IPC validator. No other channels, preload API or security behavior change.
- No new dependencies; no changes to `example-vault/`.

## Success Criteria

- [x] N1: Markdown and literal JSX headings share stable Outline, Reading and section-search identities without expression evaluation.
- [x] N2: Source, Live and Reading mode switches focus the new surface; panel commands never strand focus on body.
- [x] N3: Empty-vault and no-note-selected states offer relevant primary actions with real keybindings.
- [x] N4: Sampled text meets 4.5:1 contrast and renderer labels meet the 12px floor in both themes.
- [x] N5: Tree, tabs and breadcrumb hide unambiguous note extensions by default; settings, icons, truncation and density remain accessible.
- [x] N6: Graph labels are legible and collision-culled while the node navigator remains the accessible complete list.
- [x] N7: Compact context overlays close on navigation, content interaction or Escape and do not reopen spontaneously.

## Verification

See `docs/verification/goal-33-navigation-focus-accessibility.md`.
