# GOAL-38 — Dark-paper craft, contrast and Reading/export parity

## Outcome

The night edition keeps editorial structure without inverse light slabs; chrome and note controls remain legible, narrow Reading titles fit the document column, and exported prose matches Reading's frontmatter policy.

## Dependencies

GOAL-33, GOAL-35, GOAL-36 (preserving GOAL-32–37 behavior).

## Constraints

- Single pane. Reading paper follows the theme by default with a light option; export and print stay light.
- Untrusted sandbox islands keep their light card. No IPC, preload, CSP, sandbox, security-model or dependency changes.
- No edits to `example-vault/`; visual fixtures live in a disposable `.tmp/` copy. No commit.
- Keep light-paper prose styling and wide-column type unchanged.

## Success Criteria

- [x] T1: Neutral inverse fills use scoped dark-paper tokens across prose, table, registry chips and interactive controls; luminance sweep and light-paper visual parity are recorded.
- [x] T2: Composited text contrast reaches AA on tested light/dark chrome and follow/light paper; stateful input borders and focus indicators reach 3:1. Palette ratios are in `DESIGN.md`.
- [x] T3: 12px UI-label floor, reduced motion, visible focus and icon-only names/roles are audited and repaired where needed.
- [x] T4: Static and interactive exports omit raw frontmatter, matching Reading; metadata remains available for title/theme logic but out of visible prose.
- [x] T6: H1, deck and H2 follow the Reading column at 420–560px, without altering wide Reading or export type.
- [x] Verification: typecheck, tests, build, changed-file Biome and lint cap; production Electron screenshots, contrast and security checks recorded.

## Verification

See `docs/verification/goal-38-dark-paper-craft-and-contrast.md`.
