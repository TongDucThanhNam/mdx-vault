# GOAL-37 — Compact layout, tab overflow, find/replace and panel states

## Outcome

The Zed-like workbench keeps the document readable and unobscured at supported widths, with predictable tabs, editor find/replace, graph orphan grouping, and honest panel and empty states.

## Dependencies

GOAL-33, GOAL-35 (and preserved GOAL-32, GOAL-34, GOAL-36 behavior).

## Constraints

- Single-pane workbench: no split, preview tabs, or document-occluding dock at 980–1920px.
- Preserve `docs/security.md`, GOAL-35 persisted resizable widths, and GOAL-34 `translateZ(0)` scroll surfaces and portaled fixed controls.
- No dependencies, preload changes, or edits to `example-vault/`. Main process remains unchanged.
- Empty-folder display is out of scope (folders are derived from files; revisit with folder operations).

## Success Criteria

- [x] C1: Pure dock policy fits saved widths without changing preferences, preserves a 26rem compact/30rem wide document floor, temporarily collapses Explorer where needed, and moves/returns focus for dock opening and closing.
- [x] C2: Tab overflow exposes directional fades, horizontal wheel scrolling, active-tab reveal, and a keyboard all-tabs list; existing Ctrl+Tab MRU remains transactional.
- [x] C3: Ctrl+F opens find only, Ctrl+H expands/focuses Replace in Source and Live, and Markdown highlight uses Ctrl+Shift+H without keymap conflicts.
- [x] C4: Graph orphans are separated into a labeled quiet cluster, with full titles on hover/focus and synced list/canvas selection; template filtering remains.
- [x] C5: AI no-key and no-note states give honest disabled-composer copy, no-key offers direct AI Settings, narrow banner content stacks, and busy/error/cancelled states remain visible.
- [x] C6: Empty vault, palette/finder/search no-result, no outline/backlinks, and empty graph states have intentional copy and light/dark evidence.

## Verification

See `docs/verification/goal-37-compact-layout-tabs-find-states.md`.
