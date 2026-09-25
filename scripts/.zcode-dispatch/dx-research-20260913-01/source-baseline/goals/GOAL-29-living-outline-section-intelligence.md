# GOAL-29 — Living Outline & Section Intelligence

## Objective

Turn Outline from a saved-index list into a live structural navigator for the
active MDX buffer, inspired by Fumadocs' data-first TOC and active-anchor model
but adapted to mdx-vault's nested Reading viewport and CodeMirror Source/Live
modes. Reuse the same safe AST analysis to make local SQLite search section-aware
and navigate exact matching headings.

## Target State

1. One shared, non-evaluating MDX structure analysis returns stable heading IDs,
   depth, text, source ranges, ordinal positions and section text.
2. Outline reflects unsaved note content without waiting for filesystem reindex.
3. Reading tracks the section nearest the top of its own scroll container;
   Source/Live track the section containing the caret.
4. The Right Sidebar renders a hierarchy connector that encodes actual heading
   depth, marks one active item, auto-scrolls it into view and remains fully
   usable without the connector graphic.
5. SQLite persists bounded section records. Text search can return a matching
   heading and activation opens the note at that section.
6. Outline remains the sole structural navigator: no inline document rail,
   minimap, split editor or new document-width track.

## Constraints

- Preserve every invariant in `docs/security.md`.
- Structure analysis parses note source as data only. It must not compile,
  evaluate, import or execute MDX/JSX.
- Do not add Fumadocs as a runtime dependency or copy its UI theme. Reimplement
  the bounded interaction pattern using the existing Knowledge Instrument tokens.
- App chrome uses Alloy/Instrument Blue; the Editorial note palette remains
  isolated to rendered note content.
- Connector SVG is presentational (`aria-hidden`). Heading buttons carry names,
  levels, focus state and `aria-current` semantics.
- Reduced motion must not change state, navigation or layout.
- Every renderer-provided path continues through the existing validated IPC
  boundary; no new filesystem access is exposed to the renderer.
- Search remains local-first SQLite FTS. Do not introduce Orama, Algolia,
  network search or a second search backend.
- Preserve canonical `editorInteractions.revealHeading` navigation.
- Use `apply_patch`; run typecheck and lint after meaningful changes.

## Success Criteria

- [x] Duplicate headings receive deterministic unique IDs and all heading records
      include bounded source ranges.
- [x] Editing, adding or removing a heading updates Outline before save/reindex.
- [x] Reading scroll and Source/Live caret movement update one active Outline item.
- [x] The hierarchy connector handles skipped levels and resize without affecting
      DOM semantics; active items remain visible in a long outline.
- [x] Keyboard focus, `aria-current`, reduced motion, empty state and bookmark
      actions remain correct.
- [x] Search results can identify a matching heading/section and activation
      reveals that section after opening its note.
- [x] Existing note-level search filters, backlinks, bookmarks, preview and
      Source/Reading navigation continue to work.
- [x] Focused tests, full tests, typecheck, lint and production build pass.
- [x] Live verification covers Reading scrollspy, Source caret tracking, unsaved
      heading changes, long-outline auto-scroll and compact supplementary dock.

## Execution Plan

1. Audit current Outline/editor/preview/index/search contracts and establish this
   ordered goal.
2. Add shared safe structure analysis and migrate stored heading/section data.
3. Feed Outline from the active unsaved buffer with indexed fallback.
4. Add Reading scrollspy and Source/Live caret-derived active heading state.
5. Build the accessible Fumadocs-inspired hierarchy connector and auto-scroll.
6. Add section-aware FTS results and exact-heading search navigation.
7. Update design/architecture/roadmap documentation and run full verification.

## Out of Scope

- An inline document TOC component, file-region include primitive or new note
  component library.
- Replacing SQLite FTS or redesigning the global Search dialog beyond section
  context and exact reveal.
- Arbitrary heading drag-to-reorder or document restructuring.
- Fumadocs page trees, publishing layouts, breadcrumbs, footer navigation or
  floating Ask AI controls.
- A new AI context policy; section records only prepare typed local data for a
  later explicitly invoked assistant workflow.
