# GOAL-29 Verification — Living Outline & Section Intelligence

Date: 2026-08-11  
Environment: Windows 11, Electron production renderer, Bun 1.3.14, TypeScript 5.9

## Result

GOAL-29 passes. Outline now follows the active unsaved MDX buffer, tracks the
Reading viewport or Source/Live caret, visualizes real heading depth, and
auto-scrolls long structures. Local SQLite search can identify a matching
section and reveal its exact heading after the note opens.

The implementation adapts Fumadocs' data-first TOC, active-anchor observation
and independently scrolling TOC patterns without adding Fumadocs, a second
search engine, an inline document rail or a network dependency.

## Implementation evidence

- `src/shared/markdown-source.ts` performs one bounded, non-evaluating MDX AST
  analysis for stable duplicate-safe heading IDs, UTF-16 source ranges and
  section records.
- `src/renderer/src/hooks/useLivingOutline.ts` prefers deferred live-buffer
  structure and falls back to the saved index.
- `src/renderer/src/preview/MdxPreview.tsx` observes headings inside the nested
  Reading scroll root, including deterministic first/last-section behavior.
- `src/renderer/src/panels/OutlinePanel.tsx` keeps semantic ordered-list and
  button navigation while an `aria-hidden` measured SVG encodes hierarchy and
  the active path.
- SQLite schema v4 stores bounded headings and sections. Its existing local FTS
  path returns optional heading context; no renderer filesystem capability was
  added.
- Preview heading identity is appended after sanitization. The sanitizer was not
  broadened and note source is never compiled or evaluated for indexing.

## Automated gates

All commands ran from the repository root after the final source changes.

| Gate | Result |
| --- | --- |
| Focused structure, outline and section-search tests | 11 passed, 0 failed |
| Electron-native SQLite schema/search smoke | schema 4; 3 headings; matched `cache-invalidation` |
| `bun test` | 452 passed, 0 failed, 2,933 expectations across 102 files |
| `bun run typecheck` | Passed for node and web projects |
| `bun run lint` | Passed; 432 files checked |
| `bun run build` | Passed; main, preload and renderer production bundles built |

The production build retains existing Vite notices about mixed static/dynamic
imports, `gray-matter`, and large renderer chunks; GOAL-29 introduced no build
failure.

## Live Electron evidence

The Playwright journey used a disposable vault and Electron `userData`, then
deleted both after verification. Its machine-readable record is
[goal-29-live-results.json](assets/goal-29-dev/goal-29-live-results.json).

| Journey | Observed result |
| --- | --- |
| Source caret | `Later section` became the sole `aria-current="location"` item |
| Unsaved structure | 30 inserted headings appeared immediately; Outline contained 37 items |
| Long Outline | Active `Runtime Section 30` auto-scrolled into view (`scrollTop` 96.8) |
| Reading top/bottom | Active item moved from `Preview target` to `Runtime Section 30` |
| Duplicate headings | Preview exposed deterministic `caching` and `caching-2` identities |
| Hierarchy connector | One presentational SVG rendered two paths and a measured stepped hierarchy |
| Section search | Query matched `Later section`; activation placed it at the Reading viewport top |
| Compact layout | Context dock remained usable as a 352px supplementary overlay |
| Runtime audit | 0 console errors, 0 page errors, 0 external requests |

Visual captures:

- [Live unsaved Source outline](assets/goal-29-dev/goal-29-source-live-outline.png)
- [Reading scroll-spy at the final section](assets/goal-29-dev/goal-29-reading-scrollspy.png)
- [Compact Context outline](assets/goal-29-dev/goal-29-compact-outline.png)

## Deliberate limits

- Outline remains the only structural navigator; there is no split editor,
  minimap/source map, inline TOC rail or extra document-width track.
- Section text is bounded to 100,000 characters and heading analysis to 2,000
  entries per note.
- Search remains local-first SQLite FTS. Section records prepare typed local
  context but do not invoke AI or send content over the network.
