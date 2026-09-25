# GOAL-28 — Editorial Note Design System

## Objective

Turn the global Editorial / Print Neo-Brutalism note theme into a maintainable
design system for every note surface without changing app chrome or Source
editing. Authors get native prose defaults plus a small stable class API;
trusted registry components remain the behavior layer.

## Target State

1. One canonical stylesheet serves Reading, hover preview, static export and
   interactive export.
2. Public `--note-*` tokens cover palette, type, spacing, measure, rules,
   shadows, focus, control sizing and motion.
3. Native Markdown/HTML receives a complete editorial prose treatment.
4. Stable `note-*` primitives cover kicker, deck, label/status, panel,
   explanation, result, current step and folio roles.
5. Existing `in-*` registry components consume compatibility aliases without
   becoming a public authoring API.
6. Narrow layouts, visible keyboard focus, reduced motion and print are explicit
   parts of the contract.

## Constraints

- Preserve the exact Paper, Paper Muted, Ink, Accent, Line and Result palette.
- Result blue is used only for computed or observed results.
- No gradient, blurred shadow, radius above zero, pastel or additional note font.
- Do not apply the note design system to app chrome or Source/code buffers.
- Do not weaken MDX sanitization or sandbox/export security boundaries.
- Do not create a renderer-only/export-only visual fork.
- Preserve existing trusted component behavior and legacy `theme: interactive-note` metadata.
- Use `apply_patch`; run typecheck and lint after meaningful changes.

## Success Criteria

- [x] Canonical `--note-*` tokens and legacy `--in-*` aliases are present.
- [x] Native prose and all public `note-*` primitives follow the four theme tells.
- [x] The interactive-note template demonstrates kicker, deck and folio primitives.
- [x] Mobile, focus-visible, reduced-motion and print contracts are covered by tests.
- [x] Static and interactive export embed the same canonical stylesheet.
- [x] The design system and authoring API are documented.
- [x] Focused tests, full tests, typecheck, lint and production build pass.
- [x] Live visual verification covers desktop and narrow Reading surfaces.

## Execution Plan

1. Audit the existing theme, preview/export wiring, templates and tests.
2. Introduce foundation tokens and preserve compatibility aliases.
3. Complete native prose, public primitives, controls and title signature.
4. Add compact, reduced-motion, focus and print behavior.
5. Update the template, design docs, authoring guide and test contract.
6. Run static gates, full validation and live visual verification.

## Out of Scope

- A user-selectable theme marketplace or arbitrary custom CSS loader.
- New executable MDX behavior or sandbox permissions.
- Re-theming the IDE workbench, Source editor or proof iframe content.
- New registry interactions unrelated to visual-system coverage.
