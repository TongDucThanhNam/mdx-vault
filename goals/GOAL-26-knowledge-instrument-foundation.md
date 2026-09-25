# GOAL-26 — Knowledge Instrument Foundation

## Objective

Replace the legacy Editorial Newspaper foundation with the Knowledge Instrument
design system, make the current single-pane shell resilient at compact widths,
and establish versioned interface preferences plus typed English/Vietnamese
localization for all new work.

## Current State

- The core application, workbench, knowledge utilities, graph and interactive
  authoring journeys are implemented through GOAL-25.
- App settings are version 5 and do not include locale, interface density or UI
  scale.
- The shell uses fixed 280/320/360px side tracks. At a 980px viewport with all
  docks open, the document surface can collapse to roughly 20px.
- The renderer uses an Editorial Newspaper visual system and self-hosted
  Playfair Display, Lora and Courier Prime fonts.
- Existing UI has many 9–10px labels. This goal fixes shared shell/primitives;
  the exhaustive feature-surface migration remains GOAL-36.

## Target State

1. `DESIGN.md` and renderer tokens describe one Knowledge Instrument system:
   precise lab-workbench surfaces, accessible signal colors, restrained rules,
   Atkinson Hyperlegible Next for UI, Literata for prose and IBM Plex Mono for
   code/data.
2. Settings v6 persists `locale`, `density` and `uiScale`, migrates old/corrupt
   snapshots safely, and applies them without reload.
3. A typed localization provider resolves `system | en | vi`, updates the
   document language and localizes the app shell foundation.
4. The current single-pane layout has wide, compact and overlay modes. Compact
   docks never consume the document track; Context and AI share a responsive
   dock switcher when both are open.
5. The named Outline panel remains the sole structural navigator and routes
   indexed-heading activation through the canonical navigation path.

## Constraints

- Preserve every security invariant in `docs/security.md`.
- Do not implement split panes, workspace persistence, collections, Git or
  recovery in this goal.
- Do not change workbench item semantics or the MDX trust/render pipeline.
- Fonts must be bundled locally. Do not add a CDN or relax CSP.
- App settings IPC remains narrow, zod-validated and secret-free.
- Compact layout must not silently hide an open Context or AI dock; if both are
  open, expose a keyboard-accessible switcher.
- Existing dirty worktree changes are user-owned. Integrate rather than discard
  them.
- New and migrated controls require visible focus, reduced-motion behavior and
  minimum 12px chrome text.

## Success Criteria

- [x] Settings v5/unknown input normalizes to a version 6 snapshot with safe
      defaults for locale, density and UI scale.
- [x] Locale, density and UI scale can be changed in Settings and are applied
      live to the document root.
- [x] English and Vietnamese catalogs are compile-time key-compatible; the root
      `lang` attribute follows the resolved locale.
- [x] At 1440px the shell uses normal dock tracks; at 980px and 200% zoom the
      active document retains usable width and all open docks remain reachable.
- [x] Outline exposes heading names to assistive technology and activates
      canonical source/reading navigation without an inline document rail.
- [x] Top bar, status bar, Empty State, shared Button and new dock chrome
      follow Knowledge Instrument tokens and use no text below 12px.
- [x] Light/dark, reduced-motion and keyboard-focus states pass live inspection.
- [x] `bun run typecheck`, `bun run lint`, `bun test` and `bun run build` pass.
- [x] A verification note records automated and live evidence without claiming
      GOAL-27+ behavior.

## Execution Plan

1. Add GOAL-26 to the ordered roadmap and replace the design contract.
2. Add bundled fonts, Knowledge Instrument tokens and shared primitive styling.
3. Migrate app settings and IPC contracts from v5 to v6.
4. Add typed i18n/provider and apply locale/density/UI scale at the app root.
5. Implement responsive workbench layout modes and compact dock arbitration.
6. Keep indexed-heading navigation in Outline without reserving a document rail.
7. Add unit/integration/UI tests, run full verification and document evidence.

## Out of Scope

- Arbitrary pane grid and named workspaces (GOAL-27).
- Crash journal, local history and unified diff (GOAL-28).
- Full app-wide removal of every legacy class/string (GOAL-36).
- 50k-vault performance gates and release packaging (GOAL-37/38).

## Agent Instructions

- Read `AGENTS.md`, `goals/README.md`, `docs/security.md` and the relevant UI
  skills before editing.
- Use `rg`, then `ast-grep outline` before reading large unfamiliar TS/TSX files.
- After each meaningful implementation tranche, run typecheck and lint.
- Verify every checkbox. If a criterion cannot be demonstrated, leave it
  unchecked and report the blocker.
