# GOAL-32 — Zed-grade single-pane Reading UX

## Outcome

Reading is the primary, calm MDX surface: instant-feeling, stable, keyboard-navigable, and precisely connected to the editable source. Source, Live, and Reading remain views of one buffer.

## Dependencies

GOAL-22, GOAL-26, GOAL-27, GOAL-28, GOAL-29.

## Constraints

- Preserve GOAL-27's single-pane rule: no split editor, split panes, pane groups, following preview, or preview tabs.
- Preserve `docs/security.md`: sanitization, validated registry props, isolated `allow-scripts` iframe without same-origin, validated messages, and CSP.
- Worker compilation and trusted renderer execution remain in their existing processes.
- No main, preload, IPC, dependency, or GOAL-31 reactive-cell changes.
- Keep note paper visually separate from workbench chrome and honor reduced motion.

## Success Criteria

- [x] R1: Last good render remains visible during compilation and failure; note switches reset it; worker requests are latest-only without changing cache deduplication.
- [x] R2: A keyboard-accessible block-to-source action reveals the exact source line without hijacking links.
- [x] R3: Mode transitions preserve semantic position; cold tab restore waits for Reading layout.
- [x] R4: Images, sandbox islands, and Mermaid reserve stable space and maintain scroll anchoring.
- [x] R5: Each trusted registry island contains its own runtime failure without hiding sibling prose.
- [x] R6: Note labels meet the 12px floor and footnotes have paper and print treatments.
- [x] R7: Modes and Reading navigation have discoverable, collision-free keybindings and palette commands; status shows mode and compile state.

## Verification

See `docs/verification/goal-32-zed-grade-reading-ux.md`.
