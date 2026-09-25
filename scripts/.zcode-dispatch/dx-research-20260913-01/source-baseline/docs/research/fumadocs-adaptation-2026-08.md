# Fumadocs patterns applicable to mdx-vault

Date: 2026-08-11

Fumadocs and mdx-vault have different products: Fumadocs publishes documentation,
while mdx-vault is a local-first authoring workbench. The reusable part is therefore
the data and interaction model, not its site layout or theme.

## What Fumadocs does well

- Its docs page consumes an explicit heading array rather than discovering visual
  DOM structure as the source of truth. Fumadocs MDX can generate that array for a
  document. See [Docs Page — Table of Contents](https://www.fumadocs.dev/docs/ui/layouts/page).
- Its headless TOC separates active-anchor observation, active-item auto-scroll and
  the clickable TOC item. See [Headless TOC](https://www.fumadocs.dev/docs/headless/components/toc).
- Headings receive stable anchors, with optional TOC visibility and custom-anchor
  syntax. See [Markdown — Headings](https://www.fumadocs.dev/docs/markdown#headings).
- The page API treats desktop TOC, compact popover and visual style as replaceable
  slots. That separation is more valuable than copying a particular sidebar skin.

## Adopted in GOAL-29

| Fumadocs idea | mdx-vault adaptation |
| --- | --- |
| TOC is data first | One inert AST projection returns IDs, depth, text, ordinal and source ranges. |
| Anchor observation is headless | Reading observes its own nested scroll viewport; Source/Live derive state from the caret. |
| Active item stays visible | The Right Outline scroll area follows its active semantic list item. |
| Clerk-style depth cue | A measured, presentational SVG connector uses app chrome tokens and tolerates skipped heading levels. |
| Stable anchors | Duplicate headings receive deterministic `-2`, `-3` IDs shared by index and Reading output. |

No Fumadocs runtime package or visual theme is added. The local implementation is
needed because CodeMirror caret state, unsaved buffers and Electron's nested Reading
viewport do not match a published web-page router.

## Useful later, but not in this goal

- Optional author syntax for a custom anchor or hiding a heading from Outline.
- A compact Outline popover only if future layouts remove the supplementary dock.
- Section records as typed, user-invoked AI context after a separate privacy and
  context-selection contract.

Page trees, publishing breadcrumbs, previous/next footers, site search services and a
floating Ask AI control do not fit the vault workbench and are intentionally rejected.
