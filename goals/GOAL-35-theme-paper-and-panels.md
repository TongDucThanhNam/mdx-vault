# GOAL-35 — Theme-following paper, resizable panels and content-fit islands

## Outcome

Reading feels native to the chosen workbench edition, panels resize like a calm IDE, and sandboxed islands occupy only their reported content height.

## Dependencies

GOAL-26, GOAL-28, GOAL-32, GOAL-33, GOAL-34.

## Constraints

- Reading paper follows the resolved app theme by default, with an always-light setting. Export and print are always light.
- Preserve the single-pane workbench; no split, following preview, or preview tabs.
- Preserve `docs/security.md`: the sanitizer, sandbox attributes, CSP, validated messages, and IPC boundary are unchanged.
- Preserve GOAL-32 last-good Reading and GOAL-34 scroll-surface `translateZ(0)` and body-portaled fixed controls.
- No new dependencies, preload or window changes, or edits to `example-vault/`. Main-process changes are additive settings only.

## Success Criteria

- [x] P1: Reading and hover-preview paper follow theme, all trusted islands use semantic note tokens, Mermaid matches paper, while print/export remain light.
- [x] P2: Wide and compact panels have accessible pointer/keyboard separators, bounded widths, reset, and additive persisted preferences without sacrificing the document floor.
- [x] P3: Sandbox frames reserve 260px pending, then fit validated content with a 40px floor and no resize oscillation.
- [x] P4: Typecheck, tests, build, changed-file Biome and repository lint cap pass; production visual, contrast and performance evidence is recorded.

## Verification

See `docs/verification/goal-35-theme-paper-and-panels.md`.
